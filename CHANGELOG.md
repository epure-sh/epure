# Changelog

Notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Site changelog: [epure.sh/docs/changelog](https://epure.sh/docs/changelog).

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
