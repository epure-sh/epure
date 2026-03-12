# Tasks: Phase 1 OSS Exception Monitoring

**Feature**: `001-phase-1-oss` | **Branch**: `001-phase-1-oss`

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [data-model.md](./data-model.md) · [ROADMAP.md](../../ROADMAP.md)

**Prerequisites**: Constitution v1.0.0 · [web/design/README.md](../../web/design/README.md) for S3b+

**Forbidden in every task**: Redis, Kafka, NATS, ClickHouse, SQLite-as-primary, SSR triage, iOS/Android, `ee/`, Stripe, hex literals in JSX.

## Format

```text
- [ ] T### [P?] [USn?] Description — files — depends: T### — AC: <ROADMAP proof>
```

- **[P]**: parallel-safe (different files, no incomplete deps)
- **[USn]**: maps to spec user story / ROADMAP slice
- **AC**: acceptance criteria = ROADMAP proof line

## FEATURES.md Coverage Map

| FEATURES row | Task ID(s) | Slice |
|---|---|---|
| Sentry Envelope Parser | T020, T021, T038 | S1 |
| Legacy Store Ingress | T022, T023 | S1 |
| DSN & CORS Preflight | T024, T025, T026 | S1 |
| Spike-Proof Counter Valve | T030, T031 | S1 |
| Non-Blocking Async Buffer | T028, T029, T032 | S1 |
| JS/TS Sourcemap Demangler | T042, T043 | S2 |
| Release Artifact Ingestion | T044, T045 | S2 |
| Breadcrumb Trail Extractor | T046 | S2 |
| Deterministic Grouping | T047, T048 | S2 |
| Metadata Normalization | T049 | S2 |
| Zero-PII Ingestion Scrubber | T050 | S2 |
| Embedded Engine (PostgreSQL 16) | T003, T017, T055, T056 | S0/S1/S3 |
| Automated TTL & Data Pruning | T059, T060 | S3 |
| Unique User Tracking | T061, T062 | S3 |
| Micro-batch writes | T063, T064 | S3 |
| Keyboard-First Navigation | T081 | S4 |
| LLM Context Export | T082 | S4 |
| Occurrence & Release Diff | T083 | S4 |
| Linear-Style Query Syntax | T084 | S4 |
| Breadcrumb & Log Filter | T085 | S4 |
| Manual Merge & Split | T086 | S4 |
| Bulk Actions | T087 | S4 |
| Release & Regression Engine | T095, T096 | S5 |
| Smart Snooze Logic | T097 | S5 |
| Velocity Spike Alerts | T098 | S5 |
| Outbound Webhooks & Chat | T099, T100 | S5 |
| User Crash Dialog API | T101 | S5 |
| Environment Isolation | T108 | S6 |
| Multi-Project Management | T109, T110 | S6 |
| DSN Rotation & Revocation | T111, T112 | S6 |
| Internal Safety Ingestion Caps | T113 | S6 |
| Team Management (RBAC Lite) | T114, T115, T116 | S6 |

---

## S0 — Bootstrap

**Goal**: Workspace and compose stub so S1 has a place to land.

**Slice proof**: `cargo build` && `cargo test` && `docker compose config`

- [x] T001 Create Cargo workspace root in `apps/epure/Cargo.toml` with members `crates/server` (additional crate members added in later slices) — depends: — — AC: S0 proof (cargo build)
- [x] T002 [P] Scaffold `crates/server/Cargo.toml` and `crates/server/src/main.rs` hello binary with `--mode=all` CLI flag stub — depends: T001 — AC: S0 proof (cargo build)
- [x] T003 [P] Add `apps/epure/docker-compose.yml` with services `epure` (build context `.`) and `postgres:16-alpine` (volume, env `POSTGRES_USER/PASSWORD/DB=epure`) — depends: — — AC: S0 proof (docker compose config)
- [x] T004 [P] Add `apps/epure/Dockerfile` multi-stage stub (Rust builder stage; runtime copies binary) — depends: T002 — AC: S0 proof (docker compose config)
- [x] T005 [P] Add `apps/epure/.env.example` with `DATABASE_URL`, `EPURE_BIND`, `EPURE_MODE`, `EPURE_CORS_ORIGINS` — depends: — — AC: S0 proof
- [x] T006 Implement `GET /health` in `crates/server/src/routes/health.rs` returning JSON `{ "status": "ok" }` — depends: T002 — AC: S0 proof (curl health after run)
- [x] T007 Wire Axum router in `crates/server/src/main.rs` (health only; bind from `EPURE_BIND` default `0.0.0.0:8080`) — depends: T006 — AC: S0 proof
- [x] T008 [P] Add workspace `.gitignore` entries for `target/`, `web/dist/`, `.env` in `apps/epure/.gitignore` — depends: — — AC: S0 proof
- [x] T009 **S0 checkpoint**: run `cargo build && cargo test && docker compose config` in `apps/epure/` — depends: T001–T008 — AC: S0 proof passes

---

## S1 — Gateway + Persist (FEATURES Tier 1)

**Goal**: SDK ingest accepted immediately, persisted to Postgres minimal schema, spike-safe.

**Independent test**: SDK → **202** → row in **Postgres**. Spike loop: counter up, bodies dropped. No Redis.

