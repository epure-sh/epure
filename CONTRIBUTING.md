# Contributing to epure

Thanks for helping ship Phase 1 OSS exception monitoring.

## Before you start

- Read [README.md](./README.md) for install and the SDK matrix.
- Feature scope lives in [ROADMAP.md](./ROADMAP.md) — check it before proposing work.
- Phase 1 stack: Rust + PostgreSQL 16 + RLS, 2-container compose. **No Redis, ClickHouse, Kafka, or SQLite-as-primary.**

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Compose | v2 | `docker compose up --build` |
| Rust | stable | `cargo` workspace in `crates/` |
| Node (optional) | 22+ | SPA hot reload in `web/` |
| Postgres (tests) | 16 | Host port **5433** (not 5432) |

Copy env files: `.env.example`, `.env.test.example`.

## Run tests

Integration tests need Postgres on localhost:5433:

```bash
./scripts/test.sh
# equivalent: DATABASE_URL=postgres://epure:epure@localhost:5433/epure cargo test
```

Start the stack for manual verification:

```bash
docker compose up --build
curl -sS http://localhost:8080/health   # expect {"status":"ok"}
./scripts/seed-dev.sh                   # optional smoke data
```

Golden path with time budgets and troubleshooting: [docs/QUICKSTART.md](docs/QUICKSTART.md).

## Web / dashboard development

**Hot reload against a running API:**

```bash
cd web && npm install && npm run dev
# proxies API to localhost:8080
```

UI changes: follow [web/design/README.md](web/design/README.md). No hex colors in JSX. Run the [web/design/qa.md](web/design/qa.md) checklist for shell changes.

## Database migrations

After Postgres is up:

```bash
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
cargo sqlx migrate run --source crates/storage/migrations
```

Rules:

- One migration per logical change; timestamp prefix `YYYYMMDDHHMMSS_name.sql`.
- Migrations apply in order (S1 minimal → S3 RLS/partitions → auth → lifecycle).
- Do not hand-edit applied migrations; add a new file instead.
- RLS policies must set `app.current_org_id` — see existing migrations in `crates/storage/migrations/`.

## How to report issues

Use GitHub issue templates (Bug / SDK compatibility / Feature). Search [existing issues](https://github.com/epure-sh/epure/issues) first.

## How to send a PR

1. Fork → feature branch (not `main`).
2. Run `./scripts/test.sh`; for UI changes, note manual QA in the PR.
3. Fill out [.github/pull_request_template.md](.github/pull_request_template.md).
4. Link issues with `Fixes #123` when applicable.
5. Keep PRs focused; open an issue first for large changes.

## Feature requests & out-of-scope

- **In scope:** rows in [ROADMAP.md](./ROADMAP.md) S0–S6 (+ dashboard UX polish).
- **Out of scope (Phase 1):** Redis, ClickHouse, tracing, replay, profiling, generic logs, iOS/Android, Cloud billing/Stripe, "100% Sentry parity."
- **Phase 2 (Cloud):** tracked separately — do not open OSS PRs that assume multi-service infra.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) (Contributor Covenant 2.1).
