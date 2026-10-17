#!/usr/bin/env node

/**
 * @epure-sh/cli - Official Command-Line Interface for Epure
 * Triage errors, inspect issue queues, demangle stack traces, and manage workspaces.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

const VERSION = '0.1.7';

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
@epure-sh/cli - Epure Command-Line Interface (v${VERSION})

Usage:
  npx @epure-sh/cli <command> [options]
  epure <command> [options]

Core Commands:
  auth whoami                 Verify your active token and organization role
  queue                       List unresolved production issue queue
  context <issue_id>          Export demangled stack trace and code lines for an issue
  issue show <issue_id>       View full metadata for a specific issue
  triage resolve <issue_id>   Mark an issue resolved (optional: --release <rel>)
  triage ignore <issue_id>    Ignore an issue from alerting
  triage reopen <issue_id>    Reopen a resolved or ignored issue
  triage snooze <issue_id>    Snooze an issue (optional: --mode hours|count)
  alerts                      List recent alerting events (optional: --view unread)
  api <METHOD> <PATH>         Execute raw authenticated API call against workspace

Global Options:
  --token, -t <token>         Epure Personal Access Token (or EPURE_TOKEN env var)
  --url, -u <url>             Epure endpoint (default: https://epure.sh or EPURE_URL)
  --output, -o <json|table>   Output format (default: json)
  --help, -h                  Display this help message
  --version, -v               Display CLI version

Examples:
  export EPURE_TOKEN="epk_live_..."
  npx @epure-sh/cli auth whoami
  npx @epure-sh/cli --output table queue --limit 20
  npx @epure-sh/cli context 550e8400-e29b-41d4-a716-446655440000 --format markdown
  npx @epure-sh/cli triage resolve 550e8400-e29b-41d4-a716-446655440000 --release v1.2.0
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
let token = process.env.EPURE_TOKEN || '';
let baseUrl = process.env.EPURE_URL || 'https://epure.sh';
let outputFormat = 'json';

const filteredArgs = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--token' || arg === '-t') {
    token = args[++i];
  } else if (arg.startsWith('--token=')) {
    token = arg.split('=')[1];
  } else if (arg === '--url' || arg === '-u') {
    baseUrl = args[++i];
  } else if (arg.startsWith('--url=')) {
    baseUrl = arg.split('=')[1];
  } else if (arg === '--output' || arg === '-o') {
    outputFormat = args[++i];
  } else if (arg.startsWith('--output=')) {
    outputFormat = arg.split('=')[1];
  } else {
    filteredArgs.push(arg);
  }
}

baseUrl = baseUrl.replace(/\/+$/, '');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    if (!token && !path.startsWith('/api/v1/auth/')) {
      return reject(new Error('EPURE_TOKEN is required. Pass --token <token> or export EPURE_TOKEN="epk_..."'));
    }

    const fullUrl = path.startsWith('http://') || path.startsWith('https://') ? path : `${baseUrl}${path}`;
    const urlObj = new URL(fullUrl);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

    const reqHeaders = {
      'User-Agent': `@epure-sh/cli/${VERSION}`,
      ...headers,
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
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
              errDetail = parsed.error || parsed.message || resBody;
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

  switch (cmd) {
    case 'auth': {
      if (subCmd === 'whoami') {
        const res = await request('GET', '/api/v1/agent/whoami');
        printOutput(res.json(), (data) => {
          console.log('\nAuthenticated Agent Identity:');
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
        else if (a === '--q') q = filteredArgs[++i];
      }

      let path = `/api/v1/agent/queue?limit=${limit}`;
      if (project) path += `&project_id=${encodeURIComponent(project)}`;
      if (env) path += `&environment=${encodeURIComponent(env)}`;
      if (q) path += `&q=${encodeURIComponent(q)}`;

      const res = await request('GET', path);
      const data = res.json();
      printOutput(data, (queue) => {
        const issues = Array.isArray(queue) ? queue : queue.issues || [];
        if (issues.length === 0) {
          console.log('No unresolved issues in queue.');
          return;
        }
        console.log(`\nUnresolved Queue (${issues.length} issues):`);
        console.log('─'.repeat(100));
        console.log(
          'ID'.padEnd(38) +
            'LEVEL'.padEnd(10) +
            'EVENTS'.padEnd(10) +
            'USERS'.padEnd(10) +
            'TITLE'
        );
        console.log('─'.repeat(100));
        for (const item of issues) {
          const id = (item.id || '').padEnd(38);
          const lvl = (item.level || 'error').padEnd(10);
          const evts = String(item.event_count || item.events || 1).padEnd(10);
          const users = String(item.unique_user_count || item.users || 1).padEnd(10);
          const title = (item.title || item.fingerprint || '').slice(0, 40);
          console.log(`${id}${lvl}${evts}${users}${title}`);
        }
        console.log('─'.repeat(100) + '\n');
      });
      break;
    }

    case 'context': {
      const issueId = filteredArgs[1];
      if (!issueId) {
        throw new Error('Usage: epure context <issue_id> [--format markdown|json] [--out <file>]');
      }

      let format = 'markdown';
      let outFile = '';
      for (let i = 2; i < filteredArgs.length; i++) {
        const a = filteredArgs[i];
        if (a === '--format') format = filteredArgs[++i];
        else if (a === '--out') outFile = filteredArgs[++i];
      }

      const res = await request('GET', `/api/v1/agent/issues/${issueId}/context?format=${format}`);
      const content = format === 'markdown' ? res.text : JSON.stringify(res.json(), null, 2);

      if (outFile) {
        fs.writeFileSync(outFile, content, 'utf8');
        console.log(`Saved context for issue ${issueId} to ${outFile}`);
      } else {
        console.log(content);
      }
      break;
    }

    case 'issue': {
      if (subCmd === 'show') {
        const issueId = filteredArgs[2];
        if (!issueId) throw new Error('Usage: epure issue show <issue_id>');
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
      if (!issueId) {
        throw new Error(`Usage: epure triage ${action || 'resolve|ignore|reopen|snooze'} <issue_id>`);
      }

      if (action === 'resolve') {
        let release = '';
        for (let i = 3; i < filteredArgs.length; i++) {
          if (filteredArgs[i] === '--release') release = filteredArgs[++i];
        }
        const body = { status: 'resolved' };
        if (release) body.resolved_in_release = release;
        const res = await request('PATCH', `/api/v1/issues/${issueId}`, body);
        printOutput(res.json());
      } else if (action === 'ignore') {
        const res = await request('PATCH', `/api/v1/issues/${issueId}`, { status: 'ignored' });
        printOutput(res.json());
      } else if (action === 'reopen') {
        const res = await request('PATCH', `/api/v1/issues/${issueId}`, { status: 'unresolved' });
        printOutput(res.json());
      } else if (action === 'snooze') {
        let mode = 'hours';
        for (let i = 3; i < filteredArgs.length; i++) {
          if (filteredArgs[i] === '--mode') mode = filteredArgs[++i];
        }
        const res = await request('POST', `/api/v1/issues/${issueId}/snooze`, { mode });
        printOutput(res.json());
      } else {
        throw new Error(`Unknown triage action: ${action}. Use: resolve, ignore, reopen, or snooze`);
      }
      break;
    }

    case 'alerts': {
      let view = 'unread';
      let project = '';
      let limit = 20;

      for (let i = 1; i < filteredArgs.length; i++) {
        const a = filteredArgs[i];
        if (a === '--view') view = filteredArgs[++i];
        else if (a === '--project') project = filteredArgs[++i];
        else if (a === '--limit') limit = parseInt(filteredArgs[++i], 10);
      }

      let path = `/api/v1/alerts?view=${view}&limit=${limit}`;
      if (project) path += `&project_id=${encodeURIComponent(project)}`;

      const res = await request('GET', path);
      printOutput(res.json());
      break;
    }

    case 'api': {
      const method = (filteredArgs[1] || 'GET').toUpperCase();
      const apiPath = filteredArgs[2];
      if (!apiPath) throw new Error('Usage: epure api <METHOD> <PATH> [--body <json>]');

      let body = null;
      for (let i = 3; i < filteredArgs.length; i++) {
        if (filteredArgs[i] === '--body') body = filteredArgs[++i];
      }

      const res = await request(method, apiPath, body);
      printOutput(res.json());
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

handleCommand().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