- [x] T010 [P] [US1] Create `crates/envelope/Cargo.toml` and `crates/envelope/src/lib.rs` — depends: T001 — AC: S1 ingest foundation
- [x] T011 [P] [US1] Create `crates/storage/Cargo.toml` and `crates/storage/src/lib.rs` with SQLx Postgres pool factory — depends: T001 — AC: S1 persistence foundation
- [x] T012 [P] [US1] Create `crates/auth/Cargo.toml` and `crates/auth/src/lib.rs` — depends: T001 — AC: S1 DSN auth foundation
- [x] T013 [US1] Add workspace members `envelope`, `storage`, `auth` to `apps/epure/Cargo.toml` and wire `server` dependencies — depends: T010, T011, T012 — AC: S1 cargo build
- [x] T014 [US1] Add S1 migration `crates/storage/migrations/20260101000001_s1_minimal.sql`: `organizations`, `projects`, `dsn_keys`, `issues`, `events`, `issue_counters` per [data-model.md](./data-model.md) — depends: T011 — AC: S1 minimal schema (FR-S01)
- [x] T015 [US1] Add `scripts/seed-dev.sql` seeding one org, project, DSN key for local curl tests — depends: T014 — AC: S1 proof (curl ingest)
- [x] T016 [US1] Implement storage repos `crates/storage/src/issues.rs`, `events.rs`, `counters.rs` for insert/upsert — depends: T014 — AC: SDK → row in Postgres
- [x] T017 [US1] Configure `docker-compose.yml` `epure` service `DATABASE_URL=postgres://epure:epure@postgres:5432/epure` and migration on startup hook in `crates/server/src/main.rs` — depends: T003, T014 — AC: S1 Postgres persistence
- [x] T018 [US1] Implement `crates/envelope/src/auth_header.rs` parsing `X-Sentry-Auth` and query `sentry_key`/`sentry_secret` — depends: T010 — AC: DSN & CORS Preflight (FEATURES Tier 1)
- [x] T019 [US1] Implement constant-time DSN validation in `crates/auth/src/dsn.rs` with `DashMap` cache keyed by public key — depends: T012, T016 — AC: invalid DSN rejected without persist
- [x] T020 [US1] Implement zero-alloc envelope scan in `crates/envelope/src/envelope.rs` (`memchr`/`bytes`); extract `event` items; **discard `transaction` items** — depends: T010 — AC: Sentry Envelope Parser (FEATURES Tier 1)
- [x] T021 [US1] Add unit tests in `crates/envelope/src/envelope.rs` using fixtures from `fixtures/sentry/browser/` and `fixtures/sentry/node/` — depends: T020, T037 — AC: Sentry Envelope Parser fixtures
- [x] T022 [US1] Implement legacy store parser in `crates/envelope/src/store.rs` (JSON; defer gzip/zlib decompress to worker) — depends: T010 — AC: Legacy Store Ingress (FEATURES Tier 1)
- [x] T023 [US1] Add store route tests with `fixtures/sentry/python/` payload in `crates/envelope/src/store.rs` — depends: T022, T037 — AC: Legacy Store Ingress fixtures
- [x] T024 [US1] Implement CORS middleware in `crates/server/src/routes/ingest.rs` for `OPTIONS` + `Access-Control-Allow-Origin` from `EPURE_CORS_ORIGINS` — depends: T007 — AC: DSN & CORS Preflight (FEATURES Tier 1)
- [x] T025 [US1] Implement `POST /api/{project_id}/envelope/` handler in `crates/server/src/routes/ingest.rs` per [contracts/ingest.openapi.yaml](./contracts/ingest.openapi.yaml) — depends: T018, T019, T020 — AC: SDK → 202
- [x] T026 [US1] Implement `POST /api/{project_id}/store/` handler in `crates/server/src/routes/ingest.rs` — depends: T018, T019, T022 — AC: SDK → 202 (store path)
- [x] T027 [US1] Add `DefaultBodyLimit` 2 MB on ingest routes in `crates/server/src/routes/ingest.rs` — depends: T025 — AC: reject body > 2 MB (FR-007)
- [x] T028 [US1] Implement Tokio `mpsc` channel and `IngestJob` type in `crates/server/src/pipeline/mpsc.rs` — depends: T007 — AC: Non-Blocking Async Buffer (FEATURES Tier 1)
- [x] T029 [US1] Implement ingest HTTP handlers to enqueue job and return **202 Accepted** with `{ "id": "<uuid>" }` in <10 ms (no await on persist) — depends: T025, T026, T028 — AC: SDK → 202; Non-Blocking Async Buffer
- [x] T030 [US1] Implement per-fingerprint token bucket (default **100 events/min**) in `crates/server/src/pipeline/spike.rs`; saturated → counter-only — depends: T028 — AC: Spike-Proof Counter Valve (FEATURES Tier 1)
- [x] T031 [US1] Integrate spike valve into ingest handler before enqueue; sync counters to `issue_counters` table in worker — depends: T030, T016 — AC: spike loop counter up, bodies dropped
- [x] T032 [US1] Implement worker task in `crates/server/src/pipeline/worker.rs` consuming mpsc, basic JSON parse, upsert issue+event — depends: T028, T016 — AC: SDK → row in Postgres
- [x] T033 [US1] Register ingest + worker startup in `crates/server/src/main.rs` — depends: T029, T032 — AC: S1 end-to-end
- [x] T034 [P] [US1] Create fixture directories `fixtures/sentry/{browser,node,python,go,ruby,php,java,dotnet}/` with at least one envelope dump each — depends: — — AC: FR-041 fixture minimum
- [x] T035 [P] [US1] Add integration test `crates/server/tests/ingest_envelope.rs`: seed DSN → POST envelope → assert 202 → query `issues` row — depends: T033, T015 — AC: S1 proof
- [x] T036 [US1] Add integration test `crates/server/tests/spike_valve.rs`: 150 identical envelopes → all 202 → `event_count` ≥ 150, `events` rows ≪ 150 — depends: T031, T035 — AC: S1 proof (spike loop)
- [x] T037 [P] [US1] Populate `fixtures/sentry/*/` sample files from real SDK captures (8 languages) — depends: T034 — AC: FR-041
- [x] T038 [US1] **S1 checkpoint**: run S1 proof — SDK → **202** → row in **Postgres**; spike loop — depends: T035, T036 — AC: S1 proof passes

