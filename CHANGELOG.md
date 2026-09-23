# Changelog

Notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Site changelog: [epure.sh/docs/changelog](https://epure.sh/docs/changelog).

## Unreleased

Nothing yet.

## [v1.1.0] — 2026-09-23

Onboarding and dashboard polish after `v1.0.0`. GHCR: `ghcr.io/epure-sh/epure:v1.1.0` (also `:latest`).

### Added

- Register bootstrap creates **Acme Web** + **Acme API** preview projects with sample issues (stack frames + breadcrumbs), marked `is_demo`
- `GET /api/projects/{id}/activity` — 30-day daily event histogram for org home / project list
- Setup wizard dialog + platform snippets with framework icons (`web/public/frameworks/`)
- `./scripts/seed.sh` — heavy UX seed with `--email` / `--password` / `--link-user` (no passwords in SQL)
- README demo GIF (`.github/readme-shot.gif`)

### Changed

- Issue-list sparklines use **30 daily buckets** (was 72h / 2h)
- Org home and project list show activity charts; demo projects skip the connect wizard
- Seed path: register for preview; `./scripts/seed.sh` for high-volume fixtures (replaces `seed-dev.sh` as the documented path)
- Example DB role passwords rotated at migrate; binary applies real passwords from env after migrate
- Measured idle footprint on a 2 vCPU / 769 MiB VPS (2026-09-23): Epure ~**5 MiB** + Postgres ~**48 MiB** combined ~**53 MiB**

### Fixed

- Setup progress treats any `is_demo` project as preview (not only hard-coded seed UUIDs)
- Clipboard / copy helpers for DSN and setup snippets

### Docs

- README, CONTRIBUTING, issue templates, and PUBLISH checklist updated for the register + `seed.sh` flow
- [SUPPORT.md](SUPPORT.md) — where to ask questions vs report bugs

## [v1.0.0] — 2026-09-19

First tagged `v1` image on GHCR. Same Phase 1 surface as `v0.1.0-phase1`, with publish polish (Compose pulls public image, multi-arch Image workflow, community files).

See the [v1.0.0 GitHub Release](https://github.com/epure-sh/epure/releases/tag/v1.0.0) for the full feature list.

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
