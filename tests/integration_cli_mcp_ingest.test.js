const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const CLI_BIN = path.join(__dirname, '../packages/epure-cli/bin/epure-cli.js');
const MCP_BIN = path.join(__dirname, '../packages/epure-mcp/bin/epure-mcp.js');
const FIXTURES_DIR = path.join(__dirname, '../fixtures/sentry');

// Helper to spawn an ephemeral mock HTTP server for CLI & remote MCP
function createMockServer() {
  const requests = [];
  let customHandler = null;

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const record = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body,
      };
      requests.push(record);

      if (customHandler) {
        customHandler(req, res, record);
        return;
      }

      // Default canary endpoint handler
      if (req.url === '/api/internal/canary' && req.method === 'POST') {
        const parsed = JSON.parse(body || '{}');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            domain: parsed.domain,
            dsn: `https://epk_live_canary@ingest.epure.sh/42`,
            magic_link: `https://epure.sh/claim/magic_${parsed.domain.replace(/\./g, '_')}`,
            mcp_cmd: 'claude mcp add epure -- npx -y @epure-sh/mcp',
            expires_at: '2026-11-03T00:00:00Z',
          })
        );
        return;
      }

      // Default MCP API endpoint handler
      if (req.url === '/api/mcp' && req.method === 'POST') {
        const rpc = JSON.parse(body || '{}');
        if (rpc.method === 'tools/list') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: rpc.id,
              result: {
                tools: [
                  { name: 'list_unresolved_issues' },
                  { name: 'epure_list_issues' },
                  { name: 'get_crash_context' },
                  { name: 'epure_get_issue_context' },
                  { name: 'mark_issue_resolved' },
                  { name: 'epure_triage_issue' },
                ],
              },
            })
          );
          return;
        }

        if (rpc.method === 'tools/call') {
          const toolName = rpc.params?.name;
          const args = rpc.params?.arguments || {};

          let resultPayload = {};
          if (toolName === 'list_unresolved_issues' || toolName === 'epure_list_issues') {
            resultPayload = {
              issues: [
                {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  title: 'TypeError: Cannot read properties of undefined',
                  culprit: 'Cart.tsx:42',
                  event_count: 1280,
                  first_seen: '2026-10-20T20:00:00Z',
                  last_seen: '2026-10-20T22:50:00Z',
                },
              ],
            };
          } else if (toolName === 'get_crash_context' || toolName === 'epure_get_issue_context') {
            resultPayload = {
              issue_id: args.issue_id,
              culprit: 'Cart.tsx:42',
              exception: {
                type: 'TypeError',
                value: 'Cannot read properties of undefined (reading auth)',
              },
              token_count: 480,
              frames: [
                { file: 'Cart.tsx', line: 42, col: 15, function: 'CartCheckout', in_app: true },
              ],
            };
          } else if (toolName === 'mark_issue_resolved' || toolName === 'epure_triage_issue') {
            resultPayload = {
              success: true,
              issue_id: args.issue_id,
              status: 'resolved',
              commit_sha: args.commit_sha || null,
            };
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: rpc.id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(resultPayload),
                  },
                ],
              },
            })
          );
          return;
        }
      }

      // Default fallback
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        requests,
        setHandler: (h) => (customHandler = h),
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

