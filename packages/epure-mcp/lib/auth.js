const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { exec } = require('child_process');
const readline = require('readline');

function getCredentialsPath() {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'epure', 'credentials.json');
}

function readCredentials() {
  const p = getCredentialsPath();
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch {}
  return { current_instance: '', instances: {} };
}

function writeCredentials(data) {
  const p = getCredentialsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(p, 0o600);
  } catch {}
}

function normalizeUrl(url) {
  if (!url) return 'https://epure.sh';
  let u = url.trim().replace(/\/+$/, '');
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `https://${u}`;
  }
  return u;
}

function getActiveCredentials(targetUrl) {
  const creds = readCredentials();
  const normTarget = targetUrl ? normalizeUrl(targetUrl) : '';
  const current = normTarget || creds.current_instance || 'https://epure.sh';
  const instance = creds.instances ? creds.instances[current] : null;
  if (!instance && !normTarget && creds.instances) {
    const keys = Object.keys(creds.instances);
    if (keys.length > 0) {
      return { url: keys[0], ...creds.instances[keys[0]] };
    }
  }
  return instance ? { url: current, ...instance } : null;
}

function saveInstance(url, data) {
  const normUrl = normalizeUrl(url);
  const creds = readCredentials();
  if (!creds.instances) creds.instances = {};
  creds.instances[normUrl] = {
    url: normUrl,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    org_id: data.org_id,
    user_id: data.user_id,
    scopes: data.scopes || ['read:agent', 'write:triage'],
  };
  creds.current_instance = normUrl;
  writeCredentials(creds);
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, () => {});
}

function postJson(fullUrl, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(fullUrl);
    const client = urlObj.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);

    const req = client.request(
      fullUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': 'epure-mcp-auth/0.1.7',
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (c) => (resBody += c));
        res.on('end', () => {
          try {
            const data = JSON.parse(resBody);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error_description || data.error || `HTTP ${res.statusCode}: ${resBody}`));
            }
          } catch {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({});
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${resBody}`));
            }
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function ensureValidToken(instanceData, forceRefresh = false) {
  if (!instanceData || !instanceData.refresh_token) {
    return instanceData?.access_token || null;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = instanceData.expires_at || 0;
  if (!forceRefresh && expiresAt > nowSec + 172800) {
    return instanceData.access_token;
  }

  try {
    const res = await postJson(`${instanceData.url}/oauth/token`, {
      grant_type: 'refresh_token',
      refresh_token: instanceData.refresh_token,
    });
    if (res.access_token) {
      instanceData.access_token = res.access_token;
      if (res.refresh_token) {
        instanceData.refresh_token = res.refresh_token;
      }
      instanceData.expires_at = nowSec + (res.expires_in || 2592000);
      saveInstance(instanceData.url, instanceData);
      return instanceData.access_token;
    }
  } catch (err) {
    if (expiresAt > nowSec) {
      return instanceData.access_token;
    }
    throw err;
  }
  return instanceData.access_token;
}

async function loginLoopback(targetUrl, clientId, clientName) {
  return new Promise((resolve, reject) => {
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    const state = crypto.randomBytes(16).toString('hex');

    const server = http.createServer(async (req, res) => {
      try {
        const parsed = new URL(req.url, 'http://127.0.0.1');
        if (parsed.pathname !== '/callback') {
          res.writeHead(404);
          res.end();
          return;
        }

        const code = parsed.searchParams.get('code');
        const returnedState = parsed.searchParams.get('state');
        const error = parsed.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html><body style="font-family: sans-serif; background: #0c0d0e; color: #f87171; padding: 40px; text-align: center;">
              <h2>Authorization Denied</h2>
              <p>${parsed.searchParams.get('error_description') || error}</p>
            </body></html>
          `);
          server.close();
          return reject(new Error(`Authorization failed: ${error}`));
        }

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('State mismatch error.');
          server.close();
          return reject(new Error('OAuth state mismatch'));
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('Missing code parameter.');
          server.close();
          return reject(new Error('Missing authorization code'));
        }

        const port = server.address().port;
        const redirectUri = `http://127.0.0.1:${port}/callback`;

        const tokenRes = await postJson(`${targetUrl}/oauth/token`, {
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          client_id: clientId,
        });

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Epure MCP - Authenticated</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0c0d0e; color: #f0f0f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .box { background: #16181a; border: 1px solid #2a2d32; border-radius: 12px; padding: 40px; text-align: center; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
              h1 { color: #fff; font-size: 20px; margin: 0 0 10px; }
              p { color: #888; font-size: 14px; margin: 0; }
              .icon { color: #10b981; font-size: 40px; margin-bottom: 16px; }
            </style>
          </head>
          <body>
            <div class="box">
              <div class="icon">✓</div>
              <h1>Authenticated Epure MCP</h1>
              <p>You can close this tab and return to your agent.</p>
            </div>
          </body>
          </html>
        `);

        server.close();

        const nowSec = Math.floor(Date.now() / 1000);
        saveInstance(targetUrl, {
          access_token: tokenRes.access_token,
          refresh_token: tokenRes.refresh_token,
          expires_at: nowSec + (tokenRes.expires_in || 2592000),
          org_id: tokenRes.org_id,
          user_id: tokenRes.user_id,
          scopes: (tokenRes.scope || 'read:agent write:triage').split(' '),
        });

        resolve({
          url: targetUrl,
          access_token: tokenRes.access_token,
          org_id: tokenRes.org_id,
          user_id: tokenRes.user_id,
        });
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      const authUrl = `${targetUrl}/oauth/authorize?client_id=${encodeURIComponent(clientId)}&client_name=${encodeURIComponent(clientName)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=read:agent+write:triage&state=${state}`;

      console.error(`\n[epure-mcp] Opening browser to authenticate with ${targetUrl}...`);
      console.error(`[epure-mcp] Visit: ${authUrl}\n`);

      openBrowser(authUrl);
    });

    server.on('error', reject);

    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Browser authorization timed out (120s)'));
    }, 120000);

    server.on('close', () => {
      clearTimeout(timer);
    });
  });
}

module.exports = {
  getCredentialsPath,
  readCredentials,
  writeCredentials,
  normalizeUrl,
  getActiveCredentials,
  saveInstance,
  ensureValidToken,
  loginLoopback,
};
