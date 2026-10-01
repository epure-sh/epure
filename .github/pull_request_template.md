## Summary

<!-- What changed and why? -->

Fixes #

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Dashboard / UX
- [ ] Docs / community
- [ ] Refactor (no behavior change)

## Test plan

- [ ] `./scripts/test.sh` passes (Postgres on :5433)
- [ ] `docker compose up` + `/health` OK (if server/compose touched)
- [ ] Migrations clean (if SQL changed)
- [ ] Ingest smoke returns **202** (if ingest touched)
- [ ] `cd web && npm run dev` (if `web/` touched)

## UI screenshots

<!-- Required for dashboard/shell changes. -->

| Before | After |
|--------|-------|
|        |       |

- [ ] N/A — no UI changes

## Checklist

- [ ] No secrets committed
- [ ] No hex in JSX (design tokens)
- [ ] Scope matches [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] [epure.sh/docs](https://epure.sh/docs) / README updated if setup steps changed
