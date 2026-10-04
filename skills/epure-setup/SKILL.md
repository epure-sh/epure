---
name: epure-setup
description: >-
  Install self-hosted Epure (Docker Compose, local or VPS) and confirm /health
  plus a first account. Use for Epure install, production deploy, Caddy,
  --profile tls, login loop on port 8080, self-hosted Sentry alternative, or
  before DSN wiring (epure-wire) and MCP/CLI (epure-agent).
---

# Epure setup

Epure is exception tracking. Two containers: the app and PostgreSQL 16. Official Sentry SDKs, change the DSN. Apache-2.0. https://github.com/epure-sh/epure

After the host is up, load **epure-wire** for the SDK and **epure-agent** for tokens, MCP, and `epure-cli`. Load **epure-triage** when fixing an issue.

## Do not promise

No tracing, session replay, profiling, generic logs, infra metrics, or mobile symbolication. Never say 100% Sentry compatible.

## Local

```bash
git clone https://github.com/epure-sh/epure.git
cd epure
docker compose up -d
curl -sS http://localhost:8080/health
```

Expect `{"status":"ok"}`. Docker Engine and Compose v2. Default ports **8080** and **5433**.

1. Open http://localhost:8080/login and register.
2. Create a project and copy the DSN.
3. Hand the DSN to **epure-wire**. Sample rates for traces, replay, and profiles stay at 0.

Local HTTP is valid. `EPURE_SESSION_SECURE` is 0. Do not use the prod overlay on a laptop.

## Production

Sign-in works only on HTTPS.

The prod overlay sets a Secure session cookie. `http://YOUR_SERVER:8080` can return `/health` ok and still drop the cookie. A correct password returns the login form with no error. Do not send the user there. Do not use a raw IP: it will not get a browser-trusted certificate.

```bash
./configure --prod
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml --profile tls up -d
curl -sS https://errors.example.com/health
```

`./configure --prod` writes passwords and `EPURE_SITE_ADDRESS` from an `https://` DNS name. `--profile tls` starts Caddy on ports **80** and **443**. Open `https://that-hostname/login`.

Drop `--profile tls` only when nginx, Caddy, or Traefik already serves that HTTPS URL. Still do not sign in on port 8080.

After the first account exists, set `EPURE_REGISTRATION=false` and recreate `epure`. Sign-in and invites keep working.

Docs: https://epure.sh/docs/self-hosting/installation

## After login

1. Project → copy DSN → **epure-wire**.
2. **Settings → Agent tokens** (admin). Scopes: `read:agent` (always), `write:triage` to resolve, `write:admin` for projects, DSN, webhooks.
3. **epure-agent** with `EPURE_URL` set to the same origin the browser uses (`http://localhost:8080` or `https://your-hostname`). Never point the token client at `http://IP:8080` when the overlay is in prod mode.

MCP and CLI cannot create the first user or call `/api/v1/auth/*`. The human registers in the browser.

## Honesty

Idle footprint, cite only the README method dated **2026-09-23** (`docker stats` on 2 vCPU / 769 MiB): about 5 MiB Epure and 48 MiB Postgres. Do not invent QPS. Pin `EPURE_IMAGE` to a release tag on a public URL.
