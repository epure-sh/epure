# Contributing to epure

Help ship Phase 1 OSS exception monitoring. Read [README.md](./README.md) for install and scope. Feature slices live in [ROADMAP.md](./ROADMAP.md).

**Stack lock:** Rust + PostgreSQL 16 + RLS, 2-container compose. No Redis, ClickHouse, Kafka, or SQLite-as-primary.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Compose | v2 | `docker compose up --build` |
| Rust | stable | `cargo` workspace in `crates/` |
| Node (optional) | 22+ | SPA hot reload in `web/` |
| Postgres (tests) | 16 | Host port **5433** locally; CI uses **5432** |

Copy env files: `.env.example`, `.env.test.example`.

## Run tests

```bash
./scripts/test.sh
# equivalent: DATABASE_URL=postgres://epure:epure@localhost:5433/epure cargo test
```

Manual stack:

```bash
docker compose up --build
curl -sS http://localhost:8080/health   # expect {"status":"ok"}
./scripts/seed-dev.sh                   # optional smoke data
```

Golden path: [docs/QUICKSTART.md](docs/QUICKSTART.md).

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

Questions that are not bugs: [Discussions](https://github.com/epure-sh/epure/discussions). Security: [SECURITY.md](SECURITY.md) · `security@news.epure.sh`. How we help users: [SUPPORT.md](SUPPORT.md) · `support@news.epure.sh`. Decision process: [GOVERNANCE.md](GOVERNANCE.md).

## Scope guard

- **In scope:** [ROADMAP.md](./ROADMAP.md) S0–S6 (+ dashboard UX polish).
- **Out of scope (Phase 1):** Redis, ClickHouse, tracing, replay, profiling, generic logs, iOS/Android, Cloud billing/Stripe, "100% Sentry parity."
- **Phase 2 (Cloud):** tracked separately. Do not open OSS PRs that assume multi-service infra or an `ee/` tree.

## Code of Conduct

[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) (Contributor Covenant 2.1). Conduct reports: `conduct@news.epure.sh`.