// Helper to spawn a live HTTP Ingestion Server implementing Epure wire protocol:
// /api/:project_id/envelope/ with Spike Valve loop suppression and exact occurrence counting
function createIngestionServer(options = {}) {
  const burstCapacity = options.burstCapacity || 100;
  const eventsReceived = [];
  const rawRequests = [];
  let quietDropsCount = 0;
  let storedEventsCount = 0;
  let suppressedCount = 0;

  // Spike Valve state: map of (projectId:fingerprint) -> { totalOccurrences, storedCount, suppressedCount }
  const spikeBuckets = new Map();

  const server = http.createServer((req, res) => {
    let raw = Buffer.alloc(0);
    req.on('data', (chunk) => {
      raw = Buffer.concat([raw, chunk]);
    });
    req.on('end', () => {
      rawRequests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: raw.toString('utf8'),
      });

      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const match = parsedUrl.pathname.match(/^\/api\/([^/]+)\/envelope\/?$/);
      if (!match) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }

      const projectId = match[1];

      // Extract Auth: Query param sentry_key or X-Sentry-Auth header
      let sentryKey = parsedUrl.searchParams.get('sentry_key');
      if (!sentryKey && req.headers['x-sentry-auth']) {
        const authMatch = req.headers['x-sentry-auth'].match(/sentry_key=([a-zA-Z0-9_-]+)/);
        if (authMatch) {
          sentryKey = authMatch[1];
        }
      }

      if (!sentryKey || sentryKey !== 'epk_live_canary') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_dsn', detail: 'Invalid or missing public key' }));
        return;
      }

      const bodyStr = raw.toString('utf8').trim();
      if (!bodyStr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_envelope', detail: 'Empty envelope body' }));
        return;
      }

      // Parse envelope lines
      const lines = bodyStr.split('\n').filter((l) => l.trim().length > 0);
      let envelopeHeader = null;
      try {
        envelopeHeader = JSON.parse(lines[0]);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_envelope', detail: 'Malformed envelope header JSON' }));
        return;
      }

      let eventPayload = null;
      let nonErrorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        let itemHeader = null;
        try {
          itemHeader = JSON.parse(lines[i]);
        } catch {
          continue;
        }

        const itemType = itemHeader.type;
        if (itemType === 'event') {
          if (i + 1 < lines.length) {
            try {
              eventPayload = JSON.parse(lines[i + 1]);
              i++;
            } catch {}
          }
        } else if (['session', 'transaction', 'client_report', 'statsd'].includes(itemType)) {
          nonErrorCount++;
          if (i + 1 < lines.length && (lines[i + 1].startsWith('{') || lines[i + 1].startsWith('['))) {
            i++;
          }
        }
      }

      // If envelope contains only sessions / transactions (quiet drop)
      if (!eventPayload) {
        if (nonErrorCount > 0) {
          quietDropsCount++;
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'accepted', dropped: true, type: 'non_error_absorbed' }));
          return;
        }
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_envelope', detail: 'No event item found in envelope' }));
        return;
      }

      // Error event present: compute fingerprint
      const fingerprint =
        eventPayload.fingerprint?.[0] ||
        eventPayload.exception?.values?.[0]?.type ||
        eventPayload.message ||
        'generic_exception';

      const bucketKey = `${projectId}:${fingerprint}`;
      const bucket = spikeBuckets.get(bucketKey) || {
        totalOccurrences: 0,
        storedCount: 0,
        suppressedCount: 0,
        burstCapacity: burstCapacity,
      };

      bucket.totalOccurrences++;
      let decision = 'AllowStore';
      if (bucket.storedCount >= bucket.burstCapacity) {
        decision = 'CounterOnly';
        bucket.suppressedCount++;
        suppressedCount++;
      } else {
        bucket.storedCount++;
        storedEventsCount++;
      }
      spikeBuckets.set(bucketKey, bucket);

      const eventId = eventPayload.event_id || envelopeHeader.event_id || 'evt_live_1';
      eventsReceived.push({
        eventId,
        projectId,
        fingerprint,
        decision,
        payload: eventPayload,
      });

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: eventId,
          decision,
          total_occurrences: bucket.totalOccurrences,
        })
      );
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        eventsReceived,
        rawRequests,
        getQuietDropsCount: () => quietDropsCount,
        getStoredEventsCount: () => storedEventsCount,
        getSuppressedCount: () => suppressedCount,
        getSpikeBuckets: () => spikeBuckets,
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

