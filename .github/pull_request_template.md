## Summary

<!-- What changed and why? -->

Fixes #

## Type of change

- [ ] Bug fix
- [ ] Feature (Phase 1 scope)
- [ ] Dashboard / UX
- [ ] Docs / community
- [ ] Refactor (no behavior change)

## Test plan

- [ ] `./scripts/test.sh` passes (Postgres on localhost:5433)
- [ ] `docker compose up --build` + `/health` OK (if server/compose touched)
- [ ] Migrations applied cleanly (if SQL changed)
- [ ] Ingest smoke: envelope or store curl returns **202** (if ingest touched)
- [ ] Web: `cd web && npm run dev` (if `web/` touched)

## UI screenshots

<!-- Required for dashboard/shell changes. -->

| Before | After |
|--------|-------|
|        |       |

- [ ] N/A — no UI changes

## Checklist

- [ ] No secrets committed (`.env`, DSN keys, OAuth creds)
- [ ] No hex colors added in JSX (use design tokens)
- [ ] Scope matches [CONTRIBUTING.md](../CONTRIBUTING.md); no Redis/ClickHouse/Kafka/Phase 2 infra / `ee/`
- [ ] README or [epure.sh/docs](https://epure.sh/docs) updated if setup steps changed
- [ ] Not claiming 100% Sentry parity or shipping tracing/replay/profiling/logs
