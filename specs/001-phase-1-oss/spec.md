# Feature Specification: Phase 1 OSS Exception Monitoring

**Feature ID**: `001-phase-1-oss`

**Created**: 2026-09-11

**Status**: Complete

**Domain**: epure.sh

**Constitution**: Principles I–VI (`.specify/memory/constitution.md`)

**Input**: Phase 1 OSS exception monitoring for Epure — full FEATURES Tiers 1–6, delivered via ROADMAP slices S0→S6. Official Sentry SDKs work by changing DSN only. Exception-only scope; no observability suite expansion.

---

## Overview

**Epure** is exception-only error monitoring: envelopes in → grouped issues → readable stacks → calm triage. Teams already using official Sentry SDKs adopt by pointing `dsn` at their self-hosted Epure instance. A spike-proof counter valve protects operators from infinite-loop storms. The dashboard delivers keyboard-first triage on a token-bound design system shell.

This specification covers the **complete Phase 1 OSS product** — every row in `business/FEATURES.md` Tiers 1–6 — not a demo subset. Implementation proceeds one ROADMAP slice at a time (S0→S6); each slice is done when its proof passes.

---

## Clarifications

### Session 2026-09-11

Resolved from constitution, `ARCHITECTURE.md`, and `ROADMAP.md` — no open questions.

- **Ingest vs dashboard tenancy** → Ingest routes authenticate by **DSN** (public key + secret → `project_id` → org implicitly via project). Dashboard and management API routes authenticate by **session** and enforce **PostgreSQL RLS** via `app.current_org_id`. Ingest never sets org context; dashboard never trusts client-supplied org IDs.
- **Default OSS retention** → New projects default to **30 days** raw-event retention; admin may change to **14** or **90** days per project. TTL drops monthly partitions past the limit; issue aggregates and counts survive.
- **Spike valve default** → **100 raw events per minute per fingerprint** (fixed default; operator-configurable later). Saturated bucket: discard payload bodies, increment counters only.
- **S1 vs S3 schema** → **S1** ships minimal persistence (orgs, projects, DSN keys, issues, events, counters) without RLS policies or monthly partitions. **S3** adds RLS on all tenant tables, monthly event partitions, TTL drop job, and unique-user tracking — without rewriting S1 ingest paths.
- **Dashboard auth model** → Phase 1 OSS uses **Google OAuth (OIDC)** OR **email + password** only. No magic-link. Passwords stored as argon2id hashes; Google users linked by `google_sub`. Session cookies via tower-sessions (unchanged). Team invites (S6): admin invites email → user completes signup/login with Google or password → role applied.

---

## Scope

### In scope

- Sentry envelope and legacy store ingest with DSN validation and CORS preflight
- Immediate acceptance response with async persistence and spike valve protection
- PostgreSQL-backed multi-tenant storage with row-level isolation, monthly event partitions, and TTL pruning
- Single deployable artifact serving ingest API and embedded dashboard SPA
- JS/TS source map symbolication; raw-frame grouping for other languages
- Breadcrumb extraction, deterministic fingerprint grouping, metadata normalization, PII scrubbing at ingest
- UI kit + AppShell (ROADMAP S3b) before triage screens
- Keyboard-first triage, LLM export, diffs, query syntax, merge/bulk actions
- Regression engine, snooze, velocity alerts, webhooks, user feedback API
- Org/project/DSN/environment administration and RBAC lite
- Wire compatibility fixtures: browser, Node, Python, Go, Ruby, PHP, Java, .NET

### Out of scope

- Redis, Kafka, NATS, ClickHouse, SQLite-as-primary store
- iOS/Android SDKs, dSYM/ProGuard/NDK symbol servers
- Distributed tracing, APM spans, session replay, continuous profiling, generic log ingestion
- Server-side rendered triage UI
- Stripe billing, Cloud split modes, `ee/` enterprise adapters
- Waitlist rebuild (already shipped outside this repo)
- Claiming 100% Sentry protocol parity

---

## User Scenarios & Testing

Stories map to FEATURES tiers and ROADMAP slices. Priorities reflect build order and user value; each story is independently testable once its slice proof passes.

