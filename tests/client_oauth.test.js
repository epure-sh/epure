'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const readline = require('node:readline');
const exec = promisify(execFile);
const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'packages/epure-cli/bin/epure-cli.js');
const MCP = path.join(ROOT, 'packages/epure-mcp/bin/epure-mcp.js');
const auth = require('../packages/epure-cli/lib/auth');
const { operations, buildRequest } = require('../packages/epure-cli/lib/operations');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'epure-oauth-tests-'));
process.env.XDG_CONFIG_HOME = config;
delete process.env.EPURE_TOKEN;
after(() => fs.rmSync(config, { recursive: true, force: true }));
async function server(handler) {
  const requests = [];
  const s = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = req.headers['content-type']?.startsWith('application/json') ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw));
    requests.push({ method: req.method, url: req.url, headers: req.headers, body });
    res.setHeader('Content-Type', 'application/json');
    await handler(req, res, body, requests);
  });
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${s.address().port}`;
  return { url, requests, close: () => new Promise(resolve => { s.close(resolve); s.closeAllConnections(); }) };
}
const credentials = (extra = {}) => ({ access_token: 'oauth-access-private', refresh_token: 'oauth-refresh-private', expires_in: 3600, scope: 'read:agent write:triage write:admin', user_id: 'user', org_id: 'org', ...extra });
function seed(url, extra = {}) { auth.saveInstance(url, { ...credentials(), client_id: 'epure-cli', expires_at: Date.now() / 1000 + 3600, scopes: ['read:agent', 'write:triage', 'write:admin'], ...extra }); }
async function cli(args, extra = {}) {
  try { const r = await exec(process.execPath, [CLI, ...args], { env: { ...process.env, XDG_CONFIG_HOME: config, ...extra }, timeout: 10000 }); return { ...r, code: 0 }; }
  catch (e) { return { stdout: e.stdout, stderr: e.stderr, code: e.code }; }
}
function rpcClient(args = []) {
  const child = spawn(process.execPath, [MCP, ...args], { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let next = 0, stderr = ''; const pending = new Map();
  child.stderr.on('data', d => { stderr += d; });
  readline.createInterface({ input: child.stdout }).on('line', line => { const r = JSON.parse(line); const p = pending.get(r.id); if (p) { clearTimeout(p.timer); pending.delete(r.id); p.resolve(r); } });
  function call(method, params = {}) { const id = ++next; return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('MCP timeout')), 5000); pending.set(id, { resolve, timer }); child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`); }); }
  return { call, child, stderr: () => stderr, close: () => { child.stdin.end(); child.kill(); for (const p of pending.values()) clearTimeout(p.timer); } };
}
test('both packages ship identical shared runtime and OAuth-only help', async () => {
  for (const file of fs.readdirSync(path.join(ROOT, 'packages/epure-cli/lib'))) assert.equal(fs.readFileSync(path.join(ROOT, 'packages/epure-cli/lib', file), 'utf8'), fs.readFileSync(path.join(ROOT, 'packages/epure-mcp/lib', file), 'utf8'), file);
  const r = await cli(['--help']); assert.equal(r.code, 0); assert.match(r.stdout, /auth login/); assert.doesNotMatch(r.stdout, /--token|EPURE_TOKEN|canary/);
  assert.equal((await cli(['--token', 'must-never-leak', 'projects', 'list'])).code, 2);
  assert.equal((await cli(['projects', 'list'], { EPURE_TOKEN: 'must-never-leak' })).code, 2);
  assert.doesNotMatch((await cli(['--token', 'must-never-leak'])).stderr, /must-never-leak/);
});
test('instance validation blocks unsafe origins and hides malformed credentials', () => {
  for (const url of ['http://evil.example', 'https://user:secret@host.test', 'https://host.test/path', 'https://host.test?q=1']) assert.throws(() => auth.normalizeUrl(url), /HTTPS/);
  assert.equal(auth.normalizeUrl('app.epure.sh'), 'https://app.epure.sh'); assert.equal(auth.normalizeUrl('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
});
test('noninteractive commands fail quickly without opening login; manual legacy entries are rejected', async () => {
  const url = 'http://127.0.0.1:1';
  let r = await cli(['projects', 'list', '--url', url]); assert.equal(r.code, 4); assert.equal(r.stdout, ''); assert.match(JSON.parse(r.stderr).error.code, /AUTH_REQUIRED/);
  seed(url, { refresh_token: undefined }); r = await cli(['projects', 'list', '--url', url]); assert.equal(r.code, 4);
});
test('resource flags, stdin/file JSON, field selection, query encoding and destructive safeguards', async t => {
  const s = await server((req, res, body) => res.end(JSON.stringify(req.method === 'GET' ? { projects: [{ id: 'p1', name: 'App', private: true }] } : { id: 'p1', ...body })));
  t.after(s.close); seed(s.url);
  let r = await cli(['projects', 'create', '--name', 'Real app', '--url', s.url]); assert.equal(r.code, 0, r.stderr); assert.equal(JSON.parse(r.stdout).name, 'Real app');
  r = await cli(['projects', 'list', '--url', s.url, '--fields', 'id,name']); assert.deepEqual(JSON.parse(r.stdout), { projects: [{ id: 'p1', name: 'App' }] });
  r = await cli(['issues', 'list', '--q', 'a & b', '--limit', '7', '--url', s.url]); assert.equal(r.code, 0); assert.match(s.requests.at(-1).url, /q=a\+%26\+b/); assert.match(s.requests.at(-1).url, /limit=7/);
  const data = path.join(config, 'request.json'); fs.writeFileSync(data, '{"paused":true}');
  r = await cli(['monitors', 'update', 'm1', '--data', `@${data}`, '--url', s.url]); assert.equal(JSON.parse(r.stdout).paused, true);
  assert.equal((await cli(['projects', 'delete', 'p1', '--url', s.url])).code, 2);
  assert.equal((await cli(['projects', 'delete', 'p1', '--yes', '--url', s.url])).code, 0);
  const count = s.requests.length;
  assert.equal((await cli(['projects', 'create', '--naem', 'bad', '--url', s.url])).code, 2);
  assert.equal((await cli(['issues', 'list', '--limit', 'nan', '--url', s.url])).code, 2);
  assert.equal((await cli(['api', 'POST', '/api/v1/agent-tokens', '--data', '{}', '--url', s.url])).code, 2);
  assert.equal((await cli(['api', 'GET', '/api/v1/projects/../auth/me', '--url', s.url])).code, 2);
  assert.equal(s.requests.length, count);
  assert.equal(s.requests[0].headers.authorization, 'Bearer oauth-access-private');
});
test('schema discovery is paginated, signed-out and contains only implemented routes', async () => {
  const r = await cli(['api-catalog', '--search', 'monitors', '--limit', '2']); const data = JSON.parse(r.stdout); assert.equal(data.operations.length, 2); assert.ok(data.next_offset);
  const raw = require('../packages/epure-cli/lib/api-catalog.json');
  for (const op of operations) assert.ok(raw.some(r => r.method === op.method && r.path === op.path), op.id);
  assert.equal((await cli(['nonsense'])).code, 2);
});
test('browser PKCE checks state, exchanges verifier, and never prints credentials', async t => {
  let approval, callback;
  const s = await server((req, res, body) => {
    assert.equal(body.grant_type, 'authorization_code'); assert.equal(body.client_id, 'epure-cli');
    assert.equal(crypto.createHash('sha256').update(body.code_verifier).digest('base64url'), approval.searchParams.get('code_challenge'));
    assert.equal(body.redirect_uri, approval.searchParams.get('redirect_uri'));
    res.end(JSON.stringify(credentials()));
  }); t.after(s.close);
  const logs = [];
  const login = auth.loginLoopback(s.url, { log: text => logs.push(text), openBrowser: value => {
    approval = new URL(value);
    callback = (async () => { const bad = await fetch(`${approval.searchParams.get('redirect_uri')}?state=wrong&code=code`); assert.equal(bad.status, 400); const q = new URLSearchParams({ state: approval.searchParams.get('state'), code: 'approved-code' }); const ok = await fetch(`${approval.searchParams.get('redirect_uri')}?${q}`); assert.equal(ok.status, 200); })();
  } });
  const status = await login; await callback;
  assert.equal(status.authenticated, true); assert.doesNotMatch(JSON.stringify(status) + logs.join(), /oauth-access-private|oauth-refresh-private/);
  if (process.platform !== 'win32') assert.equal(fs.statSync(auth.getCredentialsPath()).mode & 0o777, 0o600);
});
test('device OAuth handles pending, slow_down, denial, expiry and successful shared session', async t => {
  let states = ['authorization_pending', 'slow_down', 'ok']; const waits = [];
  const s = await server((req, res) => {
    if (req.url === '/oauth/device/code') { assert.match(req.headers['content-type'], /json/); res.end(JSON.stringify({ device_code: 'device', user_code: 'ABCD', verification_uri: `${s.url}/oauth/device`, interval: 1, expires_in: 120 })); }
    else { const state = states.shift(); if (state === 'ok') res.end(JSON.stringify(credentials())); else { res.statusCode = 400; res.end(JSON.stringify({ error: state })); } }
  }); t.after(s.close);
  const opts = { noBrowser: true, log: () => {}, sleep: async ms => waits.push(ms) };
  const status = await auth.loginDeviceCode(s.url, opts); assert.equal(status.authenticated, true); assert.deepEqual(waits, [1000, 1000, 6000]);
  states = ['access_denied']; await assert.rejects(auth.loginDeviceCode(s.url, opts), e => e.code === 'access_denied');
  states = ['expired_token']; await assert.rejects(auth.loginDeviceCode(s.url, opts), e => e.code === 'expired_token');
  const r = await cli(['auth', 'status', '--url', s.url]); assert.equal(JSON.parse(r.stdout).authenticated, true); assert.doesNotMatch(r.stdout, /oauth-access-private|oauth-refresh-private/);
});
test('refresh rotation is serialized across processes and fails closed', async t => {
  let refreshes = 0, fail = false;
  const s = await server(async (req, res) => {
    if (req.url === '/oauth/token') { refreshes++; await new Promise(r => setTimeout(r, 80)); if (fail) { res.statusCode = 400; res.end('{"error":"invalid_grant"}'); } else res.end(JSON.stringify(credentials({ access_token: 'rotated-access', refresh_token: 'rotated-refresh' }))); }
    else { assert.equal(req.headers.authorization, 'Bearer rotated-access'); res.end('{"projects":[]}'); }
  }); t.after(s.close); seed(s.url, { expires_at: 1 });
  const results = await Promise.all([cli(['projects', 'list', '--url', s.url]), cli(['projects', 'list', '--url', s.url])]);
  for (const r of results) assert.equal(r.code, 0, r.stderr); assert.equal(refreshes, 1);
  fail = true; seed(s.url, { expires_at: 1 }); const r = await cli(['projects', 'list', '--url', s.url]); assert.equal(r.code, 4); assert.equal(s.requests.filter(r => r.url === '/api/v1/projects').length, 2);
});
test('401 retries once after OAuth refresh; permission errors are actionable and redacted', async t => {
  let reads = 0;
  const s = await server((req, res) => {
    if (req.url === '/oauth/token') res.end(JSON.stringify(credentials({ access_token: 'new-access' })));
    else if (++reads === 1) { res.statusCode = 401; res.end('{}'); }
    else { res.statusCode = 403; res.end('{"private":"oauth-refresh-private"}'); }
  }); t.after(s.close); seed(s.url);
  const r = await cli(['projects', 'list', '--url', s.url]); assert.equal(r.code, 5); assert.match(r.stderr, /approved scopes/); assert.doesNotMatch(r.stderr, /oauth-refresh-private/); assert.equal(reads, 2);
});
test('logout revokes remotely, removes local session, and reports unavailable revocation honestly', async t => {
  let fail = false;
  const s = await server((req, res, body) => { assert.equal(req.url, '/oauth/revoke'); assert.equal(body.token, 'oauth-refresh-private'); if (fail) res.statusCode = 503; res.end('{}'); }); t.after(s.close); seed(s.url);
  let r = await cli(['auth', 'logout', '--url', s.url]); assert.equal(JSON.parse(r.stdout).revoked, true); assert.equal(auth.getActiveCredentials(s.url), null);
  fail = true; seed(s.url); r = await cli(['auth', 'logout', '--url', s.url]); assert.match(JSON.parse(r.stdout).warning, /Remote revocation failed/); assert.equal(auth.getActiveCredentials(s.url), null);
});
test('MCP negotiates versions, lists typed tools, uses REST, returns structured errors and honors read-only mode', async t => {
  const s = await server((req, res) => res.end('{"projects":[{"id":"p1","name":"App"}]}')); t.after(s.close); seed(s.url);
  const mcp = rpcClient(['--url', s.url, '--read-only', '--toolsets', 'projects']); t.after(mcp.close);
  assert.equal((await mcp.call('tools/list')).error.code, -32002);
  const init = await mcp.call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }); assert.equal(init.result.protocolVersion, '2025-06-18');
  const list = await mcp.call('tools/list'); assert.ok(list.result.tools.some(t => t.name === 'epure_projects_list')); assert.ok(!list.result.tools.some(t => t.name === 'epure_projects_create'));
  const data = await mcp.call('tools/call', { name: 'epure_projects_list', arguments: {} }); assert.equal(data.result.structuredContent.projects[0].id, 'p1');
  const invalid = await mcp.call('tools/call', { name: 'epure_projects_list', arguments: { secret: 'x' } }); assert.equal(invalid.result.isError, true);
  const write = await mcp.call('tools/call', { name: 'epure_action', arguments: { operation: 'projects.create', arguments: { name: 'App' } } }); assert.equal(write.result.isError, true);
  const raw = await mcp.call('tools/call', { name: 'epure_api', arguments: { method: 'POST', path: '/api/v1/projects', body: { name: 'App' } } }); assert.equal(raw.result.isError, true);
  assert.equal(s.requests.length, 1); assert.equal(mcp.stderr(), '');
  const routes = await mcp.call('tools/call', { name: 'epure_discover', arguments: {} }); assert.ok(routes.result.structuredContent.operations.every(o => o.resource === 'projects' && o.method === 'GET'));
  assert.equal((await mcp.call('unsupported')).error.code, -32601);
});
test('signed-out MCP discovery works and tools fail immediately with sign-in instructions', async t => {
  const mcp = rpcClient(['--url', 'http://127.0.0.1:2']); t.after(mcp.close);
  await mcp.call('initialize', { protocolVersion: 'future' });
  const discover = await mcp.call('tools/call', { name: 'epure_discover', arguments: { resource: 'rules', limit: 2 } }); assert.equal(discover.result.structuredContent.operations.length, 2);
  const result = await mcp.call('tools/call', { name: 'epure_projects_list', arguments: {} }); assert.equal(result.result.isError, true); assert.equal(result.result.structuredContent.error.code, 'AUTH_REQUIRED');
  const init = await exec(process.execPath, [MCP, 'init']); assert.doesNotMatch(init.stdout, /token|oauth-access-private|oauth-refresh-private/); assert.ok(JSON.parse(init.stdout).mcpServers.epure);
});
test('MCP discovered writes validate schemas and destructive actions require explicit confirmation', async t => {
  const s = await server((req, res, body) => res.end(JSON.stringify({ id: 'rule1', ...body }))); t.after(s.close); seed(s.url);
  const mcp = rpcClient(['--url', s.url]); t.after(mcp.close);
  await mcp.call('initialize', { protocolVersion: '2025-11-25' });
  const created = await mcp.call('tools/call', { name: 'epure_rules_create', arguments: { project_id: 'p1', name: 'Errors', kind: 'issue_created', enabled: false } });
  assert.equal(created.result.structuredContent.id, 'rule1'); assert.equal(s.requests.at(-1).body.enabled, false);
  const before = s.requests.length;
  const missing = await mcp.call('tools/call', { name: 'epure_action', arguments: { operation: 'rules.delete', arguments: { id: 'rule1' } } }); assert.equal(missing.result.structuredContent.error.code, 'CONFIRM_REQUIRED'); assert.equal(s.requests.length, before);
  const removed = await mcp.call('tools/call', { name: 'epure_action', arguments: { operation: 'rules.delete', arguments: { id: 'rule1' }, confirm: true } }); assert.ok(!removed.result.isError); assert.equal(s.requests.at(-1).method, 'DELETE');
  const identity = await mcp.call('tools/call', { name: 'epure_api', arguments: { method: 'POST', path: '/api/v1/auth/login', body: {} } }); assert.equal(identity.result.isError, true);
});
test('JSON stdin stays composable and invalid output modes never issue requests', async t => {
  const s = await server((req, res, body) => res.end(JSON.stringify(body))); t.after(s.close); seed(s.url);
  const child = spawn(process.execPath, [CLI, 'projects', 'create', '--data', '-', '--url', s.url], { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] }); let out = '', err = '';
  child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d); child.stdin.end('{"name":"Piped app"}');
  const code = await new Promise(resolve => child.on('close', resolve)); assert.equal(code, 0, err); assert.equal(JSON.parse(out).name, 'Piped app');
  const count = s.requests.length; assert.equal((await cli(['projects', 'create', '--name', 'A', '--output', 'bad', '--url', s.url])).code, 2); assert.equal(s.requests.length, count);
});
test('named destructive MCP tools expose confirmation in their schemas and execute when approved', async t => {
  const s = await server((req, res) => res.end('{"deleted":true}')); t.after(s.close); seed(s.url);
  const mcp = rpcClient(['--url', s.url, '--toolsets', 'projects']); t.after(mcp.close);
  await mcp.call('initialize', { protocolVersion: '2025-06-18' });
  const list = await mcp.call('tools/list'); const tool = list.result.tools.find(t => t.name === 'epure_projects_delete'); assert.ok(tool.inputSchema.required.includes('confirm'));
  const invalid = await mcp.call('tools/call', { name: 'epure_projects_delete', arguments: { id: 'p1' } }); assert.equal(invalid.result.isError, true); assert.equal(s.requests.length, 0);
  const removed = await mcp.call('tools/call', { name: 'epure_projects_delete', arguments: { id: 'p1', confirm: true } }); assert.equal(removed.result.structuredContent.deleted, true); assert.equal(s.requests.length, 1);
});
test('human issue tables show titles and identities; markdown context is complete', () => {
  const { output } = require('../packages/epure-cli/lib/cli'); const original = process.stdout.write; let text = '';
  process.stdout.write = value => { text += value; return true; };
  try {
    output({ queue: [{ priority_score: 9, issue: { id: '550e8400-e29b-41d4-a716-446655440000', title: 'Checkout failed', status: 'unresolved', event_count: 12 } }] }, { output: 'table' });
    assert.match(text, /Checkout failed/); assert.match(text, /550e8400-e29b-41d4-a716-446655440000/); assert.ok(text.split('\n').every(line => line.length <= 110));
    text = ''; const markdown = '# Exception\n' + 'frame details\n'.repeat(30); output(markdown, { output: 'table' }); assert.equal(text, markdown);
  } finally { process.stdout.write = original; }
});

test('hosted registry is generated from canonical tool schemas and task search finds hidden setup workflows', () => {
 const {operations,searchOperations}=require('../packages/epure-cli/lib/operations');
 const {toolsFor,INSTRUCTIONS}=require('../packages/epure-cli/lib/mcp');
 const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'crates/mcp/registry.json'),'utf8'));
 const tools=toolsFor().tools;
 assert.equal(registry.tools.length,tools.length);assert.equal(registry.instructions,INSTRUCTIONS);
 for(const op of operations)assert.ok(tools.some(t=>t.name===`epure_${op.id.replace(/[.-]/g,'_')}`),op.id);
 assert.ok(searchOperations('email alert destination').some(o=>o.id==='channels.create'));
 assert.ok(searchOperations('cron heartbeat').some(o=>o.id==='monitors.create'));
 const descriptor=tools.find(t=>t.name==='epure_channels_create');assert.match(descriptor.inputSchema.properties.provider.description,/provider/);
 for(const file of ['operations.js','mcp.js'])assert.equal(fs.readFileSync(path.join(ROOT,'packages/epure-cli/lib',file),'utf8'),fs.readFileSync(path.join(ROOT,'packages/epure-mcp/lib',file),'utf8'));
});