---

## S2 — Processing (FEATURES Tier 2)

**Goal**: Demangled JS/TS stacks, deterministic grouping, breadcrumbs, metadata, PII scrub.

**Independent test**: upload minified + `.map` → crash → original file/function/lines. Same fingerprint groups. Secrets redacted.

- [x] T039 [P] [US2] Create `crates/demangle/Cargo.toml` and `crates/demangle/src/lib.rs` using `sourcemap` crate — depends: T001 — AC: S2 demangle foundation
- [x] T040 [US2] Add workspace member `demangle`; wire into `server` and worker — depends: T039, T013 — AC: S2 cargo build
- [x] T041 [US2] Add S2 migration `crates/storage/migrations/20260102000001_s2_releases.sql`: `releases`, `release_artifacts` — depends: T014 — AC: Release Artifact Ingestion schema
- [x] T042 [US2] Implement JS/TS stack demangle in `crates/demangle/src/sourcemap.rs` resolving file, function, line, context snippet — depends: T039 — AC: JS/TS Sourcemap Demangler (FEATURES Tier 2)
- [x] T043 [US2] Integrate demangle step in `crates/server/src/pipeline/worker.rs` when platform is javascript/typescript and artifact exists — depends: T032, T042 — AC: demangled stack in DB
- [x] T044 [US2] Implement `POST /api/{project_id}/releases/{version}/files/` multipart handler in `crates/server/src/routes/ingest.rs` storing files under `EPURE_ARTIFACTS_DIR` — depends: T025, T041 — AC: Release Artifact Ingestion (FEATURES Tier 2)
- [x] T045 [US2] Add storage repo `crates/storage/src/releases.rs` for release + artifact metadata — depends: T041 — AC: Release Artifact Ingestion
- [x] T046 [US2] Implement breadcrumb extraction in `crates/envelope/src/extract.rs` parsing `breadcrumbs.values` (category, timestamp, level, message) — depends: T020 — AC: Breadcrumb Trail Extractor (FEATURES Tier 2)
- [x] T047 [US2] Implement SHA-256 fingerprint in `crates/envelope/src/fingerprint.rs`: normalized exception type + top in-app frame (file+function+relative line); honor `fingerprint` override — depends: T020 — AC: Deterministic Grouping (FEATURES Tier 2)
- [x] T048 [US2] Wire fingerprint into worker upsert for issue grouping `(project_id, fingerprint)` unique — depends: T047, T032 — AC: same fingerprint groups
- [x] T049 [US2] Implement metadata normalization in `crates/envelope/src/metadata.rs`: User-Agent → OS/browser/device, runtime name/version, `environment`, country from IP — depends: T020 — AC: Metadata Normalization (FEATURES Tier 2)
- [x] T050 [US2] Implement PII scrubber in `crates/envelope/src/scrub.rs` with regex patterns for API keys, Bearer tokens, passwords, credit cards on headers/breadcrumbs/extra — depends: T020 — AC: Zero-PII Ingestion Scrubber (FEATURES Tier 2)
- [x] T051 [US2] Apply scrub + breadcrumb + metadata in worker before persist; store in `events.payload_json`, `stack_frames`, `breadcrumbs` JSONB — depends: T043, T046, T049, T050 — AC: secrets redacted in breadcrumbs
- [x] T052 [P] [US2] Add unit tests `crates/envelope/src/fingerprint.rs` and `scrub.rs` — depends: T047, T050 — AC: S2 unit coverage
- [x] T053 [US2] Add integration test `crates/server/tests/processing_demangle.rs`: upload `.map` + minified crash → assert demangled frames in DB — depends: T043, T044 — AC: S2 proof (demangled stack)
- [x] T054 [US2] **S2 checkpoint**: demangled stack, same fingerprint groups, secrets redacted — depends: T053 — AC: S2 proof passes

---

## S3 — Storage (FEATURES Tier 3)

**Goal**: RLS isolation, monthly partitions, TTL drop, unique users, micro-batch COPY/INSERT.

**Independent test**: org A cannot read org B rows; old partition dropped; issue counts remain.

