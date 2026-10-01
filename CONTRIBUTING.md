# Contributing to Epure

Error tracking for exceptions: grouped issues, stack traces, DSN swap. Product: [README.md](./README.md). Operator docs: [epure.sh/docs](https://epure.sh/docs).

**Stack:** Rust + PostgreSQL 16 + RLS, two-container Compose. No Redis, ClickHouse, Kafka, or SQLite-as-primary.

## Setup

| Tool | Notes |
|------|-------|
| Docker Compose v2 | `docker compose up` pulls `ghcr.io/epure-sh/epure` |
| Rust (stable) | workspace under `crates/` |
| Node 22+ (optional) | SPA in `web/` |
| Postgres 16 | host **5433** locally; CI uses **5432** |

```bash
docker compose up -d
curl -sS http://localhost:8080/health   # {"status":"ok"}
./scripts/test.sh                       # needs Postgres on :5433
```

Ports / env: copy `.env.example` → `.env`. Cargo-only: `deploy/env.dev.example` → `.env.dev`.

Source image build:

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.build.yml up --build
```

## Web

```bash
cd web && npm install && npm run dev   # proxies API → :8080
```

Tokens only — no hex in JSX. Shell QA: [web/design/qa.md](web/design/qa.md).

## Migrations

```bash
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
cargo sqlx migrate run --source crates/storage/migrations
```

One file per change (`YYYYMMDDHHMMSS_name.sql`). Never edit applied migrations; add a new file. RLS must use `app.current_org_id`.

## PRs

1. Search [issues](https://github.com/epure-sh/epure/issues) (try [`good first issue`](https://github.com/epure-sh/epure/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)).
2. Branch from a fork (not straight to `main`).
3. Run `./scripts/test.sh`. Fill [.github/pull_request_template.md](.github/pull_request_template.md).
4. Use `Fixes #123` when it applies. Keep the diff focused.

Questions: [Discussions](https://github.com/epure-sh/epure/discussions). Security: [SECURITY.md](.github/SECURITY.md). Support: [SUPPORT.md](.github/SUPPORT.md).

## Scope

**In:** ingest, grouping, JS/TS sourcemaps, spike valve, triage UI, alerts/webhooks, multi-project, RBAC.

**Out:** Redis, ClickHouse, Kafka, tracing, replay, profiling, generic logs, iOS/Android symbolication, “100% Sentry parity,” `ee/`.

## Code of Conduct

[CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) · `conduct@news.epure.sh`