### User Story 1 — SDK Ingest Without Migration (Priority: P1)

**Tier 1 · ROADMAP S1**

As a developer, I point my official Sentry SDK at Epure (change `dsn` only) and exception events are accepted immediately and persisted for later triage.

**Why this priority**: Zero-migration ingest is the adoption wedge. Without accept-and-persist, nothing else matters.

**Independent Test**: Configure any supported SDK fixture, emit one exception, observe accepted response and a retrievable stored event linked to a project.

**Acceptance Scenarios**:

1. **Given** a valid project DSN, **When** the SDK sends an exception via the envelope endpoint, **Then** the client receives an immediate accepted response and the event is persisted.
2. **Given** a valid project DSN, **When** a legacy SDK sends a compressed single-event body to the store endpoint, **Then** the event is accepted and persisted identically to envelope ingest.
3. **Given** a browser SPA instrumented with the official browser SDK, **When** a cross-origin request is made, **Then** CORS preflight succeeds and the event is accepted.
4. **Given** an invalid or revoked DSN secret, **When** an event is sent, **Then** the request is rejected without persisting data.
5. **Given** a repeating crash fingerprint exceeding the spike threshold (100 events/minute), **When** additional events arrive, **Then** the client still receives accepted responses, the issue counter increments, and excess payload bodies are not stored.
6. **Given** a request body exceeding 2 MB, **When** ingest is attempted, **Then** the request is rejected before persistence.

**ROADMAP proof (S1)**: SDK → accepted response → row in database. Spike loop: counter increases, bodies dropped.

---

### User Story 2 — Readable Stacks and Safe Grouping (Priority: P2)

**Tier 2 · ROADMAP S2**

As a developer, crashes from minified JS/TS are demangled via uploaded source maps, grouped deterministically by fingerprint, enriched with breadcrumbs and runtime metadata, and scrubbed of sensitive data at ingest.

**Why this priority**: Readable stacks and trustworthy grouping turn raw events into actionable issues.

**Independent Test**: Upload minified bundle + source map via release artifacts, trigger a crash, verify demangled frames, stable fingerprint, breadcrumb trail, and redacted secrets.

**Acceptance Scenarios**:

1. **Given** uploaded source maps for a release, **When** a minified JS/TS crash arrives, **Then** stack frames show original file, function, line, and code context.
2. **Given** two crashes with the same exception type and top in-app frame, **When** processed, **Then** they appear under one issue (same fingerprint).
3. **Given** a payload with a custom fingerprint override, **When** processed, **Then** grouping respects the override.
4. **Given** a payload with breadcrumb values (HTTP, navigation, console, UI), **When** processed, **Then** breadcrumbs are stored and displayed as crash context.
5. **Given** User-Agent, runtime, environment, and IP metadata in the payload, **When** processed, **Then** normalized tags are available for filtering.
6. **Given** secrets (API keys, bearer tokens, passwords, card patterns) in headers, breadcrumbs, or extra fields, **When** processed, **Then** matching values are redacted before storage.
7. **Given** a non-JS/TS crash (e.g., Python, Go), **When** processed, **Then** grouping works on raw frames without native symbolication.

**ROADMAP proof (S2)**: Upload minified + map → crash → original file/function/lines in storage. Same fingerprint groups. Secrets redacted in breadcrumbs.

---

### User Story 3 — Tenant Isolation and Data Lifecycle (Priority: P3)

**Tier 3 · ROADMAP S3**

As an operator running a shared instance, each organization's data is isolated, events are partitioned for efficient retention, old partitions are dropped on schedule, and unique affected users are tracked per issue.

**Why this priority**: Multi-tenant safety and bounded disk use are required for real self-host deployments.

**Independent Test**: Two orgs with separate sessions — org A cannot query org B rows. TTL job drops expired partition; issue aggregates remain. Distinct user counts reflect unique `user.id` / `user.email`.

**Acceptance Scenarios**:

