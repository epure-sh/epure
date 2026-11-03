'use strict';
// Shared OAuth runtime. Keep identical in both npm packages (enforced in tests).
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { setTimeout: sleep } = require('node:timers/promises');
const CLIENT_ID = 'epure-cli';
const SCOPES = ['read:agent', 'write:triage', 'write:admin'];
class ClientError extends Error {
  constructor(code, message, exitCode = 1) { super(message); this.code = code; this.exitCode = exitCode; }
}
function authRequired() { return new ClientError('AUTH_REQUIRED', 'Sign in with: epure auth login (or epure-mcp login). Use --device on a remote machine.', 4); }
function normalizeUrl(value = 'https://app.epure.sh') {
  const raw = value.trim();
  let u; try { u = new URL(raw.includes('://') ? raw : `https://${raw}`); } catch { throw new ClientError('INVALID_URL', 'Use an HTTPS instance origin.', 2); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if ((u.protocol !== 'https:' && !(u.protocol === 'http:' && loopback)) || u.username || u.password || u.search || u.hash || !['', '/'].includes(u.pathname)) {
    throw new ClientError('INVALID_URL', 'Use an HTTPS instance origin (HTTP is allowed only on loopback).', 2);
  }
  return u.origin;
}
function getCredentialsPath() { return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'epure', 'credentials.json'); }
function readCredentials() {
  try { const c = JSON.parse(fs.readFileSync(getCredentialsPath(), 'utf8')); if (!c.instances || typeof c.instances !== 'object') throw Error(); return c; }
  catch (e) { if (e.code === 'ENOENT') return { current_instance: '', instances: {} }; throw new ClientError('CREDENTIAL_STORE', 'Cannot read OAuth sessions. Repair or remove the credentials file, then sign in again.'); }
}
function writeCredentials(c) {
  const dest = getCredentialsPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
  const tmp = `${dest}.${process.pid}.${crypto.randomBytes(6).toString('hex')}`;
  try { fs.writeFileSync(tmp, JSON.stringify(c, null, 2), { mode: 0o600, flag: 'wx' }); fs.renameSync(tmp, dest); }
  finally { try { fs.unlinkSync(tmp); } catch {} }
}
function endpoint(value) { return normalizeUrl(value || process.env.EPURE_URL || readCredentials().current_instance || undefined); }
function getActiveCredentials(url) { const target = endpoint(url); const c = readCredentials().instances[target]; return c ? { ...c, url: target } : null; }
function saveInstance(url, data, activate = true) {
  const target = normalizeUrl(url); const c = readCredentials();
  c.instances[target] = { ...data, url: target };
  if (activate) c.current_instance = target;
  writeCredentials(c);
}
function removeInstance(url) {
  const target = endpoint(url); const c = readCredentials(); delete c.instances[target];
  if (c.current_instance === target) c.current_instance = Object.keys(c.instances)[0] || '';
  writeCredentials(c); return target;
}
function switchInstance(url) { const target = normalizeUrl(url); const c = readCredentials(); if (!c.instances[target]?.refresh_token) throw authRequired(); c.current_instance = target; writeCredentials(c); return target; }
function listInstances() { const c = readCredentials(); return { current_instance: c.current_instance, instances: Object.keys(c.instances) }; }
async function post(url, body, signal) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort();
  const json = url.endsWith('/oauth/device/code');
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' }, body: json ? JSON.stringify(body) : new URLSearchParams(body), redirect: 'error', signal: controller.signal });
    let data; try { data = await r.json(); } catch { data = {}; }
    if (!r.ok) {
      const known = ['authorization_pending', 'slow_down', 'access_denied', 'expired_token', 'invalid_grant', 'invalid_client', 'invalid_request', 'invalid_scope', 'server_error'];
      const code = known.includes(data.error) ? data.error : 'OAUTH_ERROR';
      throw new ClientError(code, `OAuth request failed (${code}). Run auth login again if approval expired.`, 4);
    }
    return data;
  } catch (err) {
    if (err instanceof ClientError) throw err;
    throw new ClientError(signal?.aborted ? 'CANCELLED' : 'NETWORK_ERROR', signal?.aborted ? 'Sign-in cancelled.' : 'Cannot reach the OAuth service. Check your instance and connection.', signal?.aborted ? 2 : 1);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
function persist(url, data, clientId = CLIENT_ID, activate = true) {
  if (!data.access_token || !data.refresh_token || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) <= 0) throw new ClientError('OAUTH_RESPONSE', 'The OAuth service returned an incomplete session.', 4);
  const entry = { access_token: data.access_token, refresh_token: data.refresh_token, client_id: clientId, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in), scopes: (data.scope || '').split(' ').filter(Boolean), org_id: data.org_id, user_id: data.user_id };
  saveInstance(url, entry, activate); return entry;
}
// Serialize refresh rotation across CLI and MCP processes, not just within one process.
async function withLock(fn) {
  const lock = `${getCredentialsPath()}.lock`;
  fs.mkdirSync(path.dirname(lock), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + 25000; let fd;
  while (fd === undefined) {
    try { fd = fs.openSync(lock, 'wx', 0o600); fs.writeFileSync(fd, String(process.pid)); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { const pid = Number(fs.readFileSync(lock, 'utf8')); if (pid > 0) { try { process.kill(pid, 0); } catch (p) { if (p.code === 'ESRCH') { fs.unlinkSync(lock); continue; } } } } catch (e2) { if (e2.code === 'ENOENT') continue; }
      if (Date.now() >= deadline) throw new ClientError('AUTH_BUSY', 'Another process is refreshing the OAuth session. Retry shortly.');
      await sleep(50);
    }
  }
  try { return await fn(); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
async function ensureValidToken(instance, force = false) {
  if (!instance?.refresh_token || !instance.client_id) throw authRequired();
  const fresh = c => c?.access_token && c.expires_at > Date.now() / 1000 + 300;
  if (!force && fresh(instance)) return instance.access_token;
  return withLock(async () => {
    const current = getActiveCredentials(instance.url);
    if (!current?.refresh_token) throw authRequired();
    if (fresh(current) && (!force || current.access_token !== instance.access_token)) return current.access_token;
    let res;
    try { res = await post(`${instance.url}/oauth/token`, { grant_type: 'refresh_token', refresh_token: current.refresh_token, client_id: current.client_id || CLIENT_ID }); }
    catch (err) { if (['invalid_grant', 'invalid_client', 'access_denied'].includes(err.code)) throw authRequired(); throw err; }
    // Older servers may preserve the refresh credential instead of rotating it.
    return persist(instance.url, { ...res, refresh_token: res.refresh_token || current.refresh_token }, current.client_id || CLIENT_ID, false).access_token;
  });
}
function openBrowser(url) {
  const args = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]];
  const child = spawn(args[0], args[1], { stdio: 'ignore', detached: true }); child.on('error', () => {}); child.unref();
}
function publicSession(url) { const c = getActiveCredentials(url); return { instance: endpoint(url), authenticated: !!(c?.refresh_token && c?.client_id), user_id: c?.user_id, org_id: c?.org_id, scopes: c?.scopes, expires_at: c?.expires_at, login_command: 'epure auth login' }; }
async function loginDeviceCode(url, options = {}) {
  const signal = options.signal; const log = options.log || (s => process.stderr.write(`${s}\n`));
  const init = await post(`${url}/oauth/device/code`, { client_id: CLIENT_ID, client_name: 'Epure CLI and MCP', scope: options.scope || SCOPES.join(' ') }, signal);
  const approval = new URL(init.verification_uri_complete || init.verification_uri, url);
  if (approval.origin !== new URL(url).origin) throw new ClientError('OAUTH_RESPONSE', 'OAuth approval URL must belong to your instance.', 4);
  if (!init.device_code || !init.user_code) throw new ClientError('OAUTH_RESPONSE', 'Missing device approval details.', 4);
  log(`Approve sign-in: ${approval.href}\nCode: ${init.user_code}\nWaiting for browser approval…`);
  if (!options.noBrowser) openBrowser(approval.href);
  let interval = Math.max(1, Number(init.interval) || 5) * 1000;
  const deadline = Date.now() + Math.min(Number(init.expires_in) || 600, 900) * 1000;
  while (Date.now() + interval < deadline) {
    await (options.sleep || sleep)(interval, undefined, { signal });
    try {
      const data = await post(`${url}/oauth/token`, { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: init.device_code, client_id: CLIENT_ID }, signal);
      await withLock(async () => persist(url, data)); return publicSession(url);
    } catch (e) { if (e.code === 'authorization_pending') continue; if (e.code === 'slow_down') { interval += 5000; continue; } throw e; }
  }
  throw new ClientError('expired_token', 'Approval expired. Run auth login --device again.', 4);
}
async function loginLoopback(url, options = {}) {
  return new Promise((resolve, reject) => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(32).toString('hex'); let timer, handling = false;
    const finish = (err, data) => { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); server.close(); server.closeIdleConnections?.(); err ? reject(err) : resolve(data); };
    const cancel = () => finish(new ClientError('CANCELLED', 'Sign-in cancelled.', 2));
    const server = http.createServer(async (req, res) => {
      const q = new URL(req.url, 'http://127.0.0.1');
      if (q.pathname !== '/callback' || req.method !== 'GET') { res.writeHead(404).end(); return; }
      if (q.searchParams.get('state') !== state) { res.writeHead(400).end('Invalid OAuth state. Return to the original sign-in tab.'); return; }
      if (handling) { res.writeHead(409).end(); return; } handling = true;
      try {
        if (q.searchParams.has('error')) throw new ClientError('access_denied', 'Browser approval was denied.', 4);
        const code = q.searchParams.get('code'); if (!code) throw new ClientError('OAUTH_RESPONSE', 'Missing authorization code.', 4);
        const data = await post(`${url}/oauth/token`, { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: `http://127.0.0.1:${server.address().port}/callback`, client_id: CLIENT_ID }, options.signal);
        await withLock(async () => persist(url, data)); res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Signed in to Epure. You can close this tab.'); finish(null, publicSession(url));
      } catch (e) { res.writeHead(400).end('Sign-in failed. Return to your terminal.'); finish(e); }
    });
    server.on('error', err => finish(err));
    server.listen(0, '127.0.0.1', () => {
      const approval = new URL('/oauth/authorize', url);
      approval.search = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', client_name: 'Epure CLI and MCP', redirect_uri: `http://127.0.0.1:${server.address().port}/callback`, code_challenge: challenge, code_challenge_method: 'S256', scope: options.scope || SCOPES.join(' '), state }).toString();
      (options.log || (s => process.stderr.write(`${s}\n`)))(`Approve sign-in: ${approval.href}`);
      if (!options.noBrowser) (options.openBrowser || openBrowser)(approval.href);
    });
    timer = setTimeout(() => finish(new ClientError('AUTH_TIMEOUT', 'Browser approval timed out. Run auth login again.', 4)), 180000);
    options.signal?.addEventListener('abort', cancel, { once: true });
  });
}
async function login(options = {}) {
  const url = endpoint(options.url);
  const scopes = (options.scope || SCOPES.join(' ')).split(/[ ,]+/).filter(Boolean);
  if (!scopes.length || scopes.some(s => !SCOPES.includes(s))) throw new ClientError('INVALID_SCOPE', `Choose scopes from: ${SCOPES.join(', ')}`, 2);
  const opts = { ...options, scope: scopes.join(' ') };
  return options.device || process.env.SSH_CLIENT || !process.stdin.isTTY ? loginDeviceCode(url, opts) : loginLoopback(url, opts);
}
async function logout(url) {
  return withLock(async () => {
  const target = endpoint(url); const c = getActiveCredentials(target); let revoked = false;
  try { if (c?.refresh_token) { await post(`${target}/oauth/revoke`, { token: c.refresh_token, token_type_hint: 'refresh_token', client_id: c.client_id || CLIENT_ID }); revoked = true; } }
  catch {} finally { removeInstance(target); }
  return { instance: target, authenticated: false, revoked, ...(!revoked && c?.refresh_token ? { warning: 'Local session removed. Remote revocation failed; revoke Epure CLI and MCP in Settings → Connected apps.' } : {}) };
  });
}
module.exports = { ClientError, authRequired, normalizeUrl, endpoint, getCredentialsPath, readCredentials, writeCredentials, saveInstance, getActiveCredentials, switchInstance, listInstances, removeInstance, ensureValidToken, publicSession, login, loginLoopback, loginDeviceCode, logout };
