#!/usr/bin/env node

/**
 * @epure-sh/cli - Official Command-Line Interface for Epure
 * Triage errors, inspect issue queues, demangle stack traces, and manage workspaces.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const auth = require('../lib/auth');

const VERSION = '0.1.7';

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
@epure-sh/cli - Epure Command-Line Interface (v${VERSION})

Usage:
  npx @epure-sh/cli <command> [options]
  epure <command> [options]

Authentication:
  login                       Authenticate via browser OAuth (loopback or device code)
  logout                      Remove saved credentials for current or specified instance
  use <url>                   Switch active Epure instance
  instances                   List all configured Epure instances
  auth whoami                 Verify your active token and organization role

Core Commands:
  queue                       List unresolved production issue queue
  context <issue_id>          Export demangled stack trace and code lines for an issue
  issue show <issue_id>       View full metadata for a specific issue
  triage resolve <issue_id>   Mark an issue resolved (optional: --release <rel>)
  triage ignore <issue_id>    Ignore an issue from alerting
  triage reopen <issue_id>    Reopen a resolved or ignored issue
  alerts                      List recent alerting events (optional: --view unread)
  api <METHOD> <PATH>         Execute raw authenticated API call against workspace

Admin / Outbound Sales:
  admin create-canary         Pre-provision an isolated Epure Cloud workspace with live DSN & Magic Link
                              Flags: --domain <d>, --email <e>, [--name <n>], [--error <err>]

Global Options:
  --token, -t <token>         Override Epure Personal Access Token
  --url, -u <url>             Override Epure endpoint (default: current instance or https://epure.sh)
  --device                    Force RFC 8628 Device Code flow (for SSH/headless)
  --output, -o <json|table>   Output format (default: json)
  --help, -h                  Display this help message
  --version, -v               Display CLI version

Examples:
  epure login
  epure login --url http://localhost:8080
  epure use https://epure.sh
  epure queue --limit 20
  epure context 550e8400-e29b-41d4-a716-446655440000 --format markdown
  epure triage resolve 550e8400-e29b-41d4-a716-446655440000 --release v1.2.0
`);
}

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(`@epure-sh/cli v${VERSION}`);
  process.exit(0);
}

// Parse top-level flags
let explicitToken = process.env.EPURE_TOKEN || '';
let explicitUrl = process.env.EPURE_URL || '';
let forceDevice = false;
let outputFormat = 'json';

const filteredArgs = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--token' || arg === '-t') {
    explicitToken = args[++i];
  } else if (arg.startsWith('--token=')) {
    explicitToken = arg.split('=')[1];
  } else if (arg === '--url' || arg === '-u') {
    explicitUrl = args[++i];
  } else if (arg.startsWith('--url=')) {
    explicitUrl = arg.split('=')[1];
  } else if (arg === '--device' || arg === '--no-browser') {
    forceDevice = true;
  } else if (arg === '--output' || arg === '-o') {
    outputFormat = args[++i];
  } else if (arg.startsWith('--output=')) {
    outputFormat = arg.split('=')[1];
  } else {
    filteredArgs.push(arg);
  }
}

let activeToken = explicitToken;
let baseUrl = explicitUrl;

async function resolveAuthentication() {
  if (explicitToken) {
    baseUrl = auth.normalizeUrl(explicitUrl || 'https://epure.sh');
    return explicitToken;
  }

  const cred = auth.getActiveCredentials(explicitUrl);
  if (cred) {
    baseUrl = cred.url;
    try {
      activeToken = await auth.ensureValidToken(cred);
      return activeToken;
    } catch {
      activeToken = cred.access_token;
      return activeToken;
    }
  }

  baseUrl = auth.normalizeUrl(explicitUrl || 'https://epure.sh');
  return '';
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    if (!activeToken && !path.startsWith('/api/v1/auth/')) {
      return reject(
        new Error(
          'Authentication required. Run "epure login" or pass --token <token>'
        )
      );
    }

    const fullUrl =
      path.startsWith('http://') || path.startsWith('https://')
        ? path
        : `${baseUrl}${path}`;
    const urlObj = new URL(fullUrl);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = body
      ? typeof body === 'string'
        ? body
        : JSON.stringify(body)
      : null;

    const reqHeaders = {
      'User-Agent': `@epure-sh/cli/${VERSION}`,
      ...headers,
    };
    if (activeToken) {
      reqHeaders['Authorization'] = `Bearer ${activeToken}`;
    }
    if (payload && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = client.request(
      fullUrl,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => {
          resBody += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              text: resBody,
              json: () => {
                try {
                  return JSON.parse(resBody);
                } catch {
                  return resBody;
                }
              },
            });
          } else {
            let errDetail = resBody;
            try {
              const parsed = JSON.parse(resBody);
              errDetail = parsed.error_description || parsed.error || parsed.message || resBody;
            } catch {}
            reject(new Error(`HTTP ${res.statusCode}: ${errDetail}`));
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function printOutput(data, tableRenderer = null) {
  if (outputFormat === 'table' && tableRenderer) {
    tableRenderer(data);
  } else {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

async function handleCommand() {
  const cmd = filteredArgs[0];
  const subCmd = filteredArgs[1];

  if (cmd === 'login') {
    const res = await auth.login({
      url: explicitUrl,
      device: forceDevice,
      clientId: 'epure-cli',
    });
    console.log(`\n✓ Successfully authenticated with ${res.url}!`);
    console.log(`  Organization: ${res.org_id}`);
    console.log(`  Credentials saved to ${auth.getCredentialsPath()}\n`);
    return;
  }

  if (cmd === 'logout') {
    const removed = auth.removeInstance(explicitUrl);
    console.log(`✓ Logged out of ${removed}. Credentials removed.\n`);
    return;
  }

  if (cmd === 'use') {
    const target = filteredArgs[1];
    if (!target) {
      throw new Error('Usage: epure use <url>');
    }
    const switched = auth.switchInstance(target);
    console.log(`✓ Active instance switched to: ${switched}\n`);
    return;
  }

  if (cmd === 'instances') {
    const info = auth.listInstances();
    console.log('\nConfigured Epure Instances:');
    if (info.instances.length === 0) {
      console.log('  (no instances configured. Run "epure login")\n');
      return;
    }
    for (const inst of info.instances) {
      const active = inst === info.current_instance ? '* ' : '  ';
      console.log(`${active}${inst}`);
    }
    console.log('');
    return;
  }

  // Admin / Canary Provisioning command
  if (cmd === 'admin') {
    let domain = '';
    let email = '';
    let name = '';
    let error = '';
    let secret = process.env.EPURE_INTERNAL_SECRET || explicitToken || 'epure_dev_internal_secret';

    for (let i = 1; i < filteredArgs.length; i++) {
      const a = filteredArgs[i];
      if (a === '--domain') domain = filteredArgs[++i];
      else if (a === '--email') email = filteredArgs[++i];
      else if (a === '--name') name = filteredArgs[++i];
      else if (a === '--error') error = filteredArgs[++i];
      else if (a === '--secret') secret = filteredArgs[++i];
    }

    if (subCmd === 'create-canary') {
      if (!domain) {
        throw new Error('Usage: epure admin create-canary --domain <domain> --email <email> [--name <name>] [--error <error>]');
      }

      if (secret) {
        activeToken = secret;
      }
      if (!baseUrl || baseUrl === 'https://epure.sh') {
        baseUrl = process.env.EPURE_CLOUD_URL || explicitUrl || 'https://cloud.epure.sh';
      }
      if (!activeToken) {
        await resolveAuthentication();
      }

      const body = {
        domain,
        email: email || undefined,
        app_name: name || domain.replace(/\./g, '-'),
        seed_error: error || undefined,
      };

      const res = await request('POST', '/api/internal/canary', body);
      const data = res.json();

      printOutput(data, (info) => {
        console.log('\n⚡ Epure Cloud Canary Provisioned Successfully!');
        console.log('───────────────────────────────────────────────────────');
        console.log(`  Domain:         ${info.domain || domain}`);
        if (email) console.log(`  Prospect Email: ${email}`);
        console.log(`  Live DSN:       ${info.dsn}`);
        console.log(`  1-Click Magic:  ${info.magic_link}`);
        console.log(`  MCP Command:    ${info.mcp_cmd}`);
        console.log('  Validity:       14 Days (Zero password/signup prompt)');
        console.log('───────────────────────────────────────────────────────');
        console.log('  Seeded Exceptions:');
        console.log(`    1. [Primary] ${error || 'TypeError: Cannot read properties of undefined (reading auth)'}`);
        console.log('    2. [Timeout] DatabaseError: connection pool exhausted (timeout after 5000ms)');
        console.log('    3. [Webhook] UnhandledPromiseRejection: failed to process webhook payment payload\n');
      });
      return;
    } else {
      throw new Error(`Unknown admin command: ${subCmd}. Usage: epure admin create-canary`);
    }
  }

  // All other commands require authentication
  await resolveAuthentication();
  if (!activeToken) {
    if (process.stdin.isTTY) {
      console.log('No active session found. Initiating login...\n');
      await auth.login({
        url: explicitUrl,
        device: forceDevice,
        clientId: 'epure-cli',
      });
      await resolveAuthentication();
    } else {
      throw new Error(
        'Authentication required. Run "epure login" or set EPURE_TOKEN.'
      );
    }
  }

  switch (cmd) {
    case 'auth': {
      if (subCmd === 'whoami') {
        const res = await request('GET', '/api/v1/agent/whoami');
        printOutput(res.json(), (data) => {
          console.log('\nAuthenticated Agent Identity:');
          console.log(`  Endpoint:     ${baseUrl}`);
          console.log(`  User ID:      ${data.user_id}`);
          console.log(`  Org ID:       ${data.org_id}`);
          console.log(`  Email:        ${data.email || 'N/A'}`);
          console.log(`  Role:         ${data.role}`);
          console.log(`  Token Scope:  ${(data.scopes || []).join(', ') || 'full'}\n`);
        });
      } else {
        throw new Error(`Unknown auth command: ${subCmd}. Usage: epure auth whoami`);
      }
      break;
    }

    case 'queue': {
      let limit = 20;
      let project = '';
      let env = '';
      let q = '';

      for (let i = 1; i < filteredArgs.length; i++) {
        const a = filteredArgs[i];
        if (a === '--limit') limit = parseInt(filteredArgs[++i], 10);
        else if (a === '--project') project = filteredArgs[++i];
        else if (a === '--env') env = filteredArgs[++i];
        else if (a === '--query' || a === '-q') q = filteredArgs[++i];
      }

      const params = new URLSearchParams({ limit: limit.toString() });
      if (project) params.set('project_id', project);
      if (env) params.set('environment', env);
      if (q) params.set('query', q);

      const res = await request('GET', `/api/v1/agent/queue?${params.toString()}`);
      const data = res.json();

      printOutput(data, (body) => {
        const issues = body.issues || [];
        console.log(`\nUnresolved Production Queue (${issues.length} issues):\n`);
        if (issues.length === 0) {
          console.log('  All clear! No unresolved issues.');
          return;
        }
        for (const iss of issues) {
          const count = String(iss.event_count || 1).padStart(5, ' ');
          const title = iss.title || 'Unknown error';
          console.log(`  [${count} ev] ${iss.id} - ${title}`);
          if (iss.culprit) {
            console.log(`          Culprit: ${iss.culprit}`);
          }
        }
        console.log('');
      });
      break;
    }

    case 'context': {
      const issueId = filteredArgs[1];
      if (!issueId) {
        throw new Error('Usage: epure context <issue_id> [--format markdown|json]');
      }

      let format = 'markdown';
      for (let i = 2; i < filteredArgs.length; i++) {
        if (filteredArgs[i] === '--format') format = filteredArgs[++i];
      }

      const params = new URLSearchParams({ issue_id: issueId, format });
      const res = await request('GET', `/api/v1/agent/context?${params.toString()}`);

      if (format === 'markdown') {
        console.log(res.text);
      } else {
        printOutput(res.json());
      }
      break;
    }

    case 'issue': {
      if (subCmd === 'show') {
        const issueId = filteredArgs[2];
        if (!issueId) {
          throw new Error('Usage: epure issue show <issue_id>');
        }
        const res = await request('GET', `/api/v1/agent/issues/${issueId}`);
        printOutput(res.json());
      } else {
        throw new Error(`Unknown issue command: ${subCmd}. Usage: epure issue show <issue_id>`);
      }
      break;
    }

    case 'triage': {
      const action = subCmd;
      const issueId = filteredArgs[2];

      if (!action || !issueId) {
        throw new Error(
          'Usage: epure triage <resolve|ignore|reopen|snooze> <issue_id> [flags]'
        );
      }

      let payload = { action };

      for (let i = 3; i < filteredArgs.length; i++) {
        const a = filteredArgs[i];
        if (a === '--release') payload.release = filteredArgs[++i];
        else if (a === '--commit') payload.commit_sha = filteredArgs[++i];
        else if (a === '--mode') payload.snooze_mode = filteredArgs[++i];
        else if (a === '--hours') payload.snooze_hours = parseInt(filteredArgs[++i], 10);
        else if (a === '--count') payload.snooze_count = parseInt(filteredArgs[++i], 10);
      }

      const res = await request('POST', `/api/v1/agent/issues/${issueId}/triage`, payload);
      printOutput(res.json(), (data) => {
        console.log(`\n✓ Issue ${issueId} triaged: ${data.status || action}\n`);
      });
      break;
    }

    case 'alerts': {
      let view = '';
      for (let i = 1; i < filteredArgs.length; i++) {
        if (filteredArgs[i] === '--view') view = filteredArgs[++i];
      }
      const params = new URLSearchParams();
      if (view) params.set('view', view);

      const res = await request('GET', `/api/v1/agent/alerts?${params.toString()}`);
      printOutput(res.json());
      break;
    }

    case 'api': {
      const method = (filteredArgs[1] || 'GET').toUpperCase();
      const path = filteredArgs[2];
      if (!path) {
        throw new Error('Usage: epure api <METHOD> <PATH> [JSON_BODY]');
      }
      const rawBody = filteredArgs[3] || null;
      const res = await request(method, path, rawBody);
      printOutput(res.json());
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exit(1);
  }
}

handleCommand().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exit(1);
});
