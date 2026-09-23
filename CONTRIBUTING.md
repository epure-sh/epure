# Contributing to Epure

Help ship exception-only error monitoring. Product overview and install: [README.md](./README.md). Operator docs: [epure.sh/docs](https://epure.sh/docs).

**Stack lock:** Rust + PostgreSQL 16 + RLS, 2-container compose. No Redis, ClickHouse, Kafka, or SQLite-as-primary.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Compose | v2 | `docker compose up` pulls `ghcr.io/epure-sh/epure` (amd64 + arm64) |
| Rust | stable | `cargo` workspace in `crates/` |
| Node (optional) | 22+ | SPA hot reload in `web/` |
| Postgres (tests) | 16 | Host port **5433** locally; CI uses **5432** |

Setup: `docker compose up` (no `.env`). Ports: `cp .env.example .env`. Cargo dev: `deploy/env.dev.example` → `.env.dev`.

## Run tests

```bash
./scripts/test.sh
# equivalent: DATABASE_URL=postgres://epure:epure@localhost:5433/epure cargo test
```

```bash
docker compose up
curl -sS http://localhost:8080/health   # expect {"status":"ok"}
# Preview: register at /login (Acme Web + Acme API)
# Heavy UX: ./scripts/seed.sh --email you@example.com --password '…'
```

Source build (Rust / Dockerfile changes):

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.build.yml up --build
```

Golden path: [epure.sh/docs/get-started/quickstart](https://epure.sh/docs/get-started/quickstart).

## Web / dashboard

```bash
cd web && npm install && npm run dev
# proxies API to localhost:8080
```

UI: [web/design/README.md](web/design/README.md). No hex colors in JSX. Shell changes: [web/design/qa.md](web/design/qa.md).

## Database migrations

```bash
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
cargo sqlx migrate run --source crates/storage/migrations
```

- One migration per logical change; timestamp prefix `YYYYMMDDHHMMSS_name.sql`.
- Do not hand-edit applied migrations; add a new file.
- RLS policies must set `app.current_org_id` — see `crates/storage/migrations/`.

## Issues and PRs

1. Search [existing issues](https://github.com/epure-sh/epure/issues). Use Bug / SDK compatibility / Feature templates.
2. Fork → feature branch (not `main`).
3. Run `./scripts/test.sh`. Note manual QA for UI changes.
4. Fill [.github/pull_request_template.md](.github/pull_request_template.md).
5. Link issues with `Fixes #123` when applicable. Keep PRs focused.

Questions that are not bugs: [Discussions](https://github.com/epure-sh/epure/discussions). Security: [.github/SECURITY.md](.github/SECURITY.md) · `security@news.epure.sh`. Support: `support@news.epure.sh`.

## Scope guard

In scope: ingest, grouping, sourcemaps, spike valve, triage UI, alerts/webhooks, multi-project, RBAC.

**Out of scope for this repo:** Redis, ClickHouse, Kafka, tracing, replay, profiling, generic logs, iOS/Android symbolication, “100% Sentry parity,” `ee/` tree.

Maintainers merge on `main`. Large or speculative work should start as an issue.

## Code of Conduct

[.github/CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) (Contributor Covenant 2.1). Conduct reports: `conduct@news.epure.sh`.