1. **Given** two organizations on one instance, **When** a user from org A queries the dashboard, **Then** no org B rows are visible.
2. **Given** events older than the project's retention window (default 30 days; configurable to 14 or 90), **When** the daily pruning job runs, **Then** expired raw event partitions are dropped while issue aggregates and counts are preserved.
3. **Given** events with distinct user identifiers, **When** viewed on an issue, **Then** unique affected user counts distinguish one bot from many customers.
4. **Given** sustained ingest load, **When** events are persisted, **Then** writes are batched (not one row per HTTP request on the hot path).

**ROADMAP proof (S3)**: Dashboard query cannot read another org's rows. Old partition dropped; counts remain.

---

### User Story 4 — Keyboard-First Triage on Design System Shell (Priority: P4)

**Tier 4 · ROADMAP S3b then S4**

As an engineer on-call, I triage grouped issues from a fast, keyboard-driven Issues screen built on the shared design system shell — but only after the UI kit and AppShell exist.

**Why this priority**: Triage UX is the daily product surface; it depends on S3b kit infrastructure.

**Prerequisite (S3b)**: Token-bound UI kit, AppShell (rail + top strip + main), route stubs (Issues home, Releases, Alerts, Settings), empty state (`0 UNRESOLVED EXCEPTIONS`), SPA served by the product binary. Proof: `web/design/qa.md` passes.

**Independent Test**: Trigger a crash → issue appears in master-detail Issues view. Resolve, ignore, search, filter, merge, and bulk-act without mouse. Export sanitized Markdown for LLM handoff.

**Acceptance Scenarios**:

1. **Given** unresolved issues exist, **When** the on-call engineer uses `j`/`k`, **Then** list focus moves with sub-50 ms perceived transitions.
2. **Given** a selected issue, **When** the engineer presses `e` or `i`, **Then** the issue is optimistically resolved or ignored.
3. **Given** a selected issue, **When** the engineer presses the LLM export hotkey, **Then** a sanitized Markdown block (exception, demangled stack, last 5 breadcrumbs, runtime tags) is copied.
4. **Given** two events or two releases, **When** the engineer opens diff view, **Then** attribute differences are shown side-by-side.
5. **Given** the query bar, **When** the engineer enters `is:unresolved env:prod release:v1.2`, **Then** results filter accordingly plus free-text substring match.
6. **Given** an event detail view, **When** the engineer toggles breadcrumb filters or regex search, **Then** only matching breadcrumb entries are shown.
7. **Given** multiple selected issues, **When** merge or bulk resolve/ignore/delete is invoked, **Then** the action applies to all selected items.

**ROADMAP proof (S4)**: Throw → issue in master-detail. Keyboard triage without mouse. Export pasteable in Cursor. No new colors outside tokens.

---

### User Story 5 — Lifecycle Alerts and Integrations (Priority: P5)

**Tier 5 · ROADMAP S5**

As a team lead, I rely on regression detection, flexible snooze, velocity spike alerts, outbound webhooks, and user-submitted crash feedback to manage incident noise and response.

**Why this priority**: Lifecycle automation turns a crash inbox into a team workflow.

**Independent Test**: Mark resolved-in-next-release → ship recurrence → regression state + webhook. Snooze holds notifications. Velocity spike fires alert. User feedback links to event.

**Acceptance Scenarios**:

1. **Given** an issue marked "resolved in next release" at version v1.4.0, **When** the same fingerprint appears in release ≥ v1.4.0, **Then** state flips to Regression and alerts fire.
2. **Given** an issue, **When** snoozed for time (4 hours), occurrence count (100), or unique users (10), **Then** notifications are suppressed until the criterion clears.
3. **Given** an issue whose event rate spikes >300% within 15 minutes, **When** the sliding window detects the spike, **Then** a velocity alert triggers.
4. **Given** configured Slack, Discord, or generic webhook endpoints, **When** `issue_created` or `regression` fires, **Then** an outbound HTTP POST is dispatched with a formatted payload.
5. **Given** a crash with an event ID, **When** end-user feedback is submitted via the user-feedback endpoint, **Then** comment, name, and email link to that event.

