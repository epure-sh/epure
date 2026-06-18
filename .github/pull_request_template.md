## Summary

<!-- What changed and why? Link ROADMAP slice if applicable. -->

Fixes #

## Type of change

- [ ] Bug fix
- [ ] Feature (in ROADMAP scope)
- [ ] Dashboard / UX
- [ ] Docs / community
- [ ] Refactor (no behavior change)

## Test plan

- [ ] `./scripts/test.sh` passes (Postgres on localhost:5433)
- [ ] `docker compose up --build` + `/health` OK (if server/compose touched)
- [ ] Migrations applied cleanly: `cargo sqlx migrate run --source crates/storage/migrations` (if SQL changed)
- [ ] Ingest smoke: envelope or store curl returns **202** (if ingest touched)
- [ ] Web: `cd web && npm run dev` (if `web/` touched)

## UI screenshots

<!-- Required for dashboard/shell changes. Before/after or short screen recording. -->

| Before | After |
|--------|-------|
|        |       |

- [ ] N/A — no UI changes

## Checklist

- [ ] No secrets committed (`.env`, DSN keys, OAuth creds)
- [ ] No hex colors added in JSX (use design tokens)
- [ ] Feature scope matches [ROADMAP.md](../ROADMAP.md); no Redis/ClickHouse/Kafka/Phase 2 infra / `ee/`
- [ ] README or quickstart updated if setup steps changed
- [ ] Not claiming 100% Sentry parity or shipping tracing/replay/profiling/logs
