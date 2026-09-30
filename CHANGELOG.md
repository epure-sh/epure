# Changelog

Notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Site changelog: [epure.sh/docs/changelog](https://epure.sh/docs/changelog).

## Unreleased

Nothing yet.

## [v0.1.4] — 2026-09-30

Operators can close public registration after the first account exists.

- **Release:** [GitHub v0.1.4](https://github.com/epure-sh/epure/releases/tag/v0.1.4)
- **Compare:** [v0.1.3…v0.1.4](https://github.com/epure-sh/epure/compare/v0.1.3...v0.1.4)
- **Image:** `ghcr.io/epure-sh/epure:v0.1.4`
- **Docs:** [epure.sh/docs/changelog](https://epure.sh/docs/changelog)

### Added

- `EPURE_REGISTRATION=false` (also `0`, `off`, `no`, `disabled`) rejects new workspaces on `POST /api/v1/auth/register` and on Google sign-up
- Login, existing Google accounts, and invitation links stay available
- `GET /api/v1/auth/config` returns `registration_enabled`; the login page hides Register when it is false

### Upgrade

Create the account you need, set `EPURE_REGISTRATION=false`, recreate the container. No migration.

## [v0.1.3] — 2026-09-28

Sentry SDK v7 rejects non-numeric DSN project segments; Epure keeps UUID primary keys and exposes stable numeric `dsn_project_id` values in DSN URLs and ingest paths.

- **Release:** [GitHub v0.1.3](https://github.com/epure-sh/epure/releases/tag/v0.1.3)
- **Compare:** [v0.1.2…v0.1.3](https://github.com/epure-sh/epure/compare/v0.1.2...v0.1.3)
- **Image:** `ghcr.io/epure-sh/epure:v0.1.3`
- **Docs:** [epure.sh/docs/changelog](https://epure.sh/docs/changelog)

### Added

- `projects.dsn_project_id` sequence and migration for existing projects
- Ingest envelope/store/release paths accept numeric DSN segment (UUID still accepted during transition)
- Dashboard DSN copy and setup wizard use numeric segment; environment URL sync for multi-tab setup

### Upgrade

Pull `v0.1.3`, restart — migration assigns numeric IDs. Re-copy DSN from Settings if clients still use an old UUID in the path.

## [v0.1.2] — 2026-09-28

Agent workspace for coding tools: scoped PATs, HTTP Agent API, `epure-cli`, and `@epure/mcp`.

- **Release:** [GitHub v0.1.2](https://github.com/epure-sh/epure/releases/tag/v0.1.2)
- **Compare:** [v0.1.1…v0.1.2](https://github.com/epure-sh/epure/compare/v0.1.1...v0.1.2)
- **Image:** `ghcr.io/epure-sh/epure:v0.1.2` (also `:latest` after Image workflow)
- **Docs:** [epure.sh/docs/changelog](https://epure.sh/docs/changelog) · [MCP and CLI](https://epure.sh/docs/guides/mcp-and-cli)

### Added

- Agent API (`/api/v1/agent/*`) with queue, issue context, and scoped PATs (`write:admin`, project read/write)
- `epure-cli` in the release image for scripts and CI
- `@epure/mcp` stdio MCP server in `tools/epure-mcp` ([MCP and CLI guide](https://epure.sh/docs/guides/mcp-and-cli))
- Org settings: agent token tab; setup wizard refresh (platform marks, docs links, Apply with AI prompt)
- OpenAPI: [docs/agent.openapi.yaml](./docs/agent.openapi.yaml)

### Changed

- Calm Ledger design tokens and brand kit SVG refresh
- Org home and billing settings UX

### Upgrade

Pin `EPURE_IMAGE=ghcr.io/epure-sh/epure:v0.1.2`, pull, and `docker compose up -d`. Migrations run on startup. Smoke-test a PAT and the [Agent API](https://epure.sh/docs/api/agent) after upgrade.

## [v0.1.1] — 2026-09-26

Setup and connection UI cover the official Sentry SDK matrix in setup, not only JavaScript.

Container: `ghcr.io/epure-sh/epure:v0.1.1` (also `:latest`).

### Added

- Java and .NET on the setup wizard language picker (with framework icons)
- Shared multi-platform SDK snippets in Connection settings and the Releases empty state
- Envelope parse tests for browser, Node, Go, Ruby, PHP, Java, and .NET fixtures (Python store unchanged)

### Notes

- Ingest stays DSN-only for official Sentry SDKs. Symbolication remains **JS/TS sourcemaps only**; other languages group on raw frames.

## [v0.1.0] — 2026-09-23

First public tag. Error tracking for exceptions. Keep `@sentry/*`. Change the DSN.

Container: `ghcr.io/epure-sh/epure:v0.1.0` (also `:latest`).

### Added

- Envelope + store ingest · spike valve · async **202** worker
- JS/TS sourcemap demangle · fingerprint grouping · PII scrub
- PostgreSQL 16 + RLS · monthly partitions + TTL
- Dashboard triage · Google OAuth + password · keyboard `j` `k` `e` `i`
- Regressions · snooze · velocity · webhooks · multi-project · RBAC
- Register preview projects (`is_demo`) with sample stacks
- Project activity charts · `./scripts/seed.sh` heavy fixtures
- Zero-config `docker compose up` · optional `./configure`
- Community health files under `.github/` · deploy overlays under `deploy/`

### Numbers

- Idle footprint (2026-09-23, 2 vCPU / 769 MiB VPS): Epure ~**5 MiB** + Postgres ~**48 MiB**
- Earlier Docker Desktop idle (2026-09-20): application container ~**50 MiB**
- Time to first issue (warm compose): ~**10 s**

### Not included

Tracing · replay · profiling · generic logs · iOS/Android · Redis / Kafka / ClickHouse.

---

[Apache 2.0](LICENSE) · Docs: [epure.sh/docs](https://epure.sh/docs) · [CONTRIBUTING](CONTRIBUTING.md)