**ROADMAP proof (S5)**: Resolve-in-release → recurrence → Regression + webhook. Snooze holds. Alerts rail is real.

---

### User Story 6 — Org, Project, and Access Administration (Priority: P6)

**Tier 6 · ROADMAP S6**

As an admin, I manage organizations, projects, DSN keys, environments, ingest caps, and team roles so multiple services and teammates can share one instance safely.

**Why this priority**: Administration completes the self-host product for teams beyond a single developer.

**Independent Test**: Two projects with distinct DSNs; staging environment does not pollute production feed. Revoked key → rejected ingest. Member cannot delete project. Fresh install → first issue under 60 seconds.

**Acceptance Scenarios**:

1. **Given** multiple environments (`production`, `staging`, `local`), **When** the admin selects an environment in the header filter, **Then** all screens show only matching events.
2. **Given** an organization, **When** the admin creates multiple projects, **Then** each has independent DSN keys, retention settings, and notification endpoints.
3. **Given** a compromised public key, **When** the admin revokes it, **Then** subsequent ingest with that key is rejected.
4. **Given** a per-project ingest cap (default example: 5,000 events/hour), **When** exceeded, **Then** excess events are dropped to protect host resources.
5. **Given** a team invitation sent to an email address, **When** the invitee signs in with Google or password, **Then** the assigned role applies (Owner: billing/deletion; Admin: DSN/settings; Member: triage only).

**ROADMAP proof (S6)**: Two projects, two DSNs, staging isolated from prod. Revoke → rejected. Member cannot delete project. New team: SDK → first issue <60s (measure before publishing).

---

### Edge Cases

- **Transaction envelope items**: Discarded; never persisted or indexed (Principle I).
- **Attachment-only or malformed envelopes**: Rejected or stripped; exception events processed; client receives appropriate error for unrecoverable payloads.
- **Missing source maps**: Raw minified frames stored; issue still grouped and triageable.
- **Custom fingerprint collision**: Manual merge available in Tier 4 as safety net.
- **Concurrent spike from multiple fingerprints**: Each fingerprint has independent token bucket; instance remains responsive.
- **Session expiry mid-triage**: User redirected to login; no data leakage across org context.
- **Empty project**: Dashboard shows `0 UNRESOLVED EXCEPTIONS` with DSN paste guidance.
- **Partition boundary**: Events at month rollover land in correct partition without loss.
- **Webhook delivery failure**: Logged; does not block ingest or triage (best-effort dispatch).

---

## Requirements

### Functional Requirements

Requirements map to `business/FEATURES.md` rows. ROADMAP slice in parentheses.

#### Tenancy & Scoping Model

- **FR-T01**: Ingest endpoints (`/envelope/`, `/store/`, `/releases/.../files/`, `/user-feedback/`) MUST authenticate via DSN credentials and scope all writes to the resolved `project_id` (and its parent org) — never via session or RLS session variable.
- **FR-T02**: Dashboard and management API endpoints MUST authenticate via server-side session and scope all reads/writes through PostgreSQL RLS using `app.current_org_id` set from the session — never from request body or query parameters.
- **FR-T03**: A valid ingest DSN MUST NOT grant dashboard access; a valid dashboard session MUST NOT substitute for DSN credentials on ingest routes.

#### Schema Phasing (S1 minimal → S3 full)

- **FR-S01 (S1)**: Minimal schema MUST include organizations, projects, DSN keys, issues, events, and occurrence counters sufficient for ingest persistence and spike-valve proofs. RLS policies and monthly partitions are **not** required in S1.
- **FR-S02 (S3)**: Full schema MUST add RLS policies on all tenant-scoped tables, monthly event partitions (`events_YYYY_MM`), automated TTL partition drops, and unique-user tracking — applied as migrations atop the S1 schema without breaking ingest.

#### Tier 1 — Ingestion & Wire Protocol (S1)

