---
name: epure-setup
description: >-
  Get an Epure error tracking instance for an app: Epure Cloud (app.epure.sh)
  or self-hosted with Docker Compose (local or VPS), then confirm /health and
  a first account. Use when the user wants to add error tracking, set up
  Epure, deploy it on a server, fix a login loop on port 8080, or move off
  Sentry. Next: epure-wire (SDK), epure-agent (MCP and CLI).
---

# Epure setup

Epure is calm error tracking: keep the official Sentry SDK and change the DSN. It stores errors only: no tracing, session replay, profiling, logs or mobile crash symbolication. Never call it "100% Sentry compatible".

After an instance exists, load **epure-wire** to point the SDK at it, then **epure-agent** to connect the MCP server or CLI. Load **epure-triage** to fix an issue.

## Choose where it runs

Ask once, unless the user already said:

| Option | When | What the human does |
| --- | --- | --- |
| **Epure Cloud** (`https://app.epure.sh`) | No server to run | Cloud access is by invitation for now: request access at https://epure.sh/pricing. Once admitted, sign in and create a project. Prices are on that page; don't quote them from memory |
| **Self-hosted** | They want to own the data path or run it for free | Follow **Local** or **Production** below |

Never create accounts, sign up, or accept terms for the user. A human registers in the browser.

## Self-hosted: local

```bash
git clone https://github.com/epure-sh/epure.git
cd epure
docker compose up -d
curl -sS http://localhost:8080/health
```

Expect an ok status. Needs Docker Engine and Compose v2. Two containers: Epure and PostgreSQL 16. Host ports default to **8080** (`EPURE_PORT`) and **5433** for Postgres (`POSTGRES_HOST_PORT`).

1. The human opens http://localhost:8080, registers and creates a project.
2. Hand off to **epure-wire** with the DSN.

Local HTTP is fine. Do not use the production overlay on a laptop.

## Self-hosted: production

Sign-in works only over HTTPS. The production overlay sets a Secure session cookie: `http://SERVER:8080` can return a healthy `/health` and still drop the cookie, so a correct password lands back on the login form with no error. Use a hostname, not a raw IP; an IP won't get a browser-trusted certificate.

```bash
./configure --prod
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml --profile tls up -d
curl -sS https://errors.example.com/health
```

- Run `./configure --prod` before the first production `up`, or after `down -v`. It asks for the public HTTPS hostname. With an existing Postgres volume it reuses or applies the database secrets, so the app and database never drift. Use `./configure --prod-rotate-secrets` only to rotate on purpose.
- `--profile tls` starts Caddy on ports 80 and 443. Drop it only when another proxy (nginx, Caddy, Traefik) already serves that HTTPS hostname.
- Open `https://that-hostname/login`. After the first account exists, set `EPURE_REGISTRATION=false` and recreate the `epure` container. Sign-in and invitation links keep working.
- Pin `EPURE_IMAGE` to a release tag (https://github.com/epure-sh/epure/releases).
- To serve the hosted MCP endpoint at `/mcp` on a self-hosted instance, set `EPURE_MCP_ENABLED=true` (off by default). The npm MCP server works without it.

Platform templates (Render, Railway, Coolify, Dokploy) are listed in the repo README and https://epure.sh/docs/install.

## Done when

- `/health` is ok on the URL the browser uses.
- The human is signed in and has a project and its DSN (**Settings → SDK connection**, or the in-app **Setup** wizard).

## Facts you may state

- Engine licence AGPL-3.0. The `@epure-sh/cli` and `@epure-sh/mcp` clients are Apache-2.0.
- Idle footprint about 5 MiB (Epure) plus 48 MiB (Postgres), measured 2026-09-23 on a 2 vCPU / 769 MiB VPS. No other performance numbers: don't invent throughput or capacity.

Docs: https://epure.sh/docs/install · https://epure.sh/docs/get-started/quickstart
