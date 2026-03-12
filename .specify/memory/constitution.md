<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0 (MINOR: dashboard auth methods)
Modified principles: II (auth), tech stack Auth row
Dashboard auth: Google OAuth OR email/password only (magic-link removed)
S3c refactor complete: password_hash + google_sub + org_invitations; magic_link_tokens dropped
-->

# Epure Constitution

Binding law for all specs, plans, tasks, and code in `apps/epure`. When this
document disagrees with a digest or agent hydration file, **this document wins**
until formally amended.

Canonical sources (read for detail; do not contradict this law):

- `business/THESIS.md` · `WEDGE.md` · `FEATURES.md` · `ARCHITECTURE.md` · `PRODUCT.md`
- `apps/epure/CONTEXT.md` · `ROADMAP.md`
- `web/design/README.md` · `components.md` · `qa.md`

---

## Core Principles

### I. Exception-Only

Error tracking only: envelopes in → grouped issues → readable stacks → calm triage.

**MUST**

- Accept Sentry envelope and legacy store payloads for **exception events only**.
- Extract breadcrumbs as **crash context** (clicks, navigation, console, HTTP leading to the crash).
- Group issues deterministically and surface keyboard-first triage.

**MUST NOT**

- Add distributed tracing, APM spans, session replay, continuous profiling, or generic log ingestion.
- Persist or index transaction envelope items — **discard them**.
- Treat breadcrumbs as a standalone log analytics product.

**Rationale:** Exception-only scope cuts ~90% of data volume, UI complexity, and infra cost. Epure is not an observability suite.

---

### II. Rust Binary + PostgreSQL 16, Lite Compose

Phase 1 OSS = one Rust binary (ingest + management API + rust-embed SPA) +
`postgres:16-alpine` in `docker-compose.yml` (**2 containers**).

**MUST**

- Ship as a **single Rust artifact** serving ingest, dashboard API, and embedded SPA.
- Use **PostgreSQL 16** as the primary store with SQLx, monthly event partitions, and TTL via partition drop.
- Enforce multi-tenant dashboard isolation via **PostgreSQL RLS** scoped by `app.current_org_id` from session.
- Store sessions in Postgres (`tower-sessions`). Password credentials hashed with **argon2id**.
- Dashboard login: **Google OAuth (OIDC)** OR **email + password** only — no magic-link, no other SSO in Phase 1 OSS.
- Scope **ingest** by DSN project credentials; scope **dashboard** by RLS org context.
- Run OSS in `--mode=all` only until Phase 2 split modes exist.

**MUST NOT**

- Use Redis, Kafka, NATS, or ClickHouse on the OSS path.
- Use SQLite (or any embedded DB) as the **primary** store.
- Add Nginx, Node, Python, or JVM runtimes to the product compose.
- Publish RAM or footprint numbers until measured on target hardware.

**Rationale:** Lite compose replaces Sentry's 20+ container stack while keeping real multi-tenant isolation. Postgres + RLS beats app-filter-only tenancy.

---

### III. Honest Sentry Wire

Implement Sentry **envelope** and **legacy store** ingest so official SDKs work by changing `dsn`.

**MUST**

- Support `POST /api/{project_id}/envelope/` and `POST /api/{project_id}/store/`.
- Handle DSN/CORS preflight for browser SDKs.
- Maintain fixture dumps for browser, Node, Python, Go, Ruby, PHP, Java, and .NET at minimum.
- Publish a **versioned compatibility matrix** (honest SDK/version coverage).
- Symbolicate **JS/TS source maps only** in Phase 1; other languages group on raw frames.

**MUST NOT**

- Claim 100% Sentry protocol parity in docs, marketing, or code comments.
- Ship iOS/Android native symbolication, dSYM/ProGuard/NDK servers, or Cocoa/Android fixtures in Phase 1.

**Rationale:** Wire compatibility is the adoption accelerant; honesty about gaps builds trust. Mobile native symbolication is deferred, not hidden.

---

### IV. Ingress Stays Cheap

The hot path must stay fast, bounded, and non-blocking.

**MUST**

- Return **HTTP 202 Accepted in <10 ms** under normal load after constant-time DSN validation.
- Parse envelopes with **zero-allocation slicing** (`memchr` / `bytes`) — no full-copy JSON on the hot path.
- Reject request bodies **>2 MB** (`DefaultBodyLimit`).
- Run the **Spike-Proof Counter Valve**: per-fingerprint token bucket; when saturated, discard payload bodies and increment counters only.
- Decouple persistence via **Tokio `mpsc`** — no Redis queue in OSS.
- Micro-batch Postgres writes (≤500 ms **or** ≤500 events, whichever comes first).
- Compare DSN secrets with **constant-time** equality.
- Authenticate dashboard users with **HttpOnly, Secure, SameSite=Lax `__Host-` cookies** — no tokens in `localStorage`.

**MUST NOT**

- Block HTTP responses on disk writes, sourcemap demangling, or webhook dispatch.
- Persist one row per event on the ingest hot path.

**Rationale:** Client apps must never stall on error reporting. Spike valve protects RAM, disk, and operator sanity during infinite loops.

---

### V. Spec-Driven, No Stack Drift

Phase 1 MUST ship **every row** in `business/FEATURES.md` Tiers 1–6, one ROADMAP slice at a time (S0→S6).

**MUST**

- Follow `apps/epure/ROADMAP.md` sequentially; a slice is done when its **proof** passes, not when code merges.
- Use SpecKit workflow: spec → plan → tasks → implement against this constitution.
- Keep product code in `apps/epure` only; domain is **`epure.sh`**.

**MUST NOT**