- **FR-001**: System MUST accept exception events via the Sentry envelope endpoint (`POST /api/{project_id}/envelope/`), parsing event items and discarding transaction items.
- **FR-002**: System MUST accept legacy single-event bodies via the store endpoint (`POST /api/{project_id}/store/`), including zlib/gzip-compressed payloads.
- **FR-003**: System MUST validate DSN credentials from `X-Sentry-Auth` header or URL query parameters using constant-time secret comparison.
- **FR-004**: System MUST respond to CORS preflight (`OPTIONS`) on ingest routes with configurable allowed origins for browser SDKs.
- **FR-005**: System MUST apply a per-fingerprint spike valve (token bucket; default **100 raw events/minute**): when saturated, discard payload bodies and increment issue counters only.
- **FR-006**: System MUST return an immediate accepted response (<10 ms under normal load) and decouple persistence from the HTTP response via an in-process async queue (no external message broker in OSS).
- **FR-007**: System MUST reject request bodies larger than 2 MB.

#### Tier 2 — Processing, Demangling & Context (S2)

- **FR-008**: System MUST demangle JS/TS stack frames using uploaded source maps, resolving original file, function, line, and code context.
- **FR-009**: System MUST accept release artifact uploads (`POST /api/{project_id}/releases/{version}/files/`) compatible with standard Sentry CLI and CI plugins.
- **FR-010**: System MUST extract and store breadcrumb trails (category, timestamp, level, message) from crash payloads as context-only data.
- **FR-011**: System MUST compute deterministic issue fingerprints (SHA-256 of normalized exception type + top in-app frame) with support for custom fingerprint overrides.
- **FR-012**: System MUST normalize runtime metadata: User-Agent (OS, browser, device), country from IP, runtime version, and environment tags.
- **FR-013**: System MUST scrub configurable PII patterns (API keys, bearer tokens, passwords, credit card numbers) from headers, breadcrumbs, and extra fields at ingest.

#### Tier 3 — Storage & Data Lifecycle (S3)

- **FR-014**: System MUST persist all tenant data in PostgreSQL 16 with row-level security scoped by organization context from authenticated sessions.
- **FR-015**: System MUST store events in monthly partitions and drop expired partitions on a daily schedule while preserving issue aggregates and counts.
- **FR-016**: System MUST support configurable per-project retention windows of 14, 30, or 90 days, defaulting to **30 days** for newly created projects.
- **FR-017**: System MUST track distinct affected users per issue using `user.id` or `user.email`.
- **FR-018**: System MUST batch persistence writes (threshold: 500 ms or 500 events, whichever comes first).

#### Tier 3b — UI Foundation (S3b)

- **FR-019**: System MUST serve the dashboard as an embedded SPA from the product binary (no separate web server container in compose).
- **FR-020**: Product UI MUST consume design tokens exclusively via the `@design` alias — no forked token files or hex literals in components.
- **FR-021**: System MUST ship UI kit primitives and AppShell (rail, 40px top strip, main) before Tier 4 triage screens, passing `web/design/qa.md`.

#### Tier 4 — Triage Dashboard & Developer Experience (S4)

- **FR-022**: Dashboard MUST support keyboard navigation: `j`/`k` traverse, `e` resolve, `i` ignore, `x` select, `/` search focus, with optimistic updates.
- **FR-023**: Dashboard MUST export sanitized Markdown (exception, demangled stack, last 5 breadcrumbs, runtime tags) via global hotkey or button.
- **FR-024**: Dashboard MUST provide side-by-side diff for two event occurrences or two release versions of the same issue.
- **FR-025**: Dashboard MUST support structured query tokens: `is:unresolved`, `env:`, `release:`, `user.email:`, `level:`, plus free-text substring search.
- **FR-026**: Event detail MUST filter breadcrumbs by category (All, HTTP, Console, Errors) and support regex search across log text.
- **FR-027**: Dashboard MUST allow manual merge of selected issues into a canonical parent.
- **FR-028**: Dashboard MUST support bulk resolve, ignore, and delete on multi-selected issues.

#### Tier 5 — Lifecycle, Alerting & Integrations (S5)

