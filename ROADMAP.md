# ROADMAP — epure OSS

Phase 1 exception monitoring for self-hosters. UI kit: [web/design/README.md](./web/design/README.md).

**Rule:** one slice at a time. A slice is done when the **proof** works.

Phase 1 = full OSS feature set (S0–S6). Phase 2 = managed Cloud ([epure.sh](https://epure.sh)).

---

## Status

- [x] S0–S6 slices (proofs green — see [docs/QUICKSTART.md](./docs/QUICKSTART.md) + `./scripts/test.sh`)
- [x] Dashboard UX polish (keyboard triage, shell, settings)
- [x] Public GitHub release (`v0.1.0-phase1`)

---

## Phase 1 — OSS slices

### S0 — Bootstrap

Workspace + compose skeleton.

**Proof:** `cargo build`; `docker compose config` validates.

### S1 — Gateway + persist

Envelope + legacy store + DSN/CORS, spike valve, mpsc worker, Postgres persistence.

**Proof:** SDK → **202** → row in Postgres. Spike loop: counter up, bodies dropped.

### S2 — Processing

JS/TS sourcemap demangle, release artifacts, breadcrumbs, fingerprint grouping, PII scrub.

**Proof:** upload minified + `.map`, crash, DB has demangled frames. Same fingerprint groups.

### S3 — Storage

RLS (`app.current_org_id`), monthly event partitions + TTL, unique users, micro-batch inserts.

**Proof:** dashboard cannot read other org's rows; old partition dropped.

### S3b — UI kit + AppShell

Design tokens, kit primitives, shell (rail + top strip), rust-embed SPA.

**Proof:** [web/design/qa.md](./web/design/qa.md) browser pass. No hex in JSX.

### S3c — Session auth

Google OAuth + email/password, tower-sessions, session gate on dashboard APIs.

**Proof:** unauthenticated `/api/v1/issues` → 401; login → org-scoped rows only.

### S4 — Triage

Keyboard-first (`j/k/e/i`), LLM export, query syntax, merge/split, bulk actions.

**Proof:** throw → issue in master-detail; keyboard triage without mouse.

### S5 — Lifecycle

Regression engine, snooze, velocity alerts, outbound webhooks, user feedback.

**Proof:** resolve-in-release → regression + webhook. Snooze holds.

### S6 — Admin

Multi-project, DSN rotation, ingest caps, RBAC, team invites.

**Proof:** two projects + DSNs; revoke key → 403; Member cannot delete project.

---

## Out of scope (Phase 1)

Tracing, replay, profiling, generic logs, iOS/Android symbolication, Redis/Kafka/ClickHouse, "100% Sentry parity."

Phase 2 Cloud (Stripe, multi-tenant hosting) is tracked separately — do not open OSS PRs that assume Cloud infra.