- Introduce Redis, SQLite-as-primary, SSR triage UI, or billing adapters in OSS crates.
- Ship a thinner "Show HN cut" that omits FEATURES matrix rows.
- Rebuild the waitlist inside this repo (already shipped elsewhere).
- Start Phase 2 Cloud split modes, Stripe, or `ee/` billing before OSS Phase 1 exit criteria in `ROADMAP.md`.

**Rationale:** Spec-driven delivery prevents scope creep and stack drift. Full Tier 1–6 OSS is the product promise, not a demo.

---

### VI. Design System Is the Only Visual Source

Product UI MUST consume `web/design/tokens.css` via the `@design` alias. Hex lives only in tokens.

**MUST**

- Respect layer order: **tokens → `web/src/ui` → `web/src/shell` → `web/src/features`**.
- Ship UI kit + AppShell (`web/design/README.md`) **before** FEATURES Tier 4 triage screens (ROADMAP S3b).
- Add new controls in `ui/` with a recipe in `web/design/components.md` before use in features.
- Pass `web/design/qa.md` before declaring any UI slice complete.
- Use token class names (`bg-surface`, `text-ink`, `bg-accent`) — never arbitrary hex in JSX.

**MUST NOT**

- Fork or copy `tokens.css` into `web/src/` (use `web/design/tokens.css` via `@design`).
- Paste stock shadcn themes or default Tailwind palette as brand colors.
- Add hex literals, `bg-[#…]`, or inline color styles in product UI (except true runtime layout like bar widths).

**Rationale:** One visual source enables rebrand without hunting screens. Kit-before-triage prevents one-off UI debt.

---

## Tech Stack Lock

| Layer | Choice | Notes |
|---|---|---|
| Server | Rust, Axum, Tokio, SQLx, mimalloc, rust-embed | Single binary; not Go/Node in production |
| Envelope parse | `memchr` / `bytes` slicing | Hot path; 2 MB body cap |
| Queue | Tokio `mpsc` | No Redis/NATS/Kafka in Phase 1 OSS |
| DB | PostgreSQL 16, RLS, monthly `events_YYYY_MM` partitions | Alpine in compose; TTL = drop old partitions |
| Auth | Google OIDC + email/password (argon2id), tower-sessions (Postgres store) | `__Host-` session cookies; no localStorage tokens |
| Demangle | `sourcemap` crate | JS/TS `.map` in-process; local volume for artifacts |
| UI | React 19, Vite, TypeScript, Radix, Tailwind v4, cmdk, TanStack Query | SPA only; rust-embed delivery |
| Design | `@design` → `web/design/tokens.css` | Extend `web/design/tailwind.theme.cjs`; no duplicated hex |
| OSS compose | `epure` + `postgres:16-alpine` | 2 containers; no Nginx/Node sidecars |

Introducing a row not listed here, or swapping a locked choice, requires a **constitution amendment** (MINOR or MAJOR version bump).

---

## Licensing & Phasing

**Phase 1 — OSS (now)**

- License: **Apache 2.0**
- Scope: full core (FEATURES Tiers 1–6); **no crippleware**
- Deploy: 2-container compose above
- Proof inventory: measure RAM, binary size, SDK matrix before publishing claims

**Phase 2 — Cloud (future)**

- Managed hosting: Pro **$24** / Plus **$79** — flat tiers, **no per-event overages**
- Additions: Stripe, split binary modes (`ingress` / `worker` / `api`), Redis buffer, R2 for sourcemaps, soft-sampling ("Count 100%, Store 10%")
- Enterprise extras (`ee/`): SSO, audit logs, etc. — not in OSS crates

**Out of repo:** waitlist (already shipped). Marketing site: dedicated landing repo — not this product tree.

---

## Development Workflow

1. **Load law:** this constitution → `ROADMAP.md` (active slice) → relevant `FEATURES.md` rows.
2. **Specify one slice:** `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
3. **UI slices:** kit + AppShell (S3b) before triage (S4); gate on `QA.md`.
4. **Proof over narrative:** each ROADMAP slice lists concrete proofs (Postgres row, spike counter, RLS isolation, keyboard triage, etc.). Do not mark done without running them.
5. **Fixtures:** maintain `fixtures/sentry/` dumps for wire compatibility tests.
6. **Anti-features check:** any PR adding tracing, replay, profiling, generic logs, Redis on OSS path, or SQLite-as-primary **fails review**.

Build order (Phase 1):

1. Gateway + persist (S1)
2. Processing — sourcemaps, grouping, breadcrumbs, PII (S2)
3. Storage — RLS, partitions, TTL, unique users (S3)
4. UI kit + AppShell + IA (S3b)
5. Triage DX (S4)
6. Lifecycle + alerting (S5)
7. Admin + RBAC (S6)

---

## Governance

**Supremacy.** This constitution supersedes agent digests (`CONTEXT.md`), cursor rules, and informal chat decisions. Canonical business docs provide rationale; this file provides **enforceable MUST/MUST NOT** rules.

**Amendments.**

1. Propose change with version bump rationale (MAJOR = principle removal/redefinition; MINOR = new principle or material expansion; PATCH = clarifications only).
2. Update this file and the Sync Impact Report comment at the top (remove comment before commit).
3. Propagate breaking governance changes to dependent templates and active specs.

**Compliance review.**

- Every spec, plan, and task set MUST cite applicable principles by number (I–VI).
- Every implementation PR MUST be checked against the active ROADMAP slice proof and this constitution.
- Stack or scope violations are blockers — fix or amend the constitution explicitly; do not silently drift.

**Runtime guidance.** Agents load `AGENTS.md` → `CONTEXT.md` → `ROADMAP.md` for hydration; they obey this constitution for law.

---

**Version**: 1.1.0 | **Ratified**: 2026-09-11 | **Last Amended**: 2026-09-12
