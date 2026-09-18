# Changelog

Notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Site changelog: [epure.sh/docs/changelog](https://epure.sh/docs/changelog).

## Unreleased

Nothing yet.

## [v0.1.1] — 2026-09-26

Setup and connection UI cover the full Phase 1 SDK matrix — not only JavaScript.

Container: `ghcr.io/epure-sh/epure:v0.1.1` (also `:latest`).

### Added

- Java and .NET on the setup wizard language picker (with framework icons)
- Shared multi-platform SDK snippets in Connection settings and the Releases empty state
- Envelope parse tests for browser, Node, Go, Ruby, PHP, Java, and .NET fixtures (Python store unchanged)

### Notes

- Ingest stays DSN-only for official Sentry SDKs. Symbolication remains **JS/TS sourcemaps only**; other languages group on raw frames.

## [v0.1.0] — 2026-09-23

First public tag. Exception-only error monitoring. Keep `@sentry/*`. Change the DSN.

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
