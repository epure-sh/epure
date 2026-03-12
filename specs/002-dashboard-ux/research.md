# Research: Dashboard UX (Plausible-shaped)

**Feature**: `002-dashboard-ux` | **Date**: 2026-09-12

Consolidated from `research/*.md`, [charter.md](./charter.md), and codebase audit. All Technical Context unknowns resolved — no NEEDS CLARIFICATION items remain.

---

## R1 — Setup surface pattern

**Decision**: Hybrid setup — dedicated `/setup` route for project naming + DSN copy; compact checklist on Issues home until first grouped issue appears; then dismiss permanently.

**Rationale**: Plausible's provisioning ritual (copy artifact → verify first event) maps directly to Epure's "first pageview moment" for exceptions. A dedicated flow handles steps 1–2 without README archaeology; the Issues checklist handles async verification (step 3–4) while keeping one shell (charter: refuse separate focus layout).

**Alternatives considered**:

- README-only setup — rejected (fails J1, user reports)
- Settings-only DSN — rejected (buried admin path)
- Full-screen wizard until complete — rejected (blocks returning users from triage)
- Plausible-style separate focus layout — rejected (Plausible removed it; charter mandates one shell)

---

## R2 — Issues home information hierarchy

**Decision**: StatBar (Unresolved · Events 7d · Regressions) above default unresolved issue list; Filter button opens Popover with plain-language preset chips + optional query syntax field.

**Rationale**: Plausible wins on "five-second scan" — summary numbers + scannable list, no training. Current `FilterRow` with `is:unresolved` placeholder fails J2. Preset chips use plain labels ("Unresolved", "Error") mapping to existing query tokens internally.

**Alternatives considered**:

- Keep query bar as hero with better placeholder — rejected (still teaches syntax)
- Chart dashboard home — rejected (constitution I, charter refuse GA4-style)
- Stat bar only, no list changes — rejected (default must not require query)

---

## R3 — Issue detail progressive disclosure

**Decision**: Radix Tabs — Overview · Stack · Breadcrumbs · More. Resolve/Ignore on Overview without scroll. Diff, snooze, export, merge context in More. Keyboard hints via `?` or command palette only.

**Rationale**: J3 requires one-screen triage. Current `EventDetailPanel` single-scroll exposes diff picker, keyboard cheat sheet, and breadcrumbs before user asks — Sentry-default anti-pattern per charter.

**Alternatives considered**:

- Accordion sections — rejected (advanced panels still above fold)
- Keep scroll, hide diff behind collapse — rejected (tabs clearer mental model, matches Sentry borrow for stack/breadcrumbs)
- Separate routes per tab — rejected (master-detail pattern preserved)

---

## R4 — Project switcher visibility

**Decision**: Static project name label when org has one project; Radix Select switcher when two or more.

**Rationale**: Charter clarification 2026-09-12. TopStrip already gates project select — verify behavior, no new component needed.

**Alternatives considered**:

- Always show switcher — rejected (noise for solo dev P1)
- Hide in setup only — rejected (inconsistent)

---

## R5 — Headline stats data source

**Decision**: Server-side aggregate endpoint `GET /api/v1/stats` scoped by `project_id` + `environment` query params. Counts:

- `unresolved`: issues with `status = 'unresolved'` (not including regression)
- `events_7d`: rows in `events` partitions where `occurred_at >= now() - interval` — **now accepts `window=24h|7d|14d|30d|90d`** (JSON key unchanged; UI label reflects window). Deferred rename: `events_in_window`.
- `regressions`: issues with `status = 'regression'`

**Rationale**: FR-UX-024 forbids client-side guesswork from partial issue lists. Events span partitions; server has partition-aware queries. Issue counts are cheap indexed aggregates.

**Alternatives considered**:

- Derive from issue list + `event_count` sum — rejected (inaccurate for 7d window, pagination bias)
- WebSocket live counters — rejected (scope creep, no ingest change)
- Include resolved in "unresolved" stat — rejected (spec labels them separately; regression is its own stat)

---

## R6 — Setup progress persistence

**Decision**: New `user_setup_progress` table keyed `(user_id, org_id, project_id)` with boolean/timestamp columns: `project_named`, `dsn_copied_at`, `first_issue_seen_at`, `completed_at`. API: `GET/PATCH /api/v1/setup`.

**Rationale**: FR-UX-025 requires per user/org/project persistence so returning users are not re-prompted. Server-side storage survives browser clear; RLS scopes by org. `first_issue_seen_at` can also be set server-side when issue count transitions 0→1 (optional hook in list endpoint).

**Alternatives considered**:

- localStorage only — rejected (not durable, not cross-device)
- Org-wide flag — rejected (multi-user orgs need per-user checklist state)
- Infer complete from issue count alone — rejected (user may have issues from seed but never completed ritual)

---

## R7 — UI library additions

**Decision**: Add à la carte Radix primitives — P0: `@radix-ui/react-tabs`, `@radix-ui/react-popover`; P1: collapsible, checkbox, switch, alert-dialog. No shadcn CLI, no chart libs, no TanStack Query yet.

**Rationale**: library-fit.md audit. Existing kit covers dialog, dropdown, select, tooltip. Tabs + Popover unblock FilterPanel and IssueDetailTabs. Bundle discipline for rust-embed single binary (~few KB per primitive vs chart library).

**Alternatives considered**:

- shadcn copy-paste — rejected (zinc palette, constitution VI)
- Headless UI / MUI — rejected (second component model)
- Custom tabs without Radix — rejected (focus management + a11y cost)
- Sheet instead of Popover for Filter — acceptable P1 swap; Popover chosen for anchored filter button

---

## R8 — Component build order

**Decision**: Tabs + Popover + CopyButton → SetupChecklist + CopyDsnBlock → StatBar → FilterPanel → IssueDetailTabs (+ panel extractions) → SettingsNav/Field pass → Design Lab → journey proofs.

**Rationale**: component-inventory.md maps P0 components to J1–J3 blockers. Kit-before-screens rule (constitution VI) — each primitive lands in `ui/` + Design Lab before feature reskin.

**Alternatives considered**:

- Feature-first refactor without new primitives — rejected (duplicates anti-patterns, fails J5 convergence)

---

## R9 — Power feature preservation

**Decision**: Relocate, never delete — query syntax inside FilterPanel; merge/bulk in list column; diff/export/snooze in More tab; command palette unchanged; keyboard `j/k/e/i/x` unchanged.

**Rationale**: J4 non-regression gate. 001 Tier 4 proofs must pass after UX ship. Charter P3 persona (daily triager) served via progressive disclosure.

**Alternatives considered**:

- Remove query syntax — rejected (001 commitment)
- Permanent keyboard legend — rejected (charter refuse)

---

## R10 — Design system updates

**Decision**: Update `design/DASHBOARD.md` thesis from Linear/Sentry-era to Plausible-shaped clarity on slice completion. All new components documented in `web/design/components.md` with token recipes.

**Rationale**: FR-UX-023 explicit. VERDICT.md and tokens.css unchanged — hierarchy and IA shift, not brand.

**Alternatives considered**:

- Fork tokens for "friendlier" dashboard — rejected (constitution VI)