- [x] T055 [US3] Add S3 migration `crates/storage/migrations/20260103000001_s3_rls_partitions.sql`: enable RLS policies on tenant tables using `app.current_org_id`; create `epure_app` role — depends: T014 — AC: Embedded Engine RLS (FEATURES Tier 3)
- [x] T056 [US3] Convert `events` to `PARTITION BY RANGE (occurred_at)` parent + create current month child `events_YYYY_MM` in same migration — depends: T055 — AC: monthly partitions
- [x] T057 [US3] Implement `crates/storage/src/rls.rs` helper executing `SET LOCAL app.current_org_id = $1` per dashboard transaction — depends: T055 — AC: cross-org isolation
- [x] T058 [US3] Create dual pool config in `crates/storage/src/lib.rs`: `ingest_pool` (BYPASSRLS service role) and `app_pool` (RLS enforced) — depends: T055 — AC: dual scoping model (FR-T01/T02)
- [x] T059 [US3] Implement partition manager in `crates/storage/src/partitions.rs`: create next month partition; drop partitions past retention — depends: T056 — AC: Automated TTL & Data Pruning (FEATURES Tier 3)
- [x] T060 [US3] Implement daily TTL job in `crates/server/src/jobs/ttl.rs` respecting per-project `retention_days` (14|30|90, default **30**) — depends: T059 — AC: old partition dropped; issue aggregates remain
- [x] T061 [US3] Add migration table `issue_unique_users(issue_id, user_key)` and repo `crates/storage/src/unique_users.rs` — depends: T055 — AC: Unique User Tracking schema
- [x] T062 [US3] Update worker to upsert `issue_unique_users` from `user.id` or `user.email`; increment `issues.unique_user_count` — depends: T061, T051 — AC: Unique User Tracking (FEATURES Tier 3)
- [x] T063 [US3] Implement micro-batch writer in `crates/storage/src/batch.rs` buffering events; flush at **500 ms OR 500 events** — depends: T016 — AC: micro-batch writes (FR-018)
- [x] T064 [US3] Replace worker single-row inserts with batch flush using multi-row INSERT or `COPY` in `crates/storage/src/batch.rs` — depends: T063, T032 — AC: micro-batch COPY/INSERT
- [x] T065 [US3] Add integration test `crates/server/tests/rls_isolation.rs`: two orgs seeded → org B session query returns zero org A issues — depends: T057, T058 — AC: S3 proof (cross-org isolation)
- [x] T066 [US3] Add integration test `crates/server/tests/ttl_partition.rs`: insert backdated partition → run TTL job → partition dropped, `issues.event_count` preserved — depends: T060 — AC: S3 proof (partition drop)
- [x] T067 [US3] **S3 checkpoint**: dashboard query cannot read other org's rows; old partition dropped; counts remain — depends: T065, T066 — AC: S3 proof passes

---

## S3b — UI Kit + AppShell (required before S4)

**Goal**: Token-bound kit, AppShell IA, rust-embed serves SPA. No triage logic yet.

**Independent test**: `web/design/qa.md` passes; `0 UNRESOLVED EXCEPTIONS` empty state; no hex in JSX.

- [x] T068 [P] [US4] Initialize `web/package.json`, Vite, React 19, TypeScript, Tailwind v4 in `apps/epure/web/` — depends: T009 — AC: S3b SPA scaffold
- [x] T069 [P] [US4] Configure `web/vite.config.ts` alias `@design` → `web/design` and extend `web/design/tailwind.theme.cjs` — depends: T068 — AC: @design alias (FR-020)
- [x] T070 [US4] Import `@design/tokens.css` once in `web/src/main.tsx` — depends: T069 — AC: web/design layer 1
- [x] T071 [P] [US4] Implement UI primitives in `web/src/ui/`: `button.tsx`, `input.tsx`, `badge.tsx`, `empty.tsx`, `toast.tsx`, `fair-use-banner.tsx`, `code-block.tsx`, `issue-row.tsx` using token classes only — depends: T070 — AC: web/design/components.md kit inventory
- [x] T072 [US4] Implement AppShell in `web/src/shell/app-shell.tsx`, `rail.tsx`, `top-strip.tsx` (40px) — depends: T071 — AC: web/design README shell layer
- [x] T073 [P] [US4] Add route stubs in `web/src/features/`: `issues/index.tsx`, `releases/index.tsx`, `alerts/index.tsx`, `settings/index.tsx` — depends: T072 — AC: IA route stubs
- [x] T074 [US4] Implement Issues empty state copy `0 UNRESOLVED EXCEPTIONS` + DSN paste hint in `web/src/features/issues/index.tsx` — depends: T073 — AC: S3b proof empty state
- [x] T075 [US4] Add `RustEmbed` static serving in `crates/server/src/embed.rs` and SPA fallback in `crates/server/src/routes/spa.rs` — depends: T007 — AC: rust-embed serves SPA (FR-019)
- [x] T076 [US4] Wire Dockerfile web build stage: `npm ci && npm run build` → copy `web/dist` for embed — depends: T004, T068 — AC: compose builds embedded SPA
- [x] T077 [US4] Run through `web/design/qa.md` checklist; fix any token/hex violations in `web/src/` — depends: T071, T072, T074 — AC: S3b proof (qa.md passes; no hex in JSX)
- [x] T078 [US4] **S3b checkpoint**: AppShell renders; QA.md green — depends: T077 — AC: S3b proof passes

---

## S3c — Session auth (dashboard gate, before S4)

**Goal**: Magic-link login + tower-sessions + session middleware on all `/api/v1/*` before any dashboard API ships (FR-T02, FR-040, constitution Principle II).

**Independent test**: unauthenticated `GET /api/v1/issues` → 401; after Google or password login → 200 with RLS-scoped rows only.

> **Note (constitution v1.1.0):** T103–T105 originally shipped magic-link; superseded by T134–T140 (Google OAuth + email/password). Tasks remain checked — behavior converged in auth refactor.