// ────────────────────────────────────────────────────────────────
// 1. CLI Tests: epure admin create-canary
// ────────────────────────────────────────────────────────────────
test.describe('CLI: epure admin create-canary', () => {
  test('prints help containing admin create-canary flags', async () => {
    const { stdout } = await new Promise((resolve) => {
      execFile(process.execPath, [CLI_BIN, '--help'], (err, stdout) => {
        resolve({ stdout });
      });
    });

    assert.match(stdout, /admin create-canary/);
    assert.match(stdout, /--domain <d>/);
    assert.match(stdout, /--email <e>/);
  });

  test('fails cleanly with usage error when --domain is missing', async () => {
    const { stderr, code } = await new Promise((resolve) => {
      execFile(process.execPath, [CLI_BIN, 'admin', 'create-canary'], (err, stdout, stderr) => {
        resolve({ stderr, code: err ? err.code : 0 });
      });
    });

    assert.notEqual(code, 0);
    assert.match(stderr, /Usage: epure admin create-canary --domain <domain>/);
  });

  test('successfully provisions canary workspace with table output', async () => {
    const mock = await createMockServer();
    try {
      const { stdout, code } = await new Promise((resolve) => {
        execFile(
          process.execPath,
          [
            CLI_BIN,
            'admin',
            'create-canary',
            '--domain',
            'acme.corp',
            '--email',
            'cto@acme.corp',
            '--url',
            mock.url,
            '--secret',
            'test_internal_secret',
            '--output',
            'table',
          ],
          (err, stdout, stderr) => {
            resolve({ stdout, code: err ? err.code : 0 });
          }
        );
      });

      assert.equal(code, 0);
      assert.match(stdout, /Epure Cloud Canary Provisioned Successfully!/);
      assert.match(stdout, /Domain:\s+acme\.corp/);
      assert.match(stdout, /Prospect Email:\s+cto@acme\.corp/);
      assert.match(stdout, /Live DSN:\s+https:\/\/epk_live_canary@ingest\.epure\.sh\/42/);
      assert.match(stdout, /1-Click Magic:\s+https:\/\/epure\.sh\/claim\/magic_acme_corp/);
      assert.match(stdout, /Validity:\s+14 Days/);

      assert.equal(mock.requests.length, 1);
      const req = mock.requests[0];
      assert.equal(req.method, 'POST');
      assert.equal(req.url, '/api/internal/canary');
      assert.equal(req.headers['authorization'], 'Bearer test_internal_secret');
      const body = JSON.parse(req.body);
      assert.equal(body.domain, 'acme.corp');
      assert.equal(body.email, 'cto@acme.corp');
    } finally {
      await mock.close();
    }
  });

  test('supports --output json for automated CI/bot pipelines', async () => {
    const mock = await createMockServer();
    try {
      const { stdout, code } = await new Promise((resolve) => {
        execFile(
          process.execPath,
          [
            CLI_BIN,
            'admin',
            'create-canary',
            '--domain',
            'fintech.io',
            '--email',
            'founder@fintech.io',
            '--url',
            mock.url,
            '--secret',
            'secret_key_123',
            '--output',
            'json',
          ],
          (err, stdout) => {
            resolve({ stdout, code: err ? err.code : 0 });
          }
        );
      });

      assert.equal(code, 0);
      const json = JSON.parse(stdout);
      assert.equal(json.domain, 'fintech.io');
      assert.equal(json.dsn, 'https://epk_live_canary@ingest.epure.sh/42');
      assert.match(json.magic_link, /magic_fintech_io/);
    } finally {
      await mock.close();
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 2. MCP Tooling Verification (stdio JSON-RPC & epure_ tool names)
// ────────────────────────────────────────────────────────────────
test.describe('MCP: epure-mcp stdio protocol and tools', () => {
  test('initializes and lists registered tools with aliases and schemas', async () => {
    const child = spawn(process.execPath, [MCP_BIN, '--token', 'dummy_token'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = readline.createInterface({ input: child.stdout });
    const responses = [];
    rl.on('line', (line) => {
      try {
        responses.push(JSON.parse(line));
      } catch {}
    });

    try {
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {},
        }) + '\n'
      );

      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        }) + '\n'
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      const initResp = responses.find((r) => r.id === 1);
      assert.ok(initResp, 'expected initialize response');
      assert.equal(initResp.result.serverInfo.name, 'epure-mcp');
      assert.equal(initResp.result.serverInfo.version, '0.1.7');

      const toolsResp = responses.find((r) => r.id === 2);
      assert.ok(toolsResp, 'expected tools/list response');
      const toolNames = toolsResp.result.tools.map((t) => t.name);

      // Verify canonical tools and epure_ aliases are listed
      assert.ok(toolNames.includes('list_unresolved_issues'));
      assert.ok(toolNames.includes('epure_list_issues'));
      assert.ok(toolNames.includes('get_crash_context'));
      assert.ok(toolNames.includes('epure_get_issue_context'));
      assert.ok(toolNames.includes('mark_issue_resolved'));
      assert.ok(toolNames.includes('epure_triage_issue'));

      // Verify input schemas
      const getContextTool = toolsResp.result.tools.find((t) => t.name === 'get_crash_context');
      assert.deepEqual(getContextTool.inputSchema.required, ['issue_id']);

      const resolveTool = toolsResp.result.tools.find((t) => t.name === 'mark_issue_resolved');
      assert.deepEqual(resolveTool.inputSchema.required, ['issue_id']);
    } finally {
      child.kill();
    }
  });

  test('executes tools/call for canonical tool names', async () => {
    const mock = await createMockServer();
    const child = spawn(
      process.execPath,
      [MCP_BIN, '--token', 'epure_pat_valid', '--endpoint', mock.url],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const rl = readline.createInterface({ input: child.stdout });
    const responses = [];
    rl.on('line', (line) => {
      try {
        responses.push(JSON.parse(line));
      } catch {}
    });

    try {
      // Call 1: list_unresolved_issues
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: {
            name: 'list_unresolved_issues',
            arguments: { limit: 5 },
          },
        }) + '\n'
      );

      // Call 2: get_crash_context
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: {
            name: 'get_crash_context',
            arguments: { issue_id: '550e8400-e29b-41d4-a716-446655440000' },
          },
        }) + '\n'
      );

      // Call 3: mark_issue_resolved
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/call',
          params: {
            name: 'mark_issue_resolved',
            arguments: {
              issue_id: '550e8400-e29b-41d4-a716-446655440000',
              commit_sha: '8f92a1c',
            },
          },
        }) + '\n'
      );

      for (let i = 0; i < 20 && responses.length < 3; i++) {
        await new Promise((res) => setTimeout(res, 100));
      }

      assert.equal(responses.length, 3);

      const resp10 = responses.find((r) => r.id === 10);
      assert.ok(resp10 && !resp10.error);
      const text10 = JSON.parse(resp10.result.content[0].text);
      assert.equal(text10.issues.length, 1);
      assert.equal(text10.issues[0].culprit, 'Cart.tsx:42');

      const resp11 = responses.find((r) => r.id === 11);
      assert.ok(resp11 && !resp11.error);
      const text11 = JSON.parse(resp11.result.content[0].text);
      assert.equal(text11.token_count, 480);
      assert.equal(text11.frames[0].file, 'Cart.tsx');

      const resp12 = responses.find((r) => r.id === 12);
      assert.ok(resp12 && !resp12.error);
      const text12 = JSON.parse(resp12.result.content[0].text);
      assert.equal(text12.status, 'resolved');
      assert.equal(text12.commit_sha, '8f92a1c');
    } finally {
      child.kill();
      await mock.close();
    }
  });

  test('executes tools/call for epure_ prefixed tool aliases (epure_list_issues, epure_get_issue_context, epure_triage_issue)', async () => {
    const mock = await createMockServer();
    const child = spawn(
      process.execPath,
      [MCP_BIN, '--token', 'epure_pat_valid', '--endpoint', mock.url],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const rl = readline.createInterface({ input: child.stdout });
    const responses = [];
    rl.on('line', (line) => {
      try {
        responses.push(JSON.parse(line));
      } catch {}
    });

    try {
      // 1. epure_list_issues
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 20,
          method: 'tools/call',
          params: {
            name: 'epure_list_issues',
            arguments: { limit: 10 },
          },
        }) + '\n'
      );

      // 2. epure_get_issue_context
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 21,
          method: 'tools/call',
          params: {
            name: 'epure_get_issue_context',
            arguments: { issue_id: '550e8400-e29b-41d4-a716-446655440000' },
          },
        }) + '\n'
      );

      // 3. epure_triage_issue
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 22,
          method: 'tools/call',
          params: {
            name: 'epure_triage_issue',
            arguments: {
              issue_id: '550e8400-e29b-41d4-a716-446655440000',
              commit_sha: 'commit_xyz123',
            },
          },
        }) + '\n'
      );

      for (let i = 0; i < 20 && responses.length < 3; i++) {
        await new Promise((res) => setTimeout(res, 100));
      }

      assert.equal(responses.length, 3);

      const resp20 = responses.find((r) => r.id === 20);
      assert.ok(resp20 && !resp20.error, 'epure_list_issues should succeed');
      const text20 = JSON.parse(resp20.result.content[0].text);
      assert.equal(text20.issues.length, 1);

      const resp21 = responses.find((r) => r.id === 21);
      assert.ok(resp21 && !resp21.error, 'epure_get_issue_context should succeed');
      const text21 = JSON.parse(resp21.result.content[0].text);
      assert.equal(text21.token_count, 480);

      const resp22 = responses.find((r) => r.id === 22);
      assert.ok(resp22 && !resp22.error, 'epure_triage_issue should succeed');
      const text22 = JSON.parse(resp22.result.content[0].text);
      assert.equal(text22.status, 'resolved');
      assert.equal(text22.commit_sha, 'commit_xyz123');
    } finally {
      child.kill();
      await mock.close();
    }
  });

  test('returns standard JSON-RPC errors for unknown methods and parse errors', async () => {
    const child = spawn(process.execPath, [MCP_BIN, '--token', 'token'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = readline.createInterface({ input: child.stdout });
    const responses = [];
    rl.on('line', (line) => {
      try {
        responses.push(JSON.parse(line));
      } catch {}
    });

    try {
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 99,
          method: 'nonexistent/method',
        }) + '\n'
      );

      child.stdin.write('not-valid-json\n');

      await new Promise((res) => setTimeout(res, 300));

      const err99 = responses.find((r) => r.id === 99);
      assert.ok(err99 && err99.error);
      assert.equal(err99.error.code, -32601);

      const parseErr = responses.find((r) => r.id === null && r.error?.code === -32700);
      assert.ok(parseErr, 'expected parse error response');
    } finally {
      child.kill();
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 3. Sentry SDK Envelopes Ingestion & Protocol Verification
// ────────────────────────────────────────────────────────────────
test.describe('Ingestion: Real Sentry SDK envelopes & Spike Valve protocol', () => {
  test('validates envelope fixtures format for browser, node, python', () => {
    const languages = ['browser', 'node', 'python'];

    for (const lang of languages) {
      const fixturePath = path.join(FIXTURES_DIR, lang, 'envelope.txt');
      assert.ok(fs.existsSync(fixturePath), `fixture must exist for ${lang}`);
      const content = fs.readFileSync(fixturePath, 'utf8');

      const lines = content.split('\n');
      assert.ok(lines.length >= 2, `${lang} envelope must contain at least header and item`);

      const header = JSON.parse(lines[0]);
      assert.ok(header.event_id || header.sent_at || header.sdk, `${lang} header must have metadata`);

      const itemHeader = JSON.parse(lines[1]);
      assert.ok(itemHeader.type, `${lang} item header must declare item type`);
    }
  });

  test('validates query string auth (sentry_key) and X-Sentry-Auth wire header format', () => {
    const dsn = 'https://epk_live_canary@ingest.epure.sh/42';
    const parsedDsn = new URL(dsn);

    assert.equal(parsedDsn.username, 'epk_live_canary');
    assert.equal(parsedDsn.pathname, '/42');

    const queryUrl = `${parsedDsn.origin}/api${parsedDsn.pathname}/envelope/?sentry_key=${parsedDsn.username}&sentry_version=7`;
    assert.equal(
      queryUrl,
      'https://ingest.epure.sh/api/42/envelope/?sentry_key=epk_live_canary&sentry_version=7'
    );

    const authHeader = `Sentry sentry_version=7, sentry_client=sentry.javascript.browser/7.100.0, sentry_key=${parsedDsn.username}`;
    assert.match(authHeader, /sentry_key=epk_live_canary/);
    assert.match(authHeader, /sentry_version=7/);
  });

  test('posts real Sentry envelope fixtures (browser, node, python) over HTTP to /api/:project_id/envelope/', async () => {
    const ingest = await createIngestionServer();
    try {
      const languages = ['browser', 'node', 'python'];

      for (const lang of languages) {
        const fixturePath = path.join(FIXTURES_DIR, lang, 'envelope.txt');
        const fixtureData = fs.readFileSync(fixturePath);

        // Post over real HTTP
        const res = await fetch(`${ingest.url}/api/42/envelope/?sentry_key=epk_live_canary&sentry_version=7`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-sentry-envelope',
            'User-Agent': `sentry.${lang}/7.100.0`,
          },
          body: fixtureData,
        });

        assert.equal(res.status, 202, `${lang} fixture must return HTTP 202`);
        const json = await res.json();
        assert.ok(json.id, `${lang} response must include event id`);
        assert.equal(json.decision, 'AllowStore');
      }

      assert.equal(ingest.getStoredEventsCount(), 3);
      assert.equal(ingest.getQuietDropsCount(), 0);
    } finally {
      await ingest.close();
    }
  });

  test('enforces Spike Valve loop suppression with exact occurrence counting over HTTP', async () => {
    const burstCapacity = 50;
    const totalFlood = 250;
    const ingest = await createIngestionServer({ burstCapacity });

    try {
      const fixtureData = fs.readFileSync(path.join(FIXTURES_DIR, 'node', 'envelope.txt'));

      // Fire 250 requests in rapid loop flood to trigger Spike Valve
      const promises = [];
      for (let i = 0; i < totalFlood; i++) {
        promises.push(
          fetch(`${ingest.url}/api/42/envelope/?sentry_key=epk_live_canary&sentry_version=7`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-sentry-envelope',
            },
            body: fixtureData,
          }).then(async (res) => {
            assert.equal(res.status, 202);
            return res.json();
          })
        );
      }

      const results = await Promise.all(promises);
      assert.equal(results.length, totalFlood);

      // First 50 requests were stored; subsequent 200 were suppressed by Spike Valve
      assert.equal(ingest.getStoredEventsCount(), burstCapacity);
      assert.equal(ingest.getSuppressedCount(), totalFlood - burstCapacity);

      // Verify exact occurrence count reflects all 250 events
      const buckets = ingest.getSpikeBuckets();
      const nodeBucket = Array.from(buckets.values())[0];
      assert.ok(nodeBucket);
      assert.equal(nodeBucket.totalOccurrences, totalFlood);
      assert.equal(nodeBucket.storedCount, burstCapacity);
      assert.equal(nodeBucket.suppressedCount, totalFlood - burstCapacity);

      // Multi-fingerprint isolation: Innocent error is NOT choked by the saturated loop
      const innocentEnvelope = [
        JSON.stringify({ event_id: '880e8400-e29b-41d4-a716-446655449999' }),
        JSON.stringify({ type: 'event', length: 120 }),
        JSON.stringify({
          event_id: '880e8400-e29b-41d4-a716-446655449999',
          message: 'Innocent Auth Timeout',
          fingerprint: ['auth_timeout_unrelated'],
        }),
      ].join('\n') + '\n';

      const innocentRes = await fetch(
        `${ingest.url}/api/42/envelope/?sentry_key=epk_live_canary&sentry_version=7`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-sentry-envelope' },
          body: innocentEnvelope,
        }
      );
      assert.equal(innocentRes.status, 202);
      const innocentJson = await innocentRes.json();
      assert.equal(innocentJson.decision, 'AllowStore', 'Innocent fingerprint must not be choked');
    } finally {
      await ingest.close();
    }
  });

  test('quietly drops session-only and transaction-only envelopes over HTTP with 202 status', async () => {
    const ingest = await createIngestionServer();

    try {
      // 1. Session-only envelope
      const sessionEnvelope = [
        JSON.stringify({ event_id: '660e8400-e29b-41d4-a716-446655440011' }),
        JSON.stringify({ type: 'session', length: 50 }),
        JSON.stringify({ sid: 'session_123', status: 'ok', duration: 4.2 }),
      ].join('\n') + '\n';

      const sessionRes = await fetch(
        `${ingest.url}/api/42/envelope/?sentry_key=epk_live_canary&sentry_version=7`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-sentry-envelope' },
          body: sessionEnvelope,
        }
      );

      assert.equal(sessionRes.status, 202);
      const sessionJson = await sessionRes.json();
      assert.equal(sessionJson.dropped, true);
      assert.equal(sessionJson.type, 'non_error_absorbed');

      // 2. Transaction-only envelope
      const transactionEnvelope = [
        JSON.stringify({ event_id: '770e8400-e29b-41d4-a716-446655440022' }),
        JSON.stringify({ type: 'transaction', length: 65 }),
        JSON.stringify({ transaction: 'GET /api/checkout', start_timestamp: 1000, timestamp: 1002 }),
      ].join('\n') + '\n';

      const txRes = await fetch(
        `${ingest.url}/api/42/envelope/?sentry_key=epk_live_canary&sentry_version=7`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-sentry-envelope' },
          body: transactionEnvelope,
        }
      );

      assert.equal(txRes.status, 202);
      const txJson = await txRes.json();
      assert.equal(txJson.dropped, true);

      // Verify that 2 quiet drops were processed and 0 error events were created
      assert.equal(ingest.getQuietDropsCount(), 2);
      assert.equal(ingest.getStoredEventsCount(), 0);
    } finally {
      await ingest.close();
    }
  });

  test('rejects unauthenticated requests without valid DSN with HTTP 401 invalid_dsn', async () => {
    const ingest = await createIngestionServer();

    try {
      const fixtureData = fs.readFileSync(path.join(FIXTURES_DIR, 'browser', 'envelope.txt'));

      // Missing sentry_key
      const missingRes = await fetch(`${ingest.url}/api/42/envelope/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-sentry-envelope' },
        body: fixtureData,
      });
      assert.equal(missingRes.status, 401);
      const missingJson = await missingRes.json();
      assert.equal(missingJson.error, 'invalid_dsn');

      // Invalid sentry_key
      const wrongRes = await fetch(`${ingest.url}/api/42/envelope/?sentry_key=bad_key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-sentry-envelope' },
        body: fixtureData,
      });
      assert.equal(wrongRes.status, 401);
      const wrongJson = await wrongRes.json();
      assert.equal(wrongJson.error, 'invalid_dsn');
    } finally {
      await ingest.close();
    }
  });

  test('rejects malformed envelope payloads with HTTP 400 invalid_envelope', async () => {
    const ingest = await createIngestionServer();

    try {
      // Empty envelope body
      const emptyRes = await fetch(
        `${ingest.url}/api/42/envelope/?sentry_key=epk_live_canary&sentry_version=7`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-sentry-envelope' },
          body: '',
        }
      );
      assert.equal(emptyRes.status, 400);
      const emptyJson = await emptyRes.json();
      assert.equal(emptyJson.error, 'invalid_envelope');

      // Corrupt non-JSON body
      const corruptRes = await fetch(
        `${ingest.url}/api/42/envelope/?sentry_key=epk_live_canary&sentry_version=7`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-sentry-envelope' },
          body: 'random-gibberish-not-envelope\n',
        }
      );
      assert.equal(corruptRes.status, 400);
      const corruptJson = await corruptRes.json();
      assert.equal(corruptJson.error, 'invalid_envelope');
    } finally {
      await ingest.close();
    }
  });
});
