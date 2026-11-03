'use strict';
const fs = require('node:fs');
const auth = require('./auth');
const { operations, catalog, validate, buildRequest, discover } = require('./operations');
const { apiRequest } = require('./api');
const BOOL = new Set(['help', 'version', 'json', 'yes', 'device', 'no-browser', 'read-only']);
function parse(argv) {
  const words = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') { words.push(...argv.slice(i + 1)); break; }
    if (!arg.startsWith('-')) { words.push(arg); continue; }
    const normalized = ({ '-h': '--help', '-v': '--version', '-y': '--yes', '-u': '--url' })[arg] || arg;
    if (!normalized.startsWith('--')) throw new auth.ClientError('INVALID_ARGUMENT', `Unknown option ${arg}. Use --help.`, 2);
    const eq = normalized.indexOf('='); const key = normalized.slice(2, eq < 0 ? undefined : eq);
    if (['token', 'secret', 'api-key'].includes(key)) throw new auth.ClientError('OAUTH_ONLY', 'Manual credentials are no longer supported. Run epure auth login.', 2);
    if (flags[key] !== undefined) throw new auth.ClientError('INVALID_ARGUMENT', `Repeated option --${key}.`, 2);
    if (BOOL.has(key)) { if (eq >= 0) throw new auth.ClientError('INVALID_ARGUMENT', `--${key} does not take a value.`, 2); flags[key] = true; }
    else { const value = eq < 0 ? argv[++i] : normalized.slice(eq + 1); if (value === undefined || value.startsWith('--')) throw new auth.ClientError('INVALID_ARGUMENT', `--${key} needs a value.`, 2); flags[key] = value; }
  }
  return { words, flags };
}
function jsonInput(value) {
  if (value === undefined) return {};
  const raw = value === '-' ? fs.readFileSync(0, 'utf8') : value.startsWith('@') ? fs.readFileSync(value.slice(1), 'utf8') : value;
  try { const data = JSON.parse(raw); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); return data; }
  catch { throw new auth.ClientError('INVALID_JSON', 'Expected a JSON object: --data JSON, --data @file.json, or --data - for stdin.', 2); }
}
function coerce(value, schema) {
  if (schema.type === 'boolean') { if (!['true', 'false'].includes(value)) throw new auth.ClientError('INVALID_ARGUMENT', 'Boolean options require true or false.', 2); return value === 'true'; }
  if (['integer', 'number'].includes(schema.type)) { if (!value.trim()) return NaN; return Number(value); }
  if (['object', 'array'].includes(schema.type)) { try { return JSON.parse(value); } catch { throw new auth.ClientError('INVALID_JSON', 'Object and array options require JSON.', 2); } }
  return value;
}
function pickFields(item, fields) {
  if (!fields) return item;
  if (!item || typeof item !== 'object') return item;
  const select = row => Object.fromEntries(fields.split(',').map(k => [k, k.split('.').reduce((v, p) => v?.[p], row)]));
  if (Array.isArray(item)) return item.map(select);
  const entries = Object.entries(item); const list = entries.find(([, v]) => Array.isArray(v));
  return list ? { ...item, [list[0]]: list[1].map(select) } : select(item);
}
function output(data, flags = {}) {
  data = pickFields(data, flags.fields);
  const format = flags.json ? 'json' : flags.output || (process.stdout.isTTY ? 'table' : 'json');
  if (format === 'json') { process.stdout.write(`${JSON.stringify(data, null, 2)}\n`); return; }
  if (format === 'table' && typeof data === 'string') { process.stdout.write(data.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '') + (data.endsWith('\n') ? '' : '\n')); return; }
  if (format === 'table' && Array.isArray(data?.queue)) data = data.queue.map(row => row.issue ? { id: row.issue.id, title: row.issue.title, status: row.issue.status, events: row.issue.event_count, score: row.priority_score } : row);
  const list = data && !Array.isArray(data) && typeof data === 'object' ? Object.values(data).find(v => Array.isArray(v) && (!v.length || typeof v[0] === 'object')) : null;
  const rows = (Array.isArray(data) ? data : list || [data]).map(r => r && typeof r === 'object' ? r : { value: r });
  if (format === 'ndjson') { for (const row of rows) process.stdout.write(`${JSON.stringify(row)}\n`); return; }
  if (format !== 'table') throw new auth.ClientError('INVALID_ARGUMENT', 'Choose --output json, table, or ndjson.', 2);
  const safe = v => String(typeof v === 'object' ? JSON.stringify(v) : v ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, 100);
  if (!rows.length) { process.stdout.write('No results.\n'); return; }
  const available = [...new Set(rows.flatMap(r => Object.keys(r || {})))];
  const preferred = ['id', 'name', 'title', 'status', 'events', 'score', 'slug', 'provider', 'label', 'kind', 'paused', 'authenticated', 'instance'];
  const keys = (flags.fields ? available : [...preferred.filter(k => available.includes(k)), ...available.filter(k => !preferred.includes(k))]).slice(0, flags.fields ? 10 : 5);
  const cells = [keys, ...rows.map(r => keys.map(k => safe(r?.[k])))];
  const widths = keys.map((key, i) => Math.min(key === 'id' ? 36 : 50, Math.max(...cells.map(r => r[i]?.length || 0))));
  const budget = Math.max(60, process.stdout.columns || 110) - (keys.length - 1) * 2;
  while (widths.reduce((a, b) => a + b, 0) > budget) { const candidates = widths.map((w, i) => ({ w, i })).filter(({ w, i }) => keys[i] !== 'id' && w > Math.max(8, keys[i].length)).sort((a, b) => b.w - a.w); if (!candidates.length) break; widths[candidates[0].i]--; }
  for (const row of cells) process.stdout.write(`${row.map((v, i) => safe(v).slice(0, widths[i]).padEnd(widths[i])).join('  ').trimEnd()}\n`);
}
function help(words = []) {
  const resource = words[0]; const op = operations.find(o => o.resource === resource && o.action === words[1]);
  if (op) {
    const id = [...op.path.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
    return `epure ${resource} ${op.action}${id.map(p => ` <${p}>`).join('')}\n${op.method} ${op.path}\n${Object.entries(op.inputSchema.properties).filter(([k]) => !id.includes(k)).map(([k, s]) => `  --${k.replaceAll('_', '-')} <${s.enum?.join('|') || s.type}>${op.inputSchema.required.includes(k) ? ' (required)' : ''}`).join('\n')}\nUse --data JSON|@file|- for a JSON object. ${op.destructive ? 'Requires --yes. ' : ''}Use epure schema ${op.id} for the exact schema.\n${commonHelp()}`;
  }
  if (resource === 'auth') return `epure auth login [--device] [--no-browser] [--scope "read:agent write:triage write:admin"]\nepure auth status | whoami | logout | instances\nepure auth use <https://instance>\nOAuth approval is shared with Epure MCP. Only explicit login opens a browser.\n${commonHelp()}`;
  if (resource && operations.some(o => o.resource === resource)) return `epure ${resource} <action>\n${operations.filter(o => o.resource === resource).map(o => `  ${o.action.padEnd(20)} ${o.method} ${o.path}`).join('\n')}\nUse epure ${resource} <action> --help for flags.\n${commonHelp()}`;
  return `Epure — manage errors, alerts and cron monitors\n\nStart: epure auth login\n       epure issues list --limit 20\n       epure projects create --name "My app"\n       epure rules create --project-id ID --name "New errors" --kind issue_created\n       epure monitors create --project-id ID --slug backup --schedule "0 * * * *"\n\nResources: ${[...new Set(operations.map(o => o.resource))].join(', ')}\n\nDiscover: epure <resource> --help\n          epure schema issues.context\n          epure api-catalog --search monitors\nAdvanced: epure api GET /api/v1/projects\n          epure api PATCH /api/v1/monitors/ID --data '{"paused":true}'\n${commonHelp()}`;
}
function commonHelp() { return '\nOptions: --url HTTPS_ORIGIN  --json  --output json|table|ndjson\n         --fields id,name  --yes (destructive actions)  --help\nPiped output defaults to JSON. Errors go to stderr. Exit: 0 OK, 1 failure, 2 usage/cancel, 4 sign-in required, 5 forbidden.\n'; }
function checkFlags(flags, allowed = []) {
  const permitted = new Set([...allowed, 'url', 'endpoint', 'output', 'json', 'fields', 'yes', 'help', 'version']);
  for (const key of Object.keys(flags)) if (!permitted.has(key)) throw new auth.ClientError('INVALID_ARGUMENT', `Unknown option --${key}. Use command --help.`, 2);
}
async function main(argv, { mcp = false, version = '0.2.0' } = {}) {
  let { words, flags } = parse(argv);
  const url = flags.url || flags.endpoint;
  // Never silently accept legacy credentials supplied by an agent's environment.
  if (process.env.EPURE_TOKEN) throw new auth.ClientError('OAUTH_ONLY', 'Remove EPURE_TOKEN and sign in with epure auth login.', 2);
  if (flags.version) { process.stdout.write(`${version}\n`); return; }
  if (flags.help) { process.stdout.write(mcp ? 'epure-mcp [--url HTTPS_ORIGIN] [--read-only] [--toolsets issues,projects]\nepure-mcp login [--device] [--no-browser] | status | logout | init | doctor\nSign in once with epure auth login or epure-mcp login.\nDefault: serve MCP over stdio. Diagnostics use stderr.\ninit prints a credential-free MCP client configuration.\n' : help(words)); return; }
  if (flags.output && !['json', 'table', 'ndjson'].includes(flags.output)) throw new auth.ClientError('INVALID_ARGUMENT', 'Choose --output json, table, or ndjson.', 2);
  const first = words[0];
  if (mcp && !words.length) { checkFlags(flags, ['read-only', 'toolsets']); return require('./mcp').serve({ url, readOnly: !!flags['read-only'], toolsets: flags.toolsets?.split(','), version }); }
  if (mcp && first === 'init') { checkFlags(flags, ['read-only', 'toolsets']); output({ mcpServers: { epure: { command: 'npx', args: ['-y', '@epure-sh/mcp', ...(url ? ['--url', auth.normalizeUrl(url)] : []), ...(flags['read-only'] ? ['--read-only'] : []), ...(flags.toolsets ? ['--toolsets', flags.toolsets] : [])] } } }, { json: true }); return; }
  if (mcp && first === 'doctor') {
    checkFlags(flags); const status = auth.publicSession(url);
    if (!status.authenticated) throw auth.authRequired();
    const result = await apiRequest(url, { path: '/api/v1/agent/whoami' }); output({ ok: true, instance: status.instance, identity: result.data, transport: 'stdio → REST', oauth: true }, flags); return;
  }
  const aliases = { login: ['auth', 'login'], logout: ['auth', 'logout'], status: ['auth', 'status'], instances: ['auth', 'instances'], use: ['auth', 'use'], queue: ['issues', 'list'], context: ['issues', 'context'] };
  if (aliases[first]) words = [...aliases[first], ...words.slice(1)];
  if (words[0] === 'issue') words[0] = 'issues';
  if (words[0] === 'triage') words = ['issues', words[1], ...words.slice(2)];
  if (words[0] === 'auth' && words[1] !== 'whoami') {
    const action = words[1]; checkFlags(flags, action === 'login' ? ['device', 'no-browser', 'scope'] : []);
    if (action === 'login') {
      const controller = new AbortController(); const cancel = () => controller.abort(); process.once('SIGINT', cancel);
      try { output(await auth.login({ url, device: flags.device, noBrowser: flags['no-browser'], scope: flags.scope, signal: controller.signal }), flags); }
      finally { process.removeListener('SIGINT', cancel); }
    } else if (action === 'status') { const status = auth.publicSession(url); output(status, flags); if (!status.authenticated) process.exitCode = 4; }
    else if (action === 'logout') output(await auth.logout(url), flags);
    else if (action === 'instances') output(auth.listInstances(), flags);
    else if (action === 'use' && words[2]) output({ instance: auth.switchInstance(words[2]) }, flags);
    else throw new auth.ClientError('INVALID_ARGUMENT', help(['auth']), 2);
    return;
  }
  if (first === 'schema' || first === 'api-catalog') {
    checkFlags(flags, ['search', 'resource', 'offset', 'limit']);
    if (first === 'schema' && words[1]) { const op = operations.find(o => o.id === words[1]); if (!op) throw new auth.ClientError('INVALID_ARGUMENT', 'Unknown operation. Use epure api-catalog.', 2); output(op, { ...flags, json: true }); }
    else {
      const offset = Number(flags.offset || 0), limit = Number(flags.limit || 20);
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new auth.ClientError('INVALID_ARGUMENT', 'Use offset ≥ 0 and limit between 1 and 100.', 2);
      output({ ...discover({ resource: flags.resource, search: flags.search, offset, limit }), ...(first === 'api-catalog' ? { rest_routes: catalog.filter(o => (!flags.search || o.path.includes(flags.search))).slice(offset, offset + limit), rest_total: catalog.filter(o => !flags.search || o.path.includes(flags.search)).length } : {}) }, { ...flags, json: true });
    } return;
  }
  if (first === 'api') {
    checkFlags(flags, ['data', 'query', 'method', 'path']);
    if (words.length > 4 || (words[3] && flags.data !== undefined)) throw new auth.ClientError('INVALID_ARGUMENT', 'Provide one request body using --data JSON|@file|-.', 2);
    const method = (flags.method || words[1] || 'GET').toUpperCase(), path = flags.path || words[2];
    if (['DELETE'].includes(method) || /\/(erase|strip-identifiers|rotate-secret|revoke|rotate|merge|split)$/.test(path || '')) if (!flags.yes) throw new auth.ClientError('CONFIRM_REQUIRED', 'This action is destructive. Review it and pass --yes.', 2);
    output((await apiRequest(url, { method, path, ...((flags.data ?? words[3]) !== undefined ? { body: jsonInput(flags.data ?? words[3]) } : {}), query: jsonInput(flags.query) })).data, flags); return;
  }
  if (!words.length || (words.length === 1 && operations.some(o => o.resource === words[0]))) { process.stdout.write(help(words)); return; }
  const op = operations.find(o => o.resource === words[0] && o.action === words[1]);
  if (!op) throw new auth.ClientError('INVALID_ARGUMENT', `Unknown command ${words.slice(0, 2).join(' ')}. Run epure --help.`, 2);
  const keys = Object.keys(op.inputSchema.properties); checkFlags(flags, ['data', ...keys.map(k => k.replaceAll('_', '-'))]);
  const args = jsonInput(flags.data); let position = 2;
  for (const [, key] of op.path.matchAll(/\{([^}]+)\}/g)) if (words[position] !== undefined) args[key] = words[position++];
  if (words.length > position) throw new auth.ClientError('INVALID_ARGUMENT', 'Unexpected positional arguments. Use --help.', 2);
  for (const key of keys) { const flag = key.replaceAll('_', '-'); if (flags[flag] !== undefined) { if (args[key] !== undefined) throw new auth.ClientError('INVALID_ARGUMENT', `Provide ${key} once, in --data or a flag.`, 2); args[key] = coerce(flags[flag], op.inputSchema.properties[key]); } }
  validate(op.inputSchema, args);
  if (op.destructive && !flags.yes) throw new auth.ClientError('CONFIRM_REQUIRED', 'This action is destructive. Review it and pass --yes.', 2);
  if (op.id === 'issues.context' && !args.format) args.format = process.stdout.isTTY && !flags.json && !['json', 'ndjson'].includes(flags.output) ? 'markdown' : 'json';
  output((await apiRequest(url, buildRequest(op, args))).data, flags);
}
function run(argv, options) {
  main(argv, options).catch(e => { const cancelled = e.name === 'AbortError'; const err = { code: e.code || (cancelled ? 'CANCELLED' : 'CLIENT_ERROR'), message: cancelled ? 'Cancelled.' : e.message };
    process.stderr.write(`${JSON.stringify({ error: err })}\n`); process.exitCode = e.exitCode || (cancelled ? 2 : 1);
  });
}
module.exports = { main, run, parse, output, jsonInput, help };