- [x] T103 [US6] Add migration `crates/storage/migrations/20260104000001_s3c_auth.sql`: `users`, `org_members` — depends: T055 — AC: auth schema ready before dashboard API
- [x] T104 [US6] Implement session store in `crates/auth/src/session.rs` with HttpOnly Secure SameSite=Lax cookies — depends: T103, T012 — AC: session auth (FR-040)
- [x] T105 [US6] Implement auth routes in `crates/server/src/routes/api/auth.rs` — depends: T104 — AC: login flow works before triage
- [x] T121 [US4] Implement dashboard session gate in `crates/server/src/routes/api/mod.rs`: require valid session on all `/api/v1/*`; load org from `org_members`; `SET LOCAL app.current_org_id`; 401 if unauthenticated — depends: T105, T057, T058 — AC: FR-T02 (session + RLS before dashboard routes)
- [x] T122 [US4] **S3c checkpoint**: integration test `crates/server/tests/session_gate.rs` — no session → 401 on `/api/v1/issues`; verified session → org-scoped rows only — depends: T121 — AC: S3c proof passes

---

## S4 — Triage (FEATURES Tier 4)

**Goal**: Keyboard-first Issues master-detail on kit; query, diff, merge, bulk, LLM export.

**Independent test**: throw → issue in master-detail; keyboard triage without mouse; export pasteable in Cursor; no new colors.

- [x] T079 [US4] Implement dashboard issues API `GET/PATCH /api/v1/issues` in `crates/server/src/routes/api/issues.rs` (session gate from T121; RLS via `app_pool`) — depends: T122, T078 — AC: issue list for triage
- [x] T080 [US4] Implement events API `GET /api/v1/issues/{id}/events` in `crates/server/src/routes/api/events.rs` — depends: T079 — AC: master-detail data
- [x] T081 [US4] Implement keyboard navigation (`j`/`k`/`e`/`i`/`x`/`/`) with optimistic updates in `web/src/features/issues/issue-list.tsx` — depends: T079, T078 — AC: Keyboard-First Navigation (FEATURES Tier 4)
- [x] T082 [US4] Implement LLM export hotkey `Cmd+Shift+C` in `web/src/features/issues/export-markdown.ts` (exception, stack, last 5 breadcrumbs, tags; sanitized) — depends: T080 — AC: LLM Context Export (FEATURES Tier 4)
- [x] T083 [US4] Implement occurrence/release diff panel in `web/src/features/issues/diff-panel.tsx` comparing two event JSON payloads — depends: T080 — AC: Occurrence & Release Diff (FEATURES Tier 4)
- [x] T084 [US4] Implement query parser + bar in `web/src/features/issues/query-bar.tsx` supporting `is:unresolved`, `env:`, `release:`, `user.email:`, `level:`, free text — depends: T079 — AC: Linear-Style Query Syntax (FEATURES Tier 4)
- [x] T085 [US4] Implement breadcrumb filters (All/HTTP/Console/Errors) + regex search in `web/src/features/issues/event-detail.tsx` — depends: T080 — AC: Breadcrumb & Log Filter (FEATURES Tier 4)
- [x] T086 [US4] Implement manual merge: `POST /api/v1/issues/merge` + UI multi-select in `web/src/features/issues/merge-actions.tsx` — depends: T079 — AC: Manual Merge & Split (FEATURES Tier 4)
- [x] T160 [US4] Implement manual split: `POST /api/v1/issues/split` + `GET /issues/{id}/merged` + split UI in `merge-actions.tsx` — depends: T086 — AC: Manual Merge & Split (FEATURES Tier 4)
- [x] T161 [US4] Release-version diff: `GET /issues/{id}/releases`, `?release=` on events API, Occurrence|Release toggle in `diff-panel.tsx` — depends: T083 — AC: Occurrence & Release Diff (FEATURES Tier 4)
- [x] T162 [US4] Integration test `crates/server/tests/merge_split.rs` — depends: T160 — AC: merge then split restores child visibility
- [x] T087 [US4] Implement bulk resolve/ignore/delete in `web/src/features/issues/bulk-actions.tsx` + API endpoints — depends: T079 — AC: Bulk Actions (FEATURES Tier 4)
- [x] T088 [US4] Compose master-detail Issues screen in `web/src/features/issues/index.tsx` using `shell/` + `ui/` only — depends: T081–T087 — AC: throw → issue in master-detail
- [x] T089 [US4] **S4 checkpoint**: keyboard triage without mouse; export pasteable; no off-token colors — depends: T088 — AC: S4 proof passes

---

## S5 — Lifecycle (FEATURES Tier 5)

**Goal**: Regression engine, snooze, velocity alerts, webhooks, user feedback.

**Independent test**: resolve-in-release → recurrence → Regression + webhook; snooze holds; Alerts rail real.

