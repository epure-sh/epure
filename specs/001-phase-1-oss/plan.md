# Implementation Plan: Phase 1 OSS Exception Monitoring

**Branch**: `001-phase-1-oss` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-phase-1-oss/spec.md`

---

## Summary

Ship the complete Phase 1 OSS product for **Epure** — exception-only error monitoring with honest Sentry wire compatibility, spike-safe ingest, PostgreSQL multi-tenancy, and keyboard-first triage — as a **single Rust binary** (`--mode=all`) plus **postgres:16-alpine** in compose.

Technical approach:

1. **Hot path**: constant-time DSN auth → zero-alloc envelope parse → spike valve → `202 Accepted` → Tokio `mpsc` queue.
2. **Warm path**: worker task demangles (JS/TS), groups by fingerprint, scrubs PII, micro-batches writes to Postgres.
3. **Dashboard path**: session auth → `SET app.current_org_id` → RLS-scoped SQLx queries → embedded React SPA via rust-embed.
4. **Delivery**: ROADMAP slices S0→S6 sequentially; each slice gated by its proof.

---

## Technical Context

**Language/Version**: Rust (stable, edition 2021)

**Primary Dependencies**: Axum, Tokio, SQLx, mimalloc, rust-embed, tower-sessions, axum-login, memchr/bytes, sourcemap crate

**Storage**: PostgreSQL 16 (Alpine in compose); monthly event partitions; RLS via `app.current_org_id`

**Testing**: `cargo test` (unit + integration); fixture-driven envelope tests in `fixtures/sentry/`; ROADMAP proofs per slice

**Target Platform**: Linux/macOS dev; Linux VPS/Docker production (2-container compose)

**Project Type**: Monolithic web service — ingest API + management API + embedded SPA

**Performance Goals**:

- Ingest: HTTP 202 in <10 ms p95 under normal load (post-DSN-check, pre-persist)
- Body cap: 2 MB reject
- Micro-batch: flush at 500 ms or 500 events
- Dashboard: sub-50 ms perceived list transitions (S4)

**Constraints**:

- OSS compose = exactly 2 containers (Epure + postgres)
- No Redis, Kafka, NATS, ClickHouse, SQLite-primary, Nginx, Node in product path
- Exception-only: discard transaction envelope items
- JS/TS sourcemaps only; no iOS/Android
- UI: `@design` tokens only; no hex in JSX

**Scale/Scope**: Full FEATURES Tiers 1–6; 8 SDK fixture languages; 7 ROADMAP slices (S0–S6 + S3b)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Plan compliance | Notes |
|---|---|---|
| **I. Exception-only** | PASS | Envelope parser discards transactions; no tracing/replay/profiling/log ingest crates or routes |
| **II. Rust + Postgres 16** | PASS | Single binary; 2-container compose; RLS for dashboard; DSN for ingest |
| **III. Honest Sentry wire** | PASS | Envelope + store endpoints; fixture matrix; JS/TS demangle only; compatibility matrix in README |
| **IV. Ingress stays cheap** | PASS | mpsc decouple; spike valve; 2 MB cap; constant-time DSN; `__Host-` cookies |
| **V. Spec-driven S0→S6** | PASS | Build order table below mirrors ROADMAP; full FEATURES scope |
| **VI. Design system** | PASS | S3b kit + AppShell before S4; `@design` alias; QA.md gate |

**Forbidden items scan**: No Redis, SQLite-primary, SSR triage, iOS/Android, hex in JSX, Stripe/`ee/` in OSS crates.

**Post-design re-check (Phase 1)**: PASS — data model, contracts, and quickstart align with constitution; no gate violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-phase-1-oss/
├── plan.md              # This file
├── research.md          # Phase 0 — technical decisions
├── data-model.md        # Phase 1 — entities, RLS, partitions
├── quickstart.md        # Phase 1 — run + validate
├── contracts/
│   └── ingest.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (`apps/epure/`)

```text
apps/epure/
├── Cargo.toml                 # Workspace root
├── docker-compose.yml         # Epure + postgres:16-alpine
├── Dockerfile                 # Multi-stage: Vite build → Rust release
├── .env.example
├── crates/
│   ├── envelope/              # Sentry envelope + store parse; zero-alloc hot path
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── envelope.rs    # multipart item scan; discard transactions
│   │       ├── store.rs       # legacy JSON + zlib/gzip
│   │       └── auth_header.rs # X-Sentry-Auth / query sentry_key
│   ├── demangle/              # JS/TS sourcemap resolution (S2)
│   │   └── src/
│   ├── storage/               # SQLx pool, migrations, batch writer, RLS helper
│   │   ├── migrations/        # Numbered SQLx migrations (S1 minimal → S3 full)
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── batch.rs       # micro-batch flush (500ms / 500 events)
│   │       ├── rls.rs         # SET LOCAL app.current_org_id
│   │       └── partitions.rs  # create/drop events_YYYY_MM
│   ├── auth/                  # DSN lookup (S1), sessions + Google/password (S3c), RBAC (S6)
│   │   └── src/
│   │       ├── dsn.rs         # constant-time secret compare; DashMap cache
│   │       ├── session.rs     # tower-sessions Postgres store
│   │       ├── password.rs    # argon2id email+password
│   │       └── google.rs      # Google OIDC
│   └── server/                # Binary entry, Axum router, pipeline, embed
│       └── src/
│           ├── main.rs        # --mode=all (Phase 1 only)
│           ├── config.rs
│           ├── routes/
│           │   ├── ingest.rs  # envelope, store, releases, user-feedback
│           │   ├── health.rs
│           │   ├── api.rs     # dashboard JSON API (S3b+)
│           │   └── spa.rs     # rust-embed fallback
│           ├── pipeline/
│           │   ├── mpsc.rs    # ingest queue
│           │   ├── spike.rs   # per-fingerprint token bucket
│           │   └── worker.rs  # process → batch → storage
│           └── embed.rs
├── web/                       # React 19 + Vite SPA
│   ├── package.json
│   ├── vite.config.ts         # @design → ../../design
│   └── src/
│       ├── main.tsx
│       ├── ui/                # S3b kit primitives
│       ├── shell/             # AppShell, rail, top strip
│       └── features/          # Issues, Releases, Alerts, Settings
├── fixtures/
│   └── sentry/                # SDK envelope dumps per language
│       ├── browser/
│       ├── node/
│       ├── python/
│       ├── go/
│       ├── ruby/
│       ├── php/
│       ├── java/
│       └── dotnet/
└── specs/001-phase-1-oss/     # This feature's design docs
```

**Structure Decision**: Cargo workspace with domain crates (`envelope`, `demangle`, `storage`, `auth`) and a thin `server` binary crate that wires Axum routes, the ingest pipeline, and rust-embed. Frontend lives in `web/` and is compiled into the binary at build time. No separate Node container in compose.

---

## Architecture

### Runtime topology (Phase 1 OSS)

```text
                    ┌─────────────────────────────────────┐
                    │  docker-compose (2 containers)       │
                    │                                      │
  SDK ──POST──►     │  Epure binary (--mode=all)           │
  /envelope/        │  ┌───────────────────────────────┐  │
  /store/           │  │ Axum                           │  │
                    │  │  ingest routes ──► mpsc ──►    │  │
                    │  │  worker (demangle, group, scrub)│  │
                    │  │  batch writer ──────────────┐  │  │
                    │  │  dashboard API + SPA embed   │  │  │
                    │  └──────────────────────────────┘  │
                    │              │ SQLx                 │
                    │              ▼                       │
                    │  postgres:16-alpine                  │
                    │  RLS (app.current_org_id)            │
                    │  events_YYYY_MM partitions           │
                    └─────────────────────────────────────┘
