'use strict';
const { ClientError } = require('./auth');
const S = { type: 'string' }, B = { type: 'boolean' }, N = { type: 'number' }, O = { type: 'object', additionalProperties: true }, A = { type: 'array', items: S };
const operations = [];
function add(resource, action, method, path, properties = {}, required = [], extra = {}) {
  const params = [...path.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  const input = { ...Object.fromEntries(params.map(p => [p, { ...S, description: 'Resource identifier' }])), ...properties };
  operations.push({ id: `${resource}.${action}`, resource, action, method, path, description: `${action.replaceAll('-', ' ')} ${resource}`, inputSchema: { type: 'object', properties: input, required: [...params, ...required], additionalProperties: false }, ...extra });
}
const project = { project_id: S };
const rule = { name: S, kind: { type: 'string', enum: ['issue_created', 'regression', 'velocity_spike'] }, environment: S, threshold: N, filters_json: O, enabled: B, triggers: { type: 'array', items: O }, condition_match: S, conditions: { type: 'array', items: O }, payload_options: O, channel_ids: A, cooldown_mins: N };
const monitor = { name: S, schedule: S, schedule_type: S, timezone: S, environment: S, checkin_margin_mins: N, max_runtime_mins: N, failure_issue_threshold: N };
function crud(resource, path, create, required = [], update = create, list = {}) {
  add(resource, 'list', 'GET', path, list);
  add(resource, 'create', 'POST', path, create, required);
  add(resource, 'update', 'PATCH', `${path}/{id}`, update);
  add(resource, 'delete', 'DELETE', `${path}/{id}`, {}, [], { destructive: true });
}
crud('projects', '/api/v1/projects', { name: S }, ['name'], { name: S, retention_days: { type: 'integer', enum: [14, 30, 90] }, ingest_cap_per_hour: N, store_end_user_identifiers: B });
add('issues', 'list', 'GET', '/api/v1/agent/queue', { ...project, environment: S, q: S, limit: { type: 'integer', minimum: 1, maximum: 100 }, window: S });
add('issues', 'show', 'GET', '/api/v1/agent/issues/{id}');
add('issues', 'context', 'GET', '/api/v1/agent/issues/{id}/context', { format: { type: 'string', enum: ['json', 'markdown'] }, event: S, include_payload: B, include_user: B });
for (const [action, status] of Object.entries({ resolve: 'resolved', ignore: 'ignored', reopen: 'unresolved' })) add('issues', action, 'PATCH', '/api/v1/agent/issues/{id}', { resolved_in_release: S }, [], { fixed: { status } });
add('issues', 'update', 'PATCH', '/api/v1/agent/issues/{id}', { status: { type: 'string', enum: ['unresolved', 'resolved', 'ignored', 'regression'] }, resolved_in_release: S });
add('issues', 'snooze', 'POST', '/api/v1/agent/issues/{id}/snooze', { mode: S }, ['mode']);
add('issues', 'unsnooze', 'POST', '/api/v1/agent/issues/{id}/unsnooze');
for (const action of ['events', 'releases', 'timeline']) add('issues', action, 'GET', `/api/v1/issues/{issue_id}/${action}`);
crud('rules', '/api/v1/alert-rules', { ...project, ...rule }, ['project_id', 'name', 'kind'], Object.fromEntries(Object.entries(rule).filter(([k]) => k !== 'kind')), project);
crud('channels', '/api/v1/alert-channels', { ...project, provider: S, label: S, config: O, require_verify: B }, ['project_id', 'provider', 'label'], { ...project, label: S, config: O, is_enabled: B }, project);
add('channels', 'test', 'POST', '/api/v1/alert-channels/{id}/test', { enable_on_ok: B });
add('channels', 'ping', 'POST', '/api/v1/alert-channels/{id}/ping');
crud('monitors', '/api/v1/monitors', { ...project, slug: S, ...monitor }, ['project_id', 'slug'], { ...monitor, paused: B }, project);
operations.find(o => o.id === 'monitors.list').inputSchema.required.push('project_id');
add('monitors', 'show', 'GET', '/api/v1/monitors/{id}');
add('monitors', 'check-in', 'POST', '/api/v1/monitors/{id}/check-ins', { status: S, duration_ms: N });
add('alerts', 'list', 'GET', '/api/v1/agent/alerts', { ...project, limit: { type: 'integer', minimum: 1, maximum: 100 } });
add('alerts', 'update', 'PATCH', '/api/v1/alerts/{id}', { status: S });
add('releases', 'list', 'GET', '/api/v1/releases', project, ['project_id']);
add('members', 'list', 'GET', '/api/v1/members');
add('members', 'update', 'PATCH', '/api/v1/members/{user_id}', { role: S }, ['role']);
add('members', 'delete', 'DELETE', '/api/v1/members/{user_id}', {}, [], { destructive: true });
add('invitations', 'list', 'GET', '/api/v1/invitations');
add('invitations', 'create', 'POST', '/api/v1/invitations', { email: S, role: S }, ['email', 'role']);
add('invitations', 'delete', 'DELETE', '/api/v1/invitations/{id}', {}, [], { destructive: true });
crud('webhooks', '/api/v1/webhooks', { ...project, url: S, format: S, events: A }, ['project_id', 'url', 'format'], { events: A }, project);
operations.find(o => o.id === 'webhooks.list').inputSchema.required.push('project_id');
add('webhooks', 'test', 'POST', '/api/v1/webhooks/{id}/test');
add('webhooks', 'rotate-secret', 'POST', '/api/v1/webhooks/{id}/rotate-secret', {}, [], { destructive: true });
add('privacy', 'show', 'GET', '/api/v1/privacy');
add('privacy', 'export', 'GET', '/api/v1/projects/{id}/privacy/export', { user_id: S, email: S });
add('privacy', 'erase', 'POST', '/api/v1/projects/{id}/privacy/erase', { user_id: S, email: S }, [], { destructive: true });
add('privacy', 'strip-identifiers', 'POST', '/api/v1/projects/{id}/privacy/strip-identifiers', {}, [], { destructive: true });
add('connected-apps', 'list', 'GET', '/api/v1/user/connected-apps');
add('connected-apps', 'delete', 'DELETE', '/api/v1/user/connected-apps/{id}', {}, [], { destructive: true });
add('auth', 'whoami', 'GET', '/api/v1/agent/whoami');
// Every remaining supported product REST route is discoverable, without exposing
// browser authentication, manual credential management, simulations or MCP proxies.
const catalog = require('./api-catalog.json').filter(o => !/\/auth(?:\/|$)|\/oauth(?:\/|$)|\/agent-tokens(?:\/|$)|\/mcp$|\/simulate$|\/setup\/test-event$/.test(o.path));
function validate(schema, value, label = 'arguments') {
  const bad = message => { throw new ClientError('INVALID_ARGUMENT', `${label}: ${message}`, 2); };
  if (schema.enum && !schema.enum.includes(value)) bad(`choose ${schema.enum.join(', ')}`);
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) bad('expected an object');
    for (const key of schema.required || []) if (value[key] === undefined) bad(`missing ${key}`);
    for (const [key, v] of Object.entries(value)) { if (schema.properties?.[key]) validate(schema.properties[key], v, key); else if (schema.additionalProperties === false) bad(`unknown field ${key}`); }
  } else if (schema.type === 'array') { if (!Array.isArray(value)) bad('expected an array'); for (const item of value) validate(schema.items || {}, item, label); }
  else if (schema.type === 'integer' ? !Number.isInteger(value) : schema.type && typeof value !== schema.type) bad(`expected ${schema.type}`);
  if (typeof value === 'number' && (!Number.isFinite(value) || (schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) bad('outside allowed range');
  if (schema.type === 'string' && !value.trim()) bad('must not be empty');
}
function buildRequest(op, args) {
  validate(op.inputSchema, args);
  const values = { ...args }; let path = op.path.replace(/\{([^}]+)\}/g, (_, k) => { const value = values[k]; delete values[k]; return encodeURIComponent(value); });
  if (op.id === 'issues.context') values.format ||= 'json';
  if (op.id === 'issues.list') values.limit ||= 20;
  if (op.resource === 'privacy' && ['erase', 'export'].includes(op.action) && !args.user_id && !args.email) throw new ClientError('INVALID_ARGUMENT', 'Provide --user-id or --email for the subject.', 2);
  return { method: op.method, path, ...(op.method === 'GET' ? { query: values } : { body: { ...values, ...op.fixed } }) };
}
function discover({ resource, search, offset = 0, limit = 20 } = {}) {
  const found = operations.filter(o => (!resource || o.resource === resource) && (!search || `${o.id} ${o.path}`.includes(search)));
  return { operations: found.slice(offset, offset + limit), total: found.length, next_offset: offset + limit < found.length ? offset + limit : null, resources: [...new Set(operations.map(o => o.resource))] };
}
module.exports = { operations, catalog, validate, buildRequest, discover };