- [x] T090 [US5] Add S5 migration `crates/storage/migrations/20260105000001_s5_lifecycle.sql`: `webhooks`, `alerts`, `user_feedback`; snooze columns on `issues` — depends: T055 — AC: lifecycle schema
- [x] T091 [US5] Implement regression state machine in `crates/server/src/lifecycle/regression.rs`: `resolved_in_release` → auto `regression` when fingerprint recurs in later release — depends: T048, T090 — AC: Release & Regression Engine (FEATURES Tier 5)
- [x] T092 [US5] Wire regression detection into worker after grouping in `crates/server/src/pipeline/worker.rs` — depends: T091 — AC: regression on recurring fingerprint
- [x] T093 [US5] Implement snooze evaluation in `crates/server/src/lifecycle/snooze.rs` (4 hours | 100 occurrences | 10 unique users) — depends: T090 — AC: Smart Snooze Logic (FEATURES Tier 5)
- [x] T094 [US5] Implement velocity spike detector (>300% in 15 min sliding window) in `crates/server/src/lifecycle/velocity.rs` — depends: T030 — AC: Velocity Spike Alerts (FEATURES Tier 5)
- [x] T095 [US5] Persist alerts to `alerts` table; expose `GET /api/v1/alerts` — depends: T094, T090 — AC: Alerts rail is real
- [x] T096 [US5] Surface Alerts route data in `web/src/features/alerts/index.tsx` (replace stub) — depends: T095, T073 — AC: Alerts rail is real (S5 proof)
- [x] T097 [US5] Implement snooze UI controls on issue detail in `web/src/features/issues/snooze-menu.tsx` — depends: T093, T088 — AC: snooze holds notifications
- [x] T098 [US5] Implement webhook dispatcher in `crates/server/src/lifecycle/webhooks.rs` for `issue_created` and `regression` with Slack/Discord/generic formatters — depends: T090 — AC: Outbound Webhooks & Chat (FEATURES Tier 5)
- [x] T099 [US5] Add webhook CRUD API `crates/server/src/routes/api/webhooks.rs` — depends: T098 — AC: Outbound Webhooks & Chat
- [x] T100 [US5] Implement `POST /api/{project_id}/user-feedback/` DSN-auth route in `crates/server/src/routes/ingest.rs` linking to `event_id` — depends: T025, T090 — AC: User Crash Dialog API (FEATURES Tier 5)
- [x] T101 [US5] Add integration test `crates/server/tests/regression_webhook.rs`: resolve-in-release → same fingerprint new release → Regression + webhook POST — depends: T091, T098 — AC: S5 proof
- [x] T102 [US5] **S5 checkpoint**: regression + webhook; snooze holds; alerts rail live — depends: T101, T096 — AC: S5 proof passes

---

## S6 — Admin (FEATURES Tier 6)

**Goal**: Orgs, projects, DSN rotation, env filter, ingest caps, magic-link RBAC.

**Independent test**: two projects/two DSNs; staging ≠ prod; revoke → 403; Member cannot delete project; SDK → first issue <60s.

- [x] T106 [US6] Implement RBAC middleware in `crates/server/src/routes/api/rbac.rs` enforcing Owner/Admin/Member on destructive/management routes (extends T121 session gate) — depends: T104, T121 — AC: Team Management RBAC Lite
- [x] T107 [US6] Implement projects API CRUD in `crates/server/src/routes/api/projects.rs` (org-scoped via RLS) — depends: T106 — AC: Multi-Project Management (FEATURES Tier 6)
- [x] T108 [US6] Wire global environment filter (`production`|`staging`|`local`) in `web/src/shell/top-strip.tsx` filtering all feature API queries — depends: T072, T079 — AC: Environment Isolation (FEATURES Tier 6)
- [x] T109 [US6] Implement project settings UI in `web/src/features/settings/projects.tsx` (retention 14|30|90 default 30, ingest cap default 5000) — depends: T107, T073 — AC: Multi-Project Management
- [x] T110 [US6] Implement DSN key management UI in `web/src/features/settings/dsn-keys.tsx` — depends: T107 — AC: DSN Rotation & Revocation (FEATURES Tier 6)
- [x] T111 [US6] Implement DSN create/rotate/revoke API in `crates/server/src/routes/api/dsn_keys.rs`; set `revoked_at` → ingest 403 — depends: T107, T019 — AC: revoke key → 403
- [x] T112 [US6] Implement team invitation API + UI in `crates/server/src/routes/api/members.rs` and `web/src/features/settings/team.tsx` — depends: T104, T106 — AC: email invitations with roles (Google or password signup)
- [x] T113 [US6] Enforce per-project ingest cap (default **5000 events/hour**) in `crates/server/src/routes/ingest.rs` returning 403 `ingest_cap_exceeded` — depends: T025, T107 — AC: Internal Safety Ingestion Caps (FEATURES Tier 6)
- [x] T114 [US6] Restrict project deletion to Owner role in `crates/server/src/routes/api/projects.rs` — depends: T106 — AC: Member cannot delete project
- [x] T115 [US6] Add integration test `crates/server/tests/admin_rbac.rs`: Member forbidden delete; revoked DSN → 403 — depends: T111, T114 — AC: S6 proof (revoke, RBAC)
- [x] T116 [US6] Add onboarding script documenting SDK → first issue <60s path in `apps/epure/README.md` (measure before publishing claim) — depends: T033, T088 — AC: new team SDK → first issue <60s
- [x] T117 [US6] **S6 checkpoint**: two projects, two DSNs, staging isolated, revoke → 403, RBAC enforced — depends: T115, T116 — AC: S6 proof passes

---

## Phase 1 Exit — Polish

**Goal**: OSS shippable per ROADMAP Phase 1 exit criteria.

- [x] T118 [P] Write `apps/epure/README.md`: install, compose up, DSN config, honest SDK compatibility matrix — depends: T117 — AC: Phase 1 exit README
- [x] T119 [P] Measure RAM + binary size; record in `marketing/landing/PROOF_INVENTORY.md` (do not publish until measured) — depends: T117 — AC: Phase 1 exit proof inventory
- [x] T120 Run full quickstart validation from [quickstart.md](./quickstart.md) S0–S6 proofs — depends: T117 — AC: all ROADMAP proofs green

---

## Dependencies & Execution Order

