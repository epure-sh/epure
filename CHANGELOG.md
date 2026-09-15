# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [v0.1.0-phase1] — 2026-09-15

**Phase 1 OSS launch.** Exception-only error monitoring for small teams. Keep your `@sentry/*` SDKs. Change the DSN.

### What it is

epure is self-hosted error tracking without the noise. When production throws, you get a grouped issue with a stack you can read. Two containers (Rust + PostgreSQL 16). No APM, replay, profiling, or session replay.

### Try it

```bash
git clone https://github.com/epure-sh/epure.git && cd epure
docker compose up --build
curl -sS http://localhost:8080/health   # → {"status":"ok"}
```

Open http://localhost:8080, register, create a DSN, point your SDK. Golden path: [docs/QUICKSTART.md](docs/QUICKSTART.md).

### Added

**Ingest & processing (S1–S2)**

- Sentry envelope and legacy store ingest (`POST /api/{project_id}/envelope/`, `POST /api/{project_id}/store/`)
- Spike valve — runaway fingerprints increment counters instead of storing duplicate bodies
- Async mpsc worker pipeline with **202** ingest response
- JS/TS sourcemap demangling; release artifact upload
- SHA-256 fingerprint grouping; breadcrumb extraction; PII regex scrub at ingest
- CORS for browser SDKs; per-project ingest cap (default 5000 events/hour)

**Storage (S3)**

- PostgreSQL 16 with RLS (`app.current_org_id`) for multi-tenant isolation
- Monthly event partitions with TTL drop
- Unique user tracking; micro-batch COPY/INSERT

**Dashboard (S3b–S4)**

- Plausible-shaped UI kit and AppShell (Issues, Releases, Alerts, Settings)
- Session auth: Google OAuth + email/password (argon2id)
- Keyboard triage: `j` / `k` move, `e` resolve, `i` ignore, `x` expand, `/` search
- Query syntax (`is:unresolved`, `env:`, `release:`), breadcrumb filters, merge/split, bulk actions
- Cmd+Shift+C sanitized markdown export for LLM workflows

**Lifecycle (S5)**

- Regression detection when a resolved issue resurfaces in a new release
- Smart snooze (time / count / users); velocity alerts (>300% in 15 min)
- Outbound webhooks (Slack, Discord, generic); user crash feedback ingest

**Admin (S6)**

- Multi-project orgs; DSN create / rotate / revoke
- RBAC: Owner / Admin / Member
- Environment isolation in header (`production` / `staging` / `local`)

### Numbers (measured 2026-09-12, Docker Desktop)

| Metric | Value |
|---|---|
| Idle stack RAM | **~82 MiB** (epure 22.7 MiB + postgres 59.3 MiB) |
| Release binary | **18.1 MiB** |
| Containers | **2** (app + Postgres) |
| Fresh volume → first issue | **9 s** (cached images) |
| Warm stack → first issue | **~2 s** |
| Ingest → visible in dashboard | **0.18 s** |

### Compatibility

- **E2E CI:** `@sentry/browser` 7.120.0 (envelope), Python store
- **Parse tested:** `@sentry/node` 7.120.0 (fixture captured for HTTP ingest)
- **Fixture captured:** Node ingest plus Go, Ruby, PHP, Java, .NET (envelope dumps on disk; HTTP ingest not automated in CI)
- **Not 100% Sentry protocol parity.** Transactions discarded. No replay, profiling, sessions, or iOS/Android symbolication.
- Full matrix: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). Migration guide: [docs/MIGRATION.md](docs/MIGRATION.md).

### Not included (Phase 1)

Tracing, replay, profiling, generic logs, iOS/Android, Redis, ClickHouse, Kafka, SQLite-as-primary, Cloud billing.

### Docs

- [docs/QUICKSTART.md](docs/QUICKSTART.md) — zero to first issue
- [docs/SELF_HOST.md](docs/SELF_HOST.md) — production overlay, env vars, backups
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — ingest pipeline, spike valve, RLS
- [CONTRIBUTING.md](CONTRIBUTING.md) — build, test, PR workflow
- [SECURITY.md](SECURITY.md) — vulnerability reports

### License

[Apache 2.0](LICENSE)

---

**Managed hosting:** [epure Cloud](https://epure.sh) — Pro $24/mo · Plus $79/mo.