- **FR-029**: System MUST support "resolved in next release" state and automatically mark Regression when the fingerprint recurs in a later release version.
- **FR-030**: System MUST support snooze by duration, occurrence count, or unique-user threshold.
- **FR-031**: System MUST detect velocity spikes (>300% increase within a rolling 15-minute window) and trigger alerts.
- **FR-032**: System MUST dispatch outbound webhooks on `issue_created` and `regression` with formatters for Slack, Discord, and generic HTTP POST.
- **FR-033**: System MUST accept user crash feedback (`POST /api/{project_id}/user-feedback/`) linked to a specific event ID.

#### Tier 6 — Multi-Tenancy, Projects & Administration (S6)

- **FR-034**: Dashboard MUST provide a global environment filter (`production`, `staging`, `local`) applied across all screens.
- **FR-035**: System MUST support organization → projects hierarchy with independent DSN keys, retention, and notification settings per project.
- **FR-036**: Admins MUST be able to create, view, rotate, and revoke DSN keys per project via the dashboard.
- **FR-037**: System MUST enforce configurable per-project ingest caps (default example: 5,000 events/hour) dropping excess events when breached.
- **FR-038**: System MUST support dashboard sign-in via **Google OAuth** OR **email + password** (argon2id). Team onboarding via email invitations + RBAC lite: Owner (billing, project deletion), Admin (DSN, settings), Member (triage only). Magic-link auth is out of scope.

#### Cross-cutting (S0, constitution)

- **FR-039**: OSS deployment MUST consist of exactly two containers: the Epure application and PostgreSQL 16 — no Redis, Kafka, Nginx, or Node in product compose.
- **FR-040**: Dashboard authentication MUST use secure HttpOnly session cookies after Google callback or password login; no auth tokens in browser localStorage. Google OAuth MUST use standard OIDC authorization-code flow with server-side token exchange.
- **FR-041**: System MUST maintain wire compatibility fixture dumps for browser, Node, Python, Go, Ruby, PHP, Java, and .NET SDKs.
- **FR-042**: Published documentation MUST include an honest versioned SDK compatibility matrix — never claiming 100% Sentry protocol parity.
- **FR-043**: System MUST NOT ingest or expose distributed tracing, session replay, profiling, or generic log analytics features.

### Key Entities

- **Organization**: Top-level tenant; owns projects, members, and billing context (billing UI deferred Phase 2).
- **Project**: Monitored service/application; has DSN keys, retention policy, ingest caps, notification endpoints.
- **DSN Key**: Public project identifier + secret for ingest authentication; rotatable and revocable.
- **Issue**: Grouped exception identified by fingerprint; tracks state (unresolved, resolved, ignored, regression), counts, unique users, snooze, merge parent.
- **Event**: Single occurrence of an exception; stored in monthly partition; links to issue, release, environment, breadcrumbs, user.
- **Release**: Version label with uploaded artifacts (source maps); enables demangling and regression detection.
- **Breadcrumb**: Timestamped context entry (HTTP, navigation, console, UI) attached to an event.
- **Member**: User with org role (Owner, Admin, Member) and session-bound org context.
- **Webhook**: Outbound notification target (Slack, Discord, generic URL) triggered by lifecycle events.
- **Alert**: Velocity spike or regression notification record surfaced in Alerts rail.

---

## Success Criteria

Measurable, technology-agnostic outcomes. Performance numbers marked "measure before publishing" are verified internally before public claims.

### Measurable Outcomes

- **SC-001**: A developer pointing an official Sentry SDK at Epure sees a grouped issue with stack trace in the dashboard within 60 seconds of first crash under normal setup (measure before publishing).
- **SC-002**: Under a sustained duplicate crash loop exceeding the spike threshold, clients continue receiving accepted responses without blocking; the issue occurrence counter increases while excess duplicate payload storage is suppressed.
- **SC-003**: A authenticated user in Organization A cannot view, query, or export any data belonging to Organization B on a shared instance.
- **SC-004**: An on-call engineer completes resolve, ignore, navigate, and search actions on the Issues screen using keyboard shortcuts only, without mouse interaction.
- **SC-005**: After uploading JS/TS source maps, crash stack traces display original source file, function name, and line number readable by a developer without manual map lookup.
- **SC-006**: Marking an issue "resolved in next release" and then observing the same fingerprint in a subsequent release automatically surfaces it as a regression with a team notification.
- **SC-007**: Every capability listed in FEATURES Tiers 1–6 is verified by passing ROADMAP proofs S0 through S6 — the shipped product is not a demo subset.
- **SC-008**: A fresh self-host install completes the path from SDK configuration to first visible grouped issue in under 60 seconds (measure before publishing).
- **SC-009**: Dashboard visual quality passes the design system QA checklist with zero hex literals or off-token colors in product UI.
- **SC-010**: Published compatibility documentation lists tested SDK versions honestly without claiming full protocol parity.