```text
S0 (T001–T009)
  └─► S1 (T010–T038)
        └─► S2 (T039–T054)
              └─► S3 (T055–T067)
                    ├─► S3b (T068–T078) ──► S3c (T103–T105, T121–T122) ──► S4 (T079–T089)
                    └─► S5 (T090–T102)  [may start after S3; needs ingest/worker]
                          └─► S6 (T106–T117) [RBAC + admin; session gate from S3c]
                                └─► Polish (T118–T120)
```

**Critical path**: S0 → S1 → S2 → S3 → S3b → **S3c (session gate)** → S4. S5 can overlap S4 backend work after S3. S6 adds RBAC enforcement + admin UI on top of S3c auth.

### Parallel opportunities by slice

| Slice | Parallel tasks |
|---|---|
| S0 | T002, T003, T004, T005, T008 |
| S1 | T010, T011, T012, T034, T037 (after dirs exist) |
| S2 | T039, T052 |
| S3 | — (sequential migrations) |
| S3b | T068, T069, T071, T073 |
| S3c | — (sequential: T103→T105→T121→T122) |
| S4 | T081–T087 (after T079 API; T079 blocked on T122) |
| S5 | T098, T100 (different files) |
| S6 | T108, T109, T110 (after T107) |
| Polish | T118, T119 |

---

## Implementation Strategy

### MVP (stop after S1)

1. Complete S0 + S1 (T001–T038)
2. **Validate**: S1 proof — SDK → 202 → Postgres row; spike valve
3. Demo ingest-only Epure

### Incremental delivery

| Milestone | Slice | User value |
|---|---|---|
| M1 | S1 | Sentry SDK swap DSN, events persisted |
| M2 | S2 | Readable stacks, grouping, PII safe |
| M3 | S3 | Multi-tenant safe, TTL bounded |
| M4 | S3b+S3c+S4 | Login + triage dashboard usable |
| M5 | S5 | Alerts, regression, webhooks |
| M6 | S6 | Team admin, full OSS product |

---

## Notes

- Total tasks: **122** (T001–T120, T121–T122)
- FEATURES Tier 1–6: **31/31 rows** mapped (see coverage table)
- S3b is not a FEATURES row but **blocks S4** per constitution Principle VI
- Mark slice checkpoint tasks before starting next slice
- Run `cargo sqlx prepare` after migration changes for offline CI

## Phase 1: Convergence (S1)

- [x] T123 Implement gzip/zlib decompress for legacy store payloads in `crates/server/src/pipeline/worker.rs` per FR-002 (partial)
- [x] T124 Add integration test `crates/server/tests/ingest_store.rs`: seed DSN → POST store → assert 202 → query `issues` row per FR-002/T026 (partial)

## Phase 2: Convergence (S2)

- [x] T125 Normalize release artifact lookup by basename (strip `~/`, URL prefixes; match `app.min.js` → `app.min.js.map` regardless of upload path) in `crates/storage/src/releases.rs` and worker demangle path per FR-009 (partial)
- [x] T126 Extract `contexts.device` / UA device family in `crates/envelope/src/metadata.rs`; resolve `country_code` from `CF-IPCountry` / `X-Country-Code` when IP geo DB absent per FR-012 (partial)
- [x] T127 Assert demangled `function` + `lineno` in `crates/server/tests/processing_demangle.rs`; fix fixture sourcemap mappings so `throwError` resolves at crash column per FR-008 / US2/AC1 / ROADMAP § S2 proof (partial)
- [x] T128 Mount `EPURE_ARTIFACTS_DIR` volume on `epure` service in `docker-compose.yml` so uploaded maps survive container restarts per plan:quickstart (partial)
- [x] T129 Document release-files route in `specs/001-phase-1-oss/contracts/ingest.openapi.yaml` per plan:ingest contract (missing)

## Phase 3: Convergence (S3)

- [x] T130 Add integration test `crates/server/tests/unique_users.rs`: ingest two events with same `user.id` then one with different `user.id` on same fingerprint → assert `issues.unique_user_count` is 2 and `issue_unique_users` has two rows per US3/AC3 / FR-017 (partial)

## Phase 4: Convergence (S3b)

- [x] T131 Fix AppShell top strip height to 40px in `web/src/shell/top-strip.tsx` and/or `web/tailwind.config.ts` (`h-10` currently maps to `--space-10` = 88px, not 40px per COMPONENTS.md) per FR-021 / T072 / ROADMAP § S3b (partial)

## Phase 5: Convergence (S3c)

- [x] T132 Use `__Host-epure.sid` only when `EPURE_SESSION_SECURE=1`; fall back to `Epure.sid` on HTTP dev so browsers accept the session cookie after magic-link verify per FR-040 / T104 / T122 browser proof (partial)

## Phase 6: Convergence (S3c)

- [x] T133 ~~magic-link dev compose~~ **SUPERSEDED** by constitution v1.1.0 (Google + password auth)

## Auth refactor — constitution v1.1.0 (replace magic-link)

**Goal:** Dashboard login = **Google OAuth OR email + password** only. Keep tower-sessions + session gate (T121). Remove magic-link paths.

