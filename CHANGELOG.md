# Changelog

Notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Site changelog: [epure.sh/docs/changelog](https://epure.sh/docs/changelog).

## Unreleased

### Changed

- Compose reads `.env` for host ports and public URL (`EPURE_PORT`, `POSTGRES_HOST_PORT`, `EPURE_PUBLIC_URL`). Copy `.env.example`. The binary still binds `8080` inside the container.
- Production overlay: `.env.production.example`, HTTPS required, example DB passwords refused unless `EPURE_PUBLIC_URL` is localhost. Boot sets ingest/app role passwords from `.env` after migrate.
- `docker compose up` pulls `ghcr.io/epure-sh/epure` (`pull_policy: always`). Pin with `EPURE_IMAGE`. Source build: `docker-compose.build.yml`.
- GHCR image is `linux/amd64` + `linux/arm64`. Release tags compile the binary on native GitHub runners, then push a thin runtime image.

## [v0.1.0-phase1] — 2026-09-15

Phase 1 OSS launch. Exception-only monitoring. Keep `@sentry/*`. Change the DSN.

### Added

- Envelope + store ingest · spike valve · async **202** worker
- JS/TS sourcemap demangle · fingerprint grouping · PII scrub
- PostgreSQL 16 + RLS · monthly partitions + TTL
- Dashboard triage · Google OAuth + password · keyboard `j` `k` `e` `i`
- Regressions · snooze · velocity · webhooks · multi-project · RBAC

### Numbers (2026-09-12)

Idle **~82 MiB** · binary **18.1 MiB** · **2** containers · ~**9 s** to first issue (cached).

### Not included

Tracing · replay · profiling · generic logs · iOS/Android · Redis / Kafka / ClickHouse.

---

[Apache 2.0](LICENSE) · Docs: [epure.sh/docs](https://epure.sh/docs) · [CONTRIBUTING](CONTRIBUTING.md)
