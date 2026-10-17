#!/usr/bin/env node

/**
 * @epure-sh/mcp - Surgical <600-token Model Context Protocol server for Epure
 * Implements MCP stdio transport with Agentjacking prompt-injection defense.
 */

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
  npx @epure-sh/mcp login [--endpoint <url>]
  claude mcp add epure -- npx -y @epure-sh/mcp

Options:
  --token, -t     Epure API PAT or Project Key (or EPURE_TOKEN env var)
  --endpoint, -e  Epure Cloud / self-hosted URL (default: saved credentials or https://epure.sh)
  --help, -h      Show this help message
`);
  process.exit(0);
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
