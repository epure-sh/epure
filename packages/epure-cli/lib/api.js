'use strict';
const { ClientError, endpoint, getActiveCredentials, ensureValidToken, authRequired } = require('./auth');
const { catalog } = require('./operations');
function safePath(method, path) {
  if (typeof path !== 'string' || !path.startsWith('/api/v1/') || /[\\?#]|%2f|%5c|%2e|\.{2}/i.test(path)) throw new ClientError('INVALID_PATH', 'Use an API path from epure api-catalog, without a query string.', 2);
  const allowed = catalog.some(o => o.method === method && new RegExp(`^${o.path.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path));
  // Auth identity is the OAuth Agent API, never browser login or PAT management.
  if (!allowed) throw new ClientError('UNSUPPORTED_OPERATION', 'Unknown or excluded API operation. Run epure api-catalog.', 2);
}
async function apiRequest(instanceUrl, request = {}, signal) {
  const url = endpoint(instanceUrl); const method = (request.method || 'GET').toUpperCase(); safePath(method, request.path);
  const target = new URL(request.path, url);
  if (target.origin !== url) throw new ClientError('INVALID_PATH', 'Cross-origin requests are forbidden.', 2);
  for (const [k, v] of Object.entries(request.query || {})) if (v != null) target.searchParams.set(k, String(v));
  const session = getActiveCredentials(url); if (!session?.refresh_token) throw authRequired();
  let credential = await ensureValidToken(session);
  async function send() {
    const headers = { Authorization: `Bearer ${credential}`, Accept: 'application/json', 'User-Agent': 'epure-clients/0.2.0' }; let body;
    if (request.files) {
      body = new FormData(); for (const [k, v] of Object.entries(request.body || {})) body.append(k, String(v));
      for (const f of request.files) body.append(f.field || 'file', new Blob([Buffer.from(f.base64, 'base64')], { type: f.contentType || 'application/octet-stream' }), f.filename);
    } else if (request.body !== undefined && !['GET', 'HEAD'].includes(method)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(request.body); }
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort();
    try { const response = await fetch(target, { method, headers, body, redirect: 'error', signal: controller.signal }); return { response, text: await response.text() }; }
    catch { throw new ClientError(signal?.aborted ? 'CANCELLED' : 'NETWORK_ERROR', signal?.aborted ? 'Request cancelled.' : 'Request failed or timed out. Check the connection before retrying a write.', signal?.aborted ? 2 : 1); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  let reply = await send();
  if (reply.response.status === 401) {
    credential = await ensureValidToken({ ...session, access_token: credential }, true); reply = await send();
  }
  const { response, text } = reply; let data; try { data = JSON.parse(text); } catch { data = text || null; }
  if (!response.ok) {
    if (response.status === 401) throw authRequired();
    const hint = response.status === 403 ? 'Your approved scopes or workspace role do not allow this action. Reauthorize with the required scope, or ask an administrator.' : response.status === 429 ? 'Rate limited. Retry after the server limit resets.' : 'Check the resource ID, arguments and instance.';
    const e = new ClientError(response.status === 403 ? 'PERMISSION_DENIED' : `HTTP_${response.status}`, `HTTP ${response.status}. ${hint}`, response.status === 403 ? 5 : 1); e.status = response.status; throw e;
  }
  return { status: response.status, data };
}
module.exports = { apiRequest, safePath };
