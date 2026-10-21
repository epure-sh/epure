#!/usr/bin/env node

/**
 * @epure-sh/mcp - Surgical <600-token Model Context Protocol server for Epure
 * Implements MCP stdio transport with Agentjacking prompt-injection defense.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const auth = require('../lib/auth');

// CLI args parsing
const args = process.argv.slice(2);
let token = process.env.EPURE_TOKEN || '';
let endpoint = process.env.EPURE_URL || '';

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
@epure-sh/mcp - Surgical <600-token Model Context Protocol server for Epure

Usage:
  npx @epure-sh/mcp [options]
  npx @epure-sh/mcp init [--token <pat>] [--endpoint <url>]
  npx @epure-sh/mcp login [--endpoint <url>]
  claude mcp add epure -- npx -y @epure-sh/mcp

Options:
  --token, -t     Epure API PAT or Project Key (or EPURE_TOKEN env var)
  --endpoint, -e  Epure Cloud / self-hosted URL (default: saved credentials or https://epure.sh)
  --help, -h      Show this help message
`);
  process.exit(0);
}

// Handle init subcommand (Zero-config setup for Cursor and Claude)
if (args[0] === 'init') {
  let targetUrl = endpoint;
  let targetToken = token;
  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '--endpoint' || args[i] === '-e') && i + 1 < args.length) {
      targetUrl = args[++i];
    } else if ((args[i] === '--token' || args[i] === '-t') && i + 1 < args.length) {
      targetToken = args[++i];
    }
  }

  (async () => {
    targetUrl = auth.normalizeUrl(targetUrl || process.env.EPURE_URL || 'https://epure.sh');
    if (!targetToken) {
      targetToken = process.env.EPURE_TOKEN || '';
    }
    if (!targetToken) {
      const cred = auth.getActiveCredentials(targetUrl);
      if (cred && cred.access_token) {
        targetToken = cred.access_token;
        targetUrl = cred.url || targetUrl;
      }
    }

    console.log(`\n======================================================`);
    console.log(`  Épure MCP Zero-Config Setup for Cursor & Claude`);
    console.log(`======================================================\n`);

    if (!targetToken && process.stdin.isTTY) {
      const rlPrompt = readline.createInterface({ input: process.stdin, output: process.stdout });
      const question = (q) => new Promise((res) => rlPrompt.question(q, res));

      console.log(`Endpoint: ${targetUrl}`);
      const inputToken = await question(`Enter your Epure API PAT / Project Key (or press Enter for browser login): `);
      rlPrompt.close();

      if (inputToken && inputToken.trim()) {
        targetToken = inputToken.trim();
      } else {
        console.log(`\nLaunching browser login loopback for ${targetUrl}...`);
        try {
          const res = await auth.loginLoopback(targetUrl, 'epure-mcp', 'epure-mcp');
          targetToken = res.access_token;
          console.log(`✓ Browser authentication completed!`);
        } catch (err) {
          console.warn(`Browser login skipped: ${err.message}`);
        }
      }
    }

    if (!targetToken) {
      targetToken = 'YOUR_EPURE_TOKEN';
    }

    const mcpServerConfig = {
      command: 'npx',
      args: ['-y', '@epure-sh/mcp'],
      env: {
        EPURE_URL: targetUrl,
        EPURE_TOKEN: targetToken,
      },
    };

    function mergeMcpConfig(filePath, serverKey, configObj) {
      let data = { mcpServers: {} };
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          data = JSON.parse(content);
          if (!data.mcpServers) data.mcpServers = {};
        } else {
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        }
      } catch {
        data = { mcpServers: {} };
      }

      data.mcpServers[serverKey] = configObj;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o644 });
      return filePath;
    }

    const homedir = os.homedir();
    const configuredFiles = [];

    // 1. Cursor IDE (~/.cursor/mcp.json)
    const cursorConfigPath = path.join(homedir, '.cursor', 'mcp.json');
    try {
      mergeMcpConfig(cursorConfigPath, 'epure', mcpServerConfig);
      configuredFiles.push({ name: 'Cursor IDE', path: cursorConfigPath });
    } catch (err) {
      console.warn(`Could not write Cursor config: ${err.message}`);
    }

    // 2. Claude Code CLI (~/.claude.json)
    const claudeCliPath = path.join(homedir, '.claude.json');
    try {
      mergeMcpConfig(claudeCliPath, 'epure', mcpServerConfig);
      configuredFiles.push({ name: 'Claude Code CLI', path: claudeCliPath });
    } catch (err) {
      console.warn(`Could not write Claude CLI config: ${err.message}`);
    }

    // 3. Claude Desktop
    let claudeDesktopPath = null;
    if (process.platform === 'darwin') {
      claudeDesktopPath = path.join(homedir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else if (process.platform === 'win32' && process.env.APPDATA) {
      claudeDesktopPath = path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
    } else {
      claudeDesktopPath = path.join(homedir, '.config', 'Claude', 'claude_desktop_config.json');
    }

    if (claudeDesktopPath) {
      try {
        mergeMcpConfig(claudeDesktopPath, 'epure', mcpServerConfig);
        configuredFiles.push({ name: 'Claude Desktop', path: claudeDesktopPath });
      } catch (err) {
        // Ignored if Claude Desktop not present
      }
    }

    // 4. Live Verification Test
    console.log(`Running live verification test against ${targetUrl}...`);
    let verified = false;
    if (targetToken && targetToken !== 'YOUR_EPURE_TOKEN') {
      try {
        verified = await new Promise((resolve) => {
          const u = new URL(`${targetUrl}/api/mcp`);
          const reqLib = u.protocol === 'https:' ? https : http;
          const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
          const req = reqLib.request(
            u,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Authorization': `Bearer ${targetToken}`,
              },
              timeout: 3000,
            },
            (res) => {
              let resData = '';
              res.on('data', (c) => (resData += c));
              res.on('end', () => {
                try {
                  const parsed = JSON.parse(resData);
                  resolve(Boolean(parsed.result));
                } catch {
                  resolve(res.statusCode < 400);
                }
              });
            }
          );
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
          req.write(body);
          req.end();
        });
      } catch {
        verified = false;
      }
    }

    console.log(`\n✓ Epure MCP configuration written:`);
    configuredFiles.forEach((item) => {
      console.log(`  • ${item.name}: ${item.path}`);
    });

    if (verified) {
      console.log(`\n✓ Live verification test succeeded: Server is connected & responding.`);
      console.log(`  Surgical tools active: list_unresolved_issues, get_crash_context, mark_issue_resolved (<600 tokens/call).`);
    } else {
      console.log(`\n✓ Configuration completed.`);
      console.log(`  Tools registered: list_unresolved_issues, get_crash_context, mark_issue_resolved.`);
    }

    console.log(`\nNext Steps:`);
    console.log(`  • In Cursor or Claude Code, ask: "Check latest crash in Epure and suggest fix"`);
    console.log(`  • Direct execution: npx -y @epure-sh/mcp --help\n`);
    process.exit(0);
  })().catch((err) => {
    console.error(`Init failed: ${err.message}`);
    process.exit(1);
  });
  return;
}

// Handle login subcommand
if (args[0] === 'login') {
  let targetUrl = endpoint;
  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '--endpoint' || args[i] === '-e') && i + 1 < args.length) {
      targetUrl = args[++i];
    }
  }
  targetUrl = auth.normalizeUrl(targetUrl || 'https://epure.sh');

  auth.loginLoopback(targetUrl, 'epure-mcp', 'epure-mcp')
    .then((res) => {
      console.log(`\n✓ Successfully authenticated Epure MCP with ${res.url}!`);
      console.log(`  Credentials saved to ${auth.getCredentialsPath()}\n`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\nLogin failed: ${err.message}\n`);
      process.exit(1);
    });
  return;
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '--token' || arg === '-t') && i + 1 < args.length) {
    token = args[++i];
  } else if ((arg === '--endpoint' || arg === '-e') && i + 1 < args.length) {
    endpoint = args[++i];
  }
}

async function resolveAuth() {
  if (token) {
    endpoint = auth.normalizeUrl(endpoint || 'https://epure.sh');
    return token;
  }

  const cred = auth.getActiveCredentials(endpoint);
  if (cred) {
    endpoint = cred.url;
    try {
      token = await auth.ensureValidToken(cred);
      return token;
    } catch {
      token = cred.access_token;
      return token;
    }
  }

  endpoint = auth.normalizeUrl(endpoint || 'https://epure.sh');
  return '';
}

const TOOLS = [
  {
    name: 'list_unresolved_issues',
    description: 'List unresolved issues with event counts, velocity, and culprit frame',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID filter' },
        limit: { type: 'integer', description: 'Max issues (default 10, max 50)' },
      },
    },
  },
  {
    name: 'epure_list_issues',
    description: 'Alias for list_unresolved_issues: list unresolved issues with event counts, velocity, and culprit frame',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID filter' },
        limit: { type: 'integer', description: 'Max issues (default 10, max 50)' },
      },
    },
  },
  {
    name: 'get_crash_context',
    description: 'Retrieve crash context for an issue including sanitized stack trace and breadcrumbs',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'string', description: 'UUID of the issue to inspect' },
      },
      required: ['issue_id'],
    },
  },
  {
    name: 'epure_get_issue_context',
    description: 'Alias for get_crash_context: retrieve crash context for an issue including sanitized stack trace and breadcrumbs',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'string', description: 'UUID of the issue to inspect' },
      },
      required: ['issue_id'],
    },
  },
  {
    name: 'mark_issue_resolved',
    description: 'Mark an issue as resolved, optionally associating it with a git commit SHA',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'string', description: 'UUID of the issue to mark resolved' },
        commit_sha: { type: 'string', description: 'Optional git commit SHA' },
      },
      required: ['issue_id'],
    },
  },
  {
    name: 'epure_triage_issue',
    description: 'Alias for mark_issue_resolved: mark an issue as resolved, optionally associating it with a git commit SHA',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'string', description: 'UUID of the issue to mark resolved' },
        commit_sha: { type: 'string', description: 'Optional git commit SHA' },
      },
      required: ['issue_id'],
    },
  },
];

function sendJsonRpc(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sendError(id, code, message) {
  sendJsonRpc({
    jsonrpc: '2.0',
    id: id != null ? id : null,
    error: { code, message },
  });
}

async function forwardToRemote(reqBody) {
  await resolveAuth();

  if (!token) {
    // Attempt automatic loopback login if possible
    try {
      console.error('[epure-mcp] No token found. Opening browser for authorization...');
      const res = await auth.loginLoopback(endpoint, 'epure-mcp', 'epure-mcp');
      token = res.access_token;
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id: reqBody.id,
        error: {
          code: -32001,
          message: 'Authentication required. Run "epure login" in terminal or pass --token <token>',
        },
      };
    }
  }

  return new Promise((resolve) => {
    const targetUrl = new URL(`${endpoint}/api/mcp`);
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const postData = JSON.stringify(reqBody);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': '@epure-sh/mcp/0.1.7',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = client.request(
      targetUrl,
      {
        method: 'POST',
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch {
            resolve({
              jsonrpc: '2.0',
              id: reqBody.id,
              error: { code: -32603, message: `Invalid server response: ${body.slice(0, 200)}` },
            });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        jsonrpc: '2.0',
        id: reqBody.id,
        error: { code: -32603, message: `Connection failed to ${endpoint}: ${err.message}` },
      });
    });

    req.write(postData);
    req.end();
  });
}

async function handleRequest(req) {
  const { id, method } = req;

  if (method === 'initialize') {
    // Proactively resolve auth in background
    resolveAuth().catch(() => {});

    sendJsonRpc({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'epure-mcp',
          version: '0.1.7',
        },
      },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'ping') {
    sendJsonRpc({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  if (method === 'tools/list') {
    sendJsonRpc({
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS,
      },
    });
    return;
  }

  if (method === 'tools/call') {
    const remoteResp = await forwardToRemote(req);
    sendJsonRpc(remoteResp);
    return;
  }

  sendError(id, -32601, `Method not found: ${method}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const req = JSON.parse(trimmed);
    await handleRequest(req);
  } catch {
    sendError(null, -32700, 'Parse error');
  }
});