- [x] T134 Add migration `20260112000001_auth_google_password.sql`: `users.password_hash`, `users.google_sub`; `org_invitations` (email, org_id, role, token_hash, expires_at); drop or deprecate `magic_link_tokens`
- [x] T135 Implement password auth in `crates/auth/src/password.rs` (argon2id hash/verify) + `POST /api/v1/auth/register`, `POST /api/v1/auth/login` in `auth.rs`
- [x] T136 Implement Google OIDC in `crates/auth/src/google.rs` + `GET /api/v1/auth/google`, `GET /api/v1/auth/google/callback` (link or create user by email; require org_members or create org on first signup)
- [x] T137 Replace `web/src/features/auth/login.tsx`: Google button + email/password form (register + login tabs); remove magic-link UI and `EPURE_EXPOSE_MAGIC_LINK`
- [x] T138 Update `session_gate.rs` and seed: `dev@epure.local` with known password hash; remove magic-link test path
- [x] T139 Remove `magic_link.rs` and magic-link routes; update `.env.example` with `GOOGLE_*` and `EPURE_PUBLIC_URL`
- [x] T140 **Auth refactor checkpoint**: Google OR password login → session cookie → `/api/v1/issues` 200; 401 without session

## Phase 7: Convergence (auth + dev UX)

- [x] T141 Add `dev@epure.local` argon2id `password_hash` (`devpassword`) to `scripts/seed-dev.sql` (or shared seed helper) so `docker compose up` + quickstart login works without a separate test-only seed step per T138 / T140 (partial)
- [x] T142 Update `specs/001-phase-1-oss/quickstart.md` auth env table and S6 proof line: remove magic-link/`EPURE_ADMIN_EMAIL`; document Google OAuth + password login, `GOOGLE_*`, `EPURE_SESSION_SECURE`, and dev credentials per constitution v1.1.0 / FR-038 (partial)
- [x] T143 Expose auth provider config to login UI (e.g. `GET /api/v1/auth/config`) and hide Google button when `GOOGLE_CLIENT_ID` unset; avoid 404 on `/api/v1/auth/google` in default dev compose per T136 / T137 (partial)

## Phase 8: Convergence (S5)

- [x] T144 Assert regression flow inserts `alerts` row (`kind = regression`) in `crates/server/tests/regression_webhook.rs` per US5/AC1 / ROADMAP § S5 (partial)
- [x] T145 Add integration test `crates/server/tests/snooze_holds.rs`: snoozed issue → recurrence → status `regression` but no webhook POST per ROADMAP § S5 / US5/AC2 (partial)
- [x] T146 Add integration test `crates/server/tests/velocity_alert.rs`: burst ingest → `alerts` row `kind = velocity_spike` per US5/AC3 (partial)
- [x] T147 Add integration test `crates/server/tests/user_feedback.rs`: ingest event → `POST .../user-feedback/` → row linked to `event_id` per US5/AC5 / FR-033 (partial)
- [x] T148 Scrub `user_feedback.email` via `scrub_string` in `post_user_feedback` before persist per data-model `user_feedback` / FR-013 (partial)
- [x] T149 Document `POST /api/{project_id}/user-feedback/` in `specs/001-phase-1-oss/contracts/ingest.openapi.yaml` per plan:route map (partial)

## Phase 9: Convergence (S6)

- [x] T150 Apply Admin RBAC to webhook create/delete in `crates/server/src/routes/api/webhooks.rs` per FR-038 / T106 (partial)
- [x] T151 Add integration test for ingest cap breach → 403 `ingest_cap_exceeded` in `crates/server/tests/ingest_cap.rs` per FR-037 / US6/AC4 / T113 (partial)
- [x] T152 Add integration test invitation → register → assigned role in `crates/server/tests/admin_invitations.rs` per US6/AC5 / T112 (partial)
- [x] T153 Extend `crates/server/tests/admin_rbac.rs`: Member 403 on POST dsn-keys and PATCH projects per T115 / FR-038 (partial)
- [x] T154 Expand `specs/001-phase-1-oss/quickstart.md` S6 proof row (two projects, env filter, ingest cap, SDK <60s) per T117 / ROADMAP § S6 (partial)

## Phase 10: Convergence (Phase 1 exit)

- [ ] T155 Publish public GitHub repository (this tree or OSS extract) per ROADMAP Phase 1 exit / spec Phase 1 exit — **ready to publish** (PUBLISH.md checklist green except push/tag; awaiting explicit approval)
- [x] T163 [US5] Webhook admin UI in `web/src/features/settings/webhooks.tsx` (Admin+) — depends: T099 — AC: Outbound Webhooks & Chat (FEATURES Tier 5)
- [x] T164 [US2] Releases list API `GET /api/v1/releases?project_id=` + `web/src/features/releases/index.tsx` — depends: T032 — AC: release artifact visibility
- [x] T165 Add `scripts/test.sh` + `.env.test.example` with `DATABASE_URL` on port 5433 — depends: T017 — AC: local test ergonomics
- [x] T166 Add `LICENSE` (Apache 2.0) at repo root — depends: constitution OSS license
- [x] T167 Rate limit `POST /api/v1/auth/login` and `/register` (in-memory per IP) in `crates/server/src/rate_limit.rs` — depends: T105 — AC: basic auth brute-force protection
- [x] T156 Run migrations + `scripts/seed-dev.sql` automatically on compose first boot (entrypoint or init service) per T141 / quickstart onboarding (partial)
- [x] T157 Measure cold-clone `docker compose up --build` → first issue on clean machine; record in `marketing/landing/PROOF_INVENTORY.md` per SC-001 (partial)
- [x] T158 Execute `web/design/qa.md` checklist and ROADMAP § S4 keyboard triage proof in browser; record pass date in quickstart or ROADMAP per S3b/S4 (partial)
- [x] T159 Update `ROADMAP.md` slice checkboxes and Phase 1 exit checklist to match shipped state per ROADMAP hygiene (partial)
