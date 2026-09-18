# Changelog

Notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [v0.1.0-phase1] — 2026-09-15

Phase 1 OSS launch. Exception-only monitoring. Keep `@sentry/*`. Change the DSN.

### Added

- Envelope + store ingest · spike valve · async **202** worker
- JS/TS sourcemap demangle · fingerprint grouping · breadcrumb extract · PII scrub
- PostgreSQL 16 + RLS · monthly partitions + TTL · unique users
- Dashboard: Issues / Releases / Alerts / Settings · Google OAuth + password
- Keyboard triage `j` `k` `e` `i` · query syntax · merge/split · Markdown export
- Regressions · snooze · velocity alerts · webhooks · user feedback
- Multi-project · DSN rotate/revoke · RBAC · ingest cap (5000/hour)

### Numbers (2026-09-12, Docker Desktop)

| Metric | Value |
|---|---|
| Idle RAM | **~82 MiB** |
| Binary | **18.1 MiB** |
| Containers | **2** |
| Fresh → first issue | **~9 s** (cached) |
| Warm ingest → visible | **~0.18 s** |

### Compatibility

E2E: browser envelope + Python store. Node: parse + fixture. Other langs: fixtures. Not full Sentry parity — [COMPATIBILITY.md](docs/COMPATIBILITY.md).

### Not included

Tracing · replay · profiling · generic logs · iOS/Android · Redis / Kafka / ClickHouse · Cloud billing.

---

[Apache 2.0](LICENSE) · Docs: [QUICKSTART](docs/QUICKSTART.md) · [SELF_HOST](docs/SELF_HOST.md) · [CONTRIBUTING](CONTRIBUTING.md)

**Managed hosting:** [epure.sh](https://epure.sh) — Pro $24/mo · Plus $79/mo · `support@news.epure.sh`