---

## Assumptions

- Target users are developers and small teams (1–30 engineers) self-hosting on commodity VPS or local Docker.
- Official Sentry SDKs (browser, Node, Python, Go, Ruby, PHP, Java, .NET) are the only client instrumentation path in Phase 1 — no proprietary Epure SDK required.
- **Dual tenancy model**: ingest = DSN → project scope; dashboard = session → RLS `app.current_org_id` (constitution Principle II).
- Default spike valve threshold: **100 raw events/minute/fingerprint** (operator-configurable in a later slice).
- Default per-project ingest cap: 5,000 events/hour unless overridden by admin.
- Default retention: **30 days** for new projects; admin may select 14 or 90 days; issue aggregates survive partition drops.
- Dashboard auth: **Google OAuth OR email + password** in Phase 1 OSS; sessions stored server-side with secure HttpOnly cookies; no magic-link flows.
- S1 ships minimal Postgres schema; S3 migrates to RLS + partitions without breaking S1 ingest proofs.
- Source maps stored on local volume attached to the application container in OSS (object storage deferred to Phase 2 Cloud).
- Wire compatibility tested against fixture dumps in `fixtures/sentry/`; matrix published after measurement.
- RAM and binary size marketing claims deferred until measured and recorded in `marketing/landing/PROOF_INVENTORY.md`.
- Waitlist and Cloud billing (Pro $24 / Plus $79) are Phase 2; this spec covers OSS self-host only.
- Apache 2.0 license; full core features in OSS — no crippleware.

---

## ROADMAP Alignment

| Slice | Delivers | Proof gate |
|---|---|---|
| **S0** | Cargo workspace, compose stub, build validates | `cargo build`; `docker compose config` |
| **S1** | FR-001–007, FR-S01 (Tier 1 ingest + minimal schema) | SDK → accepted → persisted; spike valve; no RLS/partitions yet |
| **S2** | FR-008–013 (Tier 2 processing) | Demangled stacks; grouping; PII scrub |
| **S3** | FR-014–018, FR-S02 (Tier 3 storage + RLS/partitions) | RLS isolation; TTL; unique users |
| **S3b** | FR-019–021 (UI foundation) | `QA.md`; AppShell; token alias |
| **S4** | FR-022–028 (Tier 4 triage) | Keyboard triage; export; diffs |
| **S5** | FR-029–033 (Tier 5 lifecycle) | Regression; snooze; webhooks |
| **S6** | FR-034–038 (Tier 6 admin) | Projects; DSN rotation; RBAC |

Phase 1 exit (post-S6): README with install + compatibility matrix, measured RAM/binary size, public GitHub — per `ROADMAP.md`.

---

## Dependencies

- Constitution v1.0.0 (`.specify/memory/constitution.md`)
- Design system contract (`web/design/README.md`, `components.md`, `qa.md`)
- Business matrix (`business/FEATURES.md` — all Tiers 1–6 in scope)
- Architecture defaults (`business/ARCHITECTURE.md`)

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope creep into observability | Constitution Principle I; explicit anti-features in FR-043 |
| Stack drift (Redis, SQLite-primary) | Constitution Principle II/V; FR-039 |
| UI debt before triage | Mandatory S3b gate; FR-021 before FR-022 |
| Overclaiming Sentry compatibility | FR-042; honest version matrix |
| Infinite loop disk exhaustion | Spike valve FR-005; ingest caps FR-037 |
