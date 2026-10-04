# Changelog

Notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Site changelog: [epure.sh/docs/changelog](https://epure.sh/docs/changelog).

## Unreleased

Nothing yet.

## [v0.1.7] — 2026-10-04

Envelope ingest accepts gzip/zlib bodies (PHP/Laravel, Java, Ruby, .NET defaults) and CRLF item separators. Outbound webhooks pin DNS to the validated address (SSRF rebinding guard). Auth, webhook, and ingest hardening.

- **Release:** [GitHub v0.1.7](https://github.com/epure-sh/epure/releases/tag/v0.1.7)
- **Compare:** [v0.1.6…v0.1.7](https://github.com/epure-sh/epure/compare/v0.1.6...v0.1.7)
- **Image:** `ghcr.io/epure-sh/epure:v0.1.7`
- **Docs:** [epure.sh/docs/changelog](https://epure.sh/docs/changelog)

### Fixed

- Envelope parse decompresses gzip/zlib before scanning items (Laravel `http_compression` default)
- CRLF (`\r\n`) envelope separators are normalized
- Integration matrix covers every `fixtures/sentry/*/envelope.txt` raw + gzip, plus Laravel multi-item, numeric DSN, and query auth
- Webhook dispatch pins HTTP connect to the IP addresses validated by the SSRF guard (blocks DNS rebinding / TOCTOU between check and request)
- Personal access tokens: invitation routes require `write:admin`. Unlisted mutating routes are denied.
- Webhook SSRF guard rejects IPv6 unique-local addresses and private IPv4 embedded in 6to4 or NAT64.
- Webhook signatures are HMAC-SHA256 over `X-Epure-Timestamp`, a dot, and the raw body. Receivers must include the timestamp.
- Password changes revoke that user's agent tokens and invalidate other dashboard sessions.
- Login rate limits and stored client IPs use `X-Forwarded-For` only when the TCP peer is listed in `EPURE_TRUSTED_PROXIES`.
- New DSN secrets are stored as argon2id hashes. Public-key ingest is unchanged.
- SPA responses send CSP, `nosniff`, `DENY` framing, and `no-referrer`. Ingest CORS no longer reflects an origin that is not on the allowlist.
- Login and register stay on the form when the page is HTTP and the session cookie is Secure. The browser would drop `__Host-epure.sid` and send you back with no error.
- `GET /api/v1/auth/config` includes `session_secure`.

### Added

- `docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml --profile tls up -d` starts Caddy on ports 80 and 443 (`deploy/Caddyfile`).
- `./configure --prod` requires an `https://` DNS name and writes `EPURE_SITE_ADDRESS`. A raw IP is refused.

### Upgrade

`git pull`, pin `EPURE_IMAGE=ghcr.io/epure-sh/epure:v0.1.7`, `docker compose up -d`. Migration `20261001120000_credential_generation` runs on startup. Set `EPURE_TRUSTED_PROXIES` to your reverse proxy. Webhook receivers must verify the timestamp. Existing sessions sign in again. Open `https://your-hostname/login`. Do not sign in at `http://YOUR_SERVER:8080`. Drop `--profile tls` only when you already terminate HTTPS.

## [v0.1.6] — 2026-10-01

`epure-cli` ships in the GHCR image. PAT/MCP rate limits raised for agent loops.

- **Release:** [GitHub v0.1.6](https://github.com/epure-sh/epure/releases/tag/v0.1.6)
- **Compare:** [v0.1.5…v0.1.6](https://github.com/epure-sh/epure/compare/v0.1.5...v0.1.6)
- **Image:** `ghcr.io/epure-sh/epure:v0.1.6`
- **Docs:** [epure.sh/docs/changelog](https://epure.sh/docs/changelog)

### Fixed

- Image workflow packs `epure-cli` beside `epure` (`Dockerfile.runtime`)
- PAT / MCP rate limits: **600 reads** and **120 writes** per minute (was 120 / 20); failed PAT attempts still consume the bucket

### Upgrade

`git pull`, pin the current release tag in `EPURE_IMAGE` (see [Releases](https://github.com/epure-sh/epure/releases) or [Installation](https://epure.sh/docs/self-hosting/installation)), then `docker compose up -d`. No migration.

## [v0.1.5] — 2026-10-01

Ingest now accepts official Sentry SDK DSN auth that omits `sentry_secret`.

- **Release:** [GitHub v0.1.5](https://github.com/epure-sh/epure/releases/tag/v0.1.5)
- **Compare:** [v0.1.4…v0.1.5](https://github.com/epure-sh/epure/compare/v0.1.4...v0.1.5)
- **Image:** `ghcr.io/epure-sh/epure:v0.1.5`
- **Docs:** [epure.sh/docs/changelog](https://epure.sh/docs/changelog)

### Fixed

- Ingest DSN auth no longer requires `sentry_secret`; `sentry_key` alone is accepted and `sentry_secret` is validated only when present

### Upgrade

`git pull`, set `EPURE_IMAGE=ghcr.io/epure-sh/epure:v0.1.5`, then `docker compose up -d`. Re-copy the DSN from Settings if clients still fail with `invalid_dsn` — modern SDKs send public-key-only auth.

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

Create the account you need, `git pull`, set `EPURE_REGISTRATION=false`, pin `EPURE_IMAGE` if needed, recreate the container. Image pin alone does not refresh compose/env from an old checkout. No migration.

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
