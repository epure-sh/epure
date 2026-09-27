---
name: epure-setup
description: >-
  Set up self-hosted Epure error tracking with Docker Compose and point official
  Sentry SDKs at an Epure DSN. Use when the user asks for Epure install, self-hosted
  Sentry alternative setup, DSN swap, exception-only monitoring, or verifying
  /health and a first test event on Epure.
---

# Epure setup (Compose + DSN swap)

Epure is **exception-only** error tracking: keep official Sentry SDKs, point the DSN at Epure, self-host with **two containers** (app + PostgreSQL 16). Apache-2.0. Repo: https://github.com/epure-sh/epure

## When to use this skill

- “Set up Epure / self-hosted error tracking”
- “Replace Sentry SaaS bill with a small VPS”
- “DSN swap to a Sentry-compatible self-host”
- First-time `docker compose` + verify ingest

## Non-goals (do not promise)

Epure does **not** provide distributed tracing, session replay, continuous profiling, generic logs, infra metrics, mobile symbolication, or full 1:1 Sentry protocol compatibility. Prefer GlitchTip/Sentry self-host if the user needs those.

## Quick path (localhost)

```bash
git clone https://github.com/epure-sh/epure.git
cd epure
docker compose up -d
curl -sS http://localhost:8080/health
# expect: {"status":"ok"}
```

Requirements: Docker Engine, Compose v2, ports **8080** and **5433** free by default.

1. Open http://localhost:8080  
2. Create account → create project → copy the generated **DSN**  
3. Keep `@sentry/*` or `sentry-sdk`; set `dsn` to the Epure DSN  
4. Prefer `tracesSampleRate` / replay / profiles sample rates at `0` (Epure focuses on exceptions)  
5. Capture a test exception; confirm a grouped issue in the dashboard  

### Node example

```js
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN, // Epure DSN
  tracesSampleRate: 0,
  profilesSampleRate: 0,
});

Sentry.captureException(new Error("Epure test event"));
```

### Browser example

```js
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "http://{public_key}@localhost:8080/{project_id}",
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  profilesSampleRate: 0,
});
```

### Python example

```python
import sentry_sdk

sentry_sdk.init(dsn="http://{public_key}@localhost:8080/{project_id}", traces_sample_rate=0.0)
raise RuntimeError("Epure Python test")
```

## Production overlay (repo facts)

Documented path stays root `docker compose up`. Optional overlays live under `deploy/`:

| Path | Use |
| --- | --- |
| `deploy/docker-compose.prod.yml` | HTTPS session cookies, no Postgres host port |
| `deploy/docker-compose.build.yml` | Build from source instead of GHCR |
| `deploy/env.production.example` | Copy → repo-root `.env` for production |

```bash
# after filling CHANGE_ME values (or ./configure --prod)
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d
```

Set `EPURE_PUBLIC_URL`, `EPURE_CORS_ORIGINS`, and strong `POSTGRES_PASSWORD` / ingest / app passwords. Put TLS (Caddy/nginx/Traefik) in front — Epure listens HTTP on `EPURE_PORT`. Image default: `ghcr.io/epure-sh/epure` (pin a release tag when possible).

Docs: https://epure.sh/docs/self-hosting/installation · platforms: https://epure.sh/docs/platforms

## Footprint honesty

Cite the README method dated **2026-09-23** (`docker stats` on 2 vCPU / 769 MiB Alibaba VPS): idle ≈ 5 MiB Epure + ≈ 48 MiB Postgres. Do not invent QPS or “sub-10ms” claims. Host class changes numbers — suggest the user re-run `docker stats --no-stream`.

## Compatibility honesty

Partial Sentry-wire ingest for exceptions. Check the platform matrix before production migration. Never claim 100% Sentry compatible.

## Next step after first event

For triage with Cursor/Claude via **Copy for AI** (⌘⇧C / Ctrl+Shift+C), load the `epure-triage` skill. MCP triage tools are **roadmap / not required** for that loop.