```

### Dual scoping model

| Path | Auth | DB scope |
|---|---|---|
| Ingest (`/api/{project_id}/envelope/`, `/store/`, releases, user-feedback) | DSN public key + secret → `project_id` | Direct writes by `project_id` / `org_id` from DSN lookup — **no RLS session var** |
| Dashboard + management API | Session cookie → user → org membership | `SET LOCAL app.current_org_id = $uuid` on each request; RLS policies enforce isolation |

Ingest workers use a **service role** connection (bypasses RLS) but only write rows for the DSN-resolved project. Dashboard handlers use a **session role** connection with RLS enforced.

### Axum route map (by slice)

| Route | Slice | Auth |
|---|---|---|
| `GET /health` | S0 | None |
| `OPTIONS /api/*` | S1 | CORS preflight |
| `POST /api/{project_id}/envelope/` | S1 | DSN |
| `POST /api/{project_id}/store/` | S1 | DSN |
| `POST /api/{project_id}/releases/{version}/files/` | S2 | DSN |
| `POST /api/{project_id}/user-feedback/` | S5 | DSN |
| `POST/GET /api/v1/auth/*` | S3c | Magic-link + session cookie |
| `GET/POST /api/v1/*` (issues, events, projects, …) | S3c–S6 | Session gate + RLS (auth routes excepted) |
| `GET /*` (SPA fallback) | S3b | Static assets public; API calls require S3c session |

### Ingest pipeline

```text
HTTP handler
  1. DefaultBodyLimit 2MB
  2. DSN auth (constant-time) — reject 401/403
  3. envelope::parse (zero-alloc scan) — extract event item; drop transaction
  4. fingerprint preview (or defer to worker)
  5. spike_valve.check(fingerprint) — if saturated: increment counter only, return 202
  6. mpsc.send(IngestJob { project_id, raw_event, ... })
  7. return 202 Accepted + event_id stub

Worker task(s)
  1. demangle (JS/TS if release artifacts exist)
  2. group (SHA-256 fingerprint)
  3. scrub PII
  4. push to BatchWriter buffer
  5. flush on 500ms timer OR 500 events → COPY/ multi-row INSERT
```

Spike valve state: in-memory `DashMap<fingerprint, TokenBucket>` with periodic counter sync to Postgres.

### SQLx migrations strategy

- Location: `crates/storage/migrations/`
- Tooling: `sqlx migrate` with compile-time checked queries (`SQLX_OFFLINE=true` for CI)
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Phasing:
  - **S1 migrations**: `orgs`, `projects`, `dsn_keys`, `issues`, `events` (single table), `issue_counters`
  - **S2 migrations**: `releases`, `release_artifacts`, breadcrumb JSON columns if not in S1
  - **S3 migrations**: enable RLS policies; convert `events` → partitioned parent + `events_YYYY_MM`; `issue_unique_users`; TTL helper functions
  - **S5–S6 migrations**: webhooks, snooze, org_invitations; S3c auth: password_hash, google_sub (magic-link removed)
- Rule: migrations are **forward-only** and additive; S3 partition cutover uses create-new-partition + attach pattern without breaking S1 proofs

### RLS pattern

```sql
-- Per dashboard request (storage::rls::with_org):
SET LOCAL app.current_org_id = 'uuid-from-session';

-- Example policy on issues:
CREATE POLICY issues_org_isolation ON issues
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

Middleware stack for dashboard routes:

1. Session load (tower-sessions)
2. Auth extract (axum-login)
3. RLS scope setter (SQLx connection hook or explicit `SET LOCAL` per transaction)
4. Handler

### rust-embed SPA serving

- Build: `cd web && npm run build` → `web/dist/`
- Embed: `RustEmbed` with `#[folder = "../../web/dist/"]` in `server`
- Routing: API routes registered first; `fallback(SpaFallback)` serves `index.html` for non-API GET
- Dev: optional `vite dev` proxy to Axum backend (local only; not in compose)

### UI build contract (S3b gate)

Per `web/design/README.md`:

- `@design` → `web/design/tokens.css` (no fork in `src/`)
- Layers: `ui/` → `shell/` → `features/`
- Kit before triage: Button, Input, Badge, Empty, Toast, FairUseBanner, CodeBlock, IssueRow, AppShell
- QA gate: `web/design/qa.md` before S4 starts

---

## Build Order (ROADMAP S0→S6)

| Slice | Crates / areas | Key deliverables | Proof |
|---|---|---|---|
| **S0** | workspace, server stub, compose | `Cargo.toml`, hello binary, `docker-compose.yml`, `GET /health` | `cargo build`; `docker compose config` |
| **S1** | envelope, auth/dsn, storage (minimal), server/ingest, pipeline | envelope + store + CORS + DSN; mpsc + spike; minimal schema; 202 | SDK → 202 → Postgres row; spike counter |
| **S2** | demangle, storage, server/ingest | release files upload; fingerprint; breadcrumbs; PII scrub; metadata | demangled JS/TS; grouped fingerprint; redacted secrets |
| **S3** | storage (RLS, partitions, TTL, unique users), auth/rls middleware | RLS policies; `events_YYYY_MM`; daily drop job; batch writer | org A ≠ org B; partition dropped; counts remain |
| **S3b** | web/ui, web/shell, server/embed | kit + AppShell; `@design`; rust-embed; empty Issues | `QA.md`; `0 UNRESOLVED EXCEPTIONS` |
| **S3c** | auth/session, server/api | Google OAuth + email/password; tower-sessions; session gate on `/api/v1/*`; RLS context | unauthenticated → 401; session → org-scoped rows |
| **S4** | web/features, server/api | keyboard triage; query; diff; merge/bulk; LLM export | keyboard-only triage; export pasteable |
| **S5** | storage, server/api, pipeline | regression; snooze; velocity; webhooks; user-feedback | regression + webhook; snooze holds |
| **S6** | server/api, web/features | RBAC enforcement; projects; DSN rotation; env filter; ingest caps | two projects; revoke → 403; Member ≠ Owner |

---

## Complexity Tracking

No constitution violations requiring justification. Empty by design.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |

---

## Generated Artifacts (Phase 0 + Phase 1)

| Artifact | Path | Purpose |
|---|---|---|
| Research | [research.md](./research.md) | Spike valve, envelope parse, RLS, partitions, rust-embed, Sentry wire notes |
| Data model | [data-model.md](./data-model.md) | Tables, RLS policies, partition strategy |
| Quickstart | [quickstart.md](./quickstart.md) | Compose up, env vars, curl ingest, local dev |
| Ingest contract | [contracts/ingest.openapi.yaml](./contracts/ingest.openapi.yaml) | envelope + store API surface |

**Next command**: `/speckit-tasks` to generate dependency-ordered `tasks.md`.
