# Feature Specification: Dashboard UX (Plausible-shaped)

**Feature ID**: `002-dashboard-ux`

**Created**: 2026-09-12

**Status**: Draft

**Domain**: epure.sh

**Constitution**: Principles I–VI (`.specify/memory/constitution.md`)

**Blocks**: Phase 1 public publish ([PUBLISH.md](../../PUBLISH.md))

**Input**: Reshape the Epure dashboard so it feels like Plausible Analytics applied to error tracking — guided setup, one obvious home, plain language, power tools behind progressive disclosure. Primary users are solo devs, indie hackers, and small SaaS teams who may never have used Sentry. Sentry migrants should relearn in minutes because the product is simpler, not because we cloned Sentry’s UI.

**Research**: [charter.md](./charter.md) · [journeys.md](./journeys.md) · [research/](./research/) · [metrics-layout-verdict.md](./research/metrics-layout-verdict.md) · [ui-polish-verdict.md](./research/ui-polish-verdict.md) · [issue-surface-spec.md](./research/issue-surface-spec.md) · [issue-detail-ux-research.md](./research/issue-detail-ux-research.md) · [tab-debate.md](./research/tab-debate.md)

**Depends on**: `001-phase-1-oss` (all FEATURES Tiers 1–6 shipped; backend and ingest unchanged except read APIs needed for summary stats)

---

## Overview

Phase 1 built every FEATURES capability, but the dashboard presents them Sentry-first: query syntax as the hero surface, advanced panels visible by default, and DSN setup buried in Settings and the README. Users report the product is hard to understand on first contact.

This specification covers a **dashboard UX pass only** — information architecture, onboarding ritual, progressive disclosure, and visual hierarchy — so Epure feels *native and obvious* before public launch. The north star is **Plausible for error tracking**: connect a DSN, see the first exception, understand what broke, fix it.

Visual identity stays on the Signal Room design system ([VERDICT.md](../../../../design/VERDICT.md), [tokens.css](../../../../design/tokens.css)). No stock third-party themes, no hex in product UI, no observability-suite expansion.

---

## Clarifications

### Session 2026-09-12

Resolved in [charter.md](./charter.md) and user confirmation — no open questions.

| Topic | Decision |
|-------|----------|
| **Setup surface** | Hybrid: dedicated setup flow for project name + DSN copy; compact checklist on Issues home until first event is received; then dismiss |
| **Project switcher** | Hidden until the organization has two or more projects; show static project name when only one |
| **Issues home stats** | Three headline metrics with plain labels: **Unresolved**, **Events (7d)**, **Regressions** |
| **Primary persona** | Solo dev / indie hacker / small SaaS team — often no Sentry background |
| **Sentry migrants** | Secondary; familiarity via issue list and stack structure, not query-bar parity |
| **Publish gate** | All journey proofs J1–J5 must pass before [PUBLISH.md](../../PUBLISH.md) |

### Session 2026-09-13

Resolved in [metrics-layout-verdict.md](./research/metrics-layout-verdict.md) swarm synthesis.

| Topic | Decision |
|-------|----------|
| **Home charts** | Zero chart library in Phase 1; list is home — no errors graph on Issues home |
| **Events (7d) stat** | **Not clickable** — time window scopes the list; only Unresolved and Regressions stats filter |
| **Users metric** | Scalar per issue on row and Overview (`unique_user_count`); no users graph |
| **Category / area grouping** | Phase 1b filter chips only, after 80% seed-fixture accuracy gate; no sidebar sections or graph dimensions |
| **"What changed lately"** | Text-only regression/spike strip on Overview; no vanity event graph |
| **Logs product** | Refused — breadcrumbs + redirect copy to external log tools |
| **Page layout (Z2)** | One header band: stats left, filter chips + Filter + time window right — not trapped in list column |
| **Time window** | Selector in filter row: Last 24h / 7d / 14d / 30d / 90d; default 7d; `?window=` URL param; scopes issue list + Events stat label |
| **Sort** | Selector in filter row: last seen, events count, first seen, title A–Z; default last seen (newest); `?sort=` URL param; server-side `ORDER BY` |
| **Releases rail** | List home with text deltas (`+N came back · +N new`), SDK empty state, click-through to Issues `?q=release:{version}` — no release detail page |
| **Alerts rail** | Two-line rows (velocity/regression), plain-language deltas, empty state with webhook CTA, row click → Issues `?issue=`; cross-link hint to Issues regressions; no charts |
| **Detail pane** | Hidden until row selected; single-column empty/first-run |
| **Filter presets** | Chips: Unresolved (default), Came back, Snoozed — not status sub-tabs |

### Session 2026-09-13 (issue detail)

Resolved in [issue-detail-ux-research.md](./research/issue-detail-ux-research.md).

| Topic | Decision |
|-------|----------|
| **Overview hierarchy** | Impact strip (occurrences, users affected, relative first/last seen) → context dl → when-it-happened → last 5 occurrences |
| **Detail timeline** | Text strip + smooth SVG line chart on Overview (hover time + count) — **not** on Issues home; no chart library |
| **Actions placement** | Resolve / Ignore / Snooze / **Copy for AI** header-right on ≥768px (L3 / slice I2) |
| **Copy for AI** | Clipboard + prompt template wrapping existing markdown export — no external LLM API in P1 |
| **Last occurrences** | Last 5 on Overview; click switches occurrence; "View all" in More |
| **I1–I8 implementation** | **Shipped** (D15) — see [issue-detail-ux-research.md](./research/issue-detail-ux-research.md) |
| **Detail tab IA (2026-09-13)** | **Overview · Stack · Breadcrumbs · More** — stack `CodeBlock` on dedicated Stack tab; toolbar holds Resolve/Ignore/Snooze/Copy for AI; More has compare/merge only |
| **Backlog (post-D15)** | **Shipped** — L4 list width 30rem, D12 breadcrumbs drawer + logs redirect, Slice C/D, timeline window selector, snooze list chip, select-all, unified detail toolbar + line chart |
| **D11 area heuristics** | **Skipped** — 80% seed-fixture gate not met |
| **Error classification** | SDK **level** yes (filter chips + row meta); **type** via title/fingerprint only; **area** Phase 1b gated; no separate critical/priority field — see [error-classification-policy.md](./research/error-classification-policy.md) |

### Session 2026-09-13 (UI polish swarm)

Ratified in [ui-polish-verdict.md](./research/ui-polish-verdict.md). **D16 shipped** — C-P0/V1/L-P2/L-P1/C-P1 + partial L-P3 (PageChrome on Releases/Alerts, compressed Issues chrome, mobile rail, toast provider, Checkbox, IBM Plex tokens).

### Session 2026-09-13 (visual hierarchy swarm)

Ratified in [hierarchy-verdict.md](./research/hierarchy-verdict.md). **Role collapse** on color, type, space, affordance. **D17 P0:** Resolve→`primary`, Snooze→`ghost`, distinct row/bulk/stat states, `Section` primitive, type roles `display`→`meta`.

---

## Scope

### In scope

- Guided first-run setup (project + DSN + first-event verification)
- Issues home redesign: stat summary, default unresolved list, Filter behind a button
- Issue detail redesign: tabbed layout (Overview · Stack · Breadcrumbs · More)
- Progressive disclosure for power features (query syntax, merge/split, diff, keyboard hints)
- Top bar behavior: project label vs switcher; environment filter unchanged
- Settings clarity: setup path vs admin path; improved DSN copy affordance
- Design system contract update ([DASHBOARD.md](../../../../design/DASHBOARD.md) thesis → Plausible clarity)
- Journey proofs J1–J5 documented and executable
- Read-only dashboard APIs or aggregations required for headline stats (if not already available)

### Out of scope

- New ingest, processing, storage, or lifecycle engine behavior (001 owns that)
- Distributed tracing, replay, profiling, generic logs, chart dashboards as home
- Landing page / marketing site rewrite (dedicated landing repo)
- Mobile native apps
- Forking GlitchTip, Bugsink, or Sentry UI codebases
- Stock shadcn or default Tailwind palette as brand
- i18n / localization beyond English v1
- Dark-mode redesign beyond existing token switching

### Non-regression

All `001-phase-1-oss` FEATURES Tier 4–6 capabilities MUST remain reachable after this pass (journey **J4**). Removing capability is not UX simplification — hiding it behind Filter, More, select mode, or command palette is.

---

## User Scenarios & Testing

Stories map to journey proofs J1–J5 and ROADMAP slice **S3d**. Priorities reflect publish order: comprehension before power-user polish.

### User Story 1 — Guided Setup to First Issue (Priority: P1) · J1

As a solo developer who has never used error monitoring, I complete in-app setup, copy my connection string, send a test error, and see my first grouped issue **without reading the README**.

**Why this priority**: First real exception is the Plausible “first pageview” moment. Without it, nothing else matters.

**Independent Test**: Fresh account → setup flow → copy connection string → trigger fixture error → issue row visible; setup marked complete.

**Acceptance Scenarios**:

1. **Given** a newly registered user with no issues, **When** they sign in, **Then** they are directed into the setup flow before or alongside an empty Issues home with clear next steps.
2. **Given** the setup flow, **When** the user names a project and reaches the connection step, **Then** they can copy the full DSN (or equivalent connection string) in one action with plain-language instructions.
3. **Given** completed DSN copy, **When** the user returns to Issues, **Then** a compact checklist shows remaining steps (send test error, confirm first issue) until an issue row appears.
4. **Given** a successfully ingested first event, **When** the user views Issues, **Then** the setup checklist is dismissed or marked complete and the issue appears in the list.
5. **Given** setup in progress, **When** the user needs the connection string again, **Then** they can retrieve it from Settings without hunting through unrelated admin screens.

**Fail if**: user must open README or discover an unnamed Settings tab to obtain a DSN.

---

### User Story 2 — Understand Issues Home at a Glance (Priority: P1) · J2

As a small-team engineer, I open Issues and immediately understand how many problems are open and what crashed recently — without learning query syntax.

**Why this priority**: The home screen is the product’s sentence. Plausible wins on clarity here.

**Independent Test**: Show Issues home to a participant who did not build the product; they identify “open crashes” and “how many” within 5 seconds.

**Acceptance Scenarios**:

1. **Given** at least one issue exists, **When** the user opens Issues, **Then** a headline stat area shows **Unresolved**, **Events (7d)**, and **Regressions** in plain language (no `is:` tokens on the default surface).
2. **Given** the default Issues view, **When** the page loads, **Then** the issue list shows unresolved items without requiring the user to type a query.
3. **Given** the default Issues view, **When** the user looks for filtering, **Then** a single **Filter** control is visible; advanced query syntax is not the primary input on the page.
4. **Given** only one project in the organization, **When** the user views the top bar, **Then** the project name is shown as a label without a switcher control.
5. **Given** two or more projects, **When** the user views the top bar, **Then** a project switcher appears.

**Fail if**: a new user asks what `is:unresolved` means or cannot identify the primary list within 5 seconds.

---

### User Story 3 — Triage One Issue Without Overwhelm (Priority: P1) · J3

As a developer investigating a crash, I select an issue and see what broke, when, and where — with Resolve and Ignore obvious — before any advanced tooling.

**Why this priority**: Triage is the core job; advanced diff/merge must not block the default path.

**Independent Test**: Select an issue; Overview shows title, status, last seen, environment; Resolve and Ignore visible without scrolling; Stack available in one click.

**Acceptance Scenarios**:

1. **Given** a selected issue, **When** the detail panel opens, **Then** the default tab is **Overview** with human-readable title, status, event count, last seen, environment, and release when present.
2. **Given** Overview, **When** the user wants to close the issue, **Then** **Resolve** and **Ignore** actions are visible without scrolling past stack traces, diff panels, or keyboard cheat sheets.
3. **Given** a selected issue, **When** the user opens the **Stack** tab, **Then** demangled frames (when maps exist) are shown in a readable stack presentation.
4. **Given** a selected issue, **When** the user opens **Breadcrumbs**, **Then** contextual trail entries are listed in time order.
5. **Given** a selected issue, **When** the user opens **More**, **Then** advanced actions (export, snooze, merge context, occurrence/release compare) are available without cluttering Overview.

**Fail if**: diff UI, merge bar, or permanent keyboard legend appear on Overview or above the fold by default.

---

### User Story 4 — Find Power Tools When Needed (Priority: P2) · J4 (partial)

As a daily triager or Sentry migrant, I can still filter precisely, navigate by keyboard, merge issues, and export — but only when I choose to go deeper.

**Why this priority**: 001 promised keyboard-first triage; hiding power must not remove it.

**Independent Test**: Open Filter → apply query/chips; use `j`/`k`; merge two issues; export markdown — all succeed.

**Acceptance Scenarios**:

1. **Given** Issues home, **When** the user opens **Filter**, **Then** preset chips and optional query syntax are available and apply to the list.
2. **Given** Issues list focus, **When** the user presses `j` or `k`, **Then** selection moves between rows.
3. **Given** multi-select mode, **When** the user merges issues, **Then** merge behaves as in 001 (canonical parent, children hidden).
4. **Given** a selected issue, **When** the user invokes export (keyboard shortcut or More tab), **Then** sanitized markdown suitable for LLM paste is produced.
5. **Given** 001 quickstart S4 proofs, **When** re-run after UX pass, **Then** all Tier 4 keyboard and bulk proofs still pass.

---

### User Story 5 — Calm Admin and Secondary Screens (Priority: P2)

As a team admin, I manage DSN keys, webhooks, and team members in Settings with the same visual calm as Issues — setup is not the only path to DSN.

**Why this priority**: Settings supports the ritual but must also serve ongoing admin without jargon walls.

**Independent Test**: Settings → DSN keys → copy key; webhooks list/create/delete for Admin+; layout matches secondary-sidebar pattern.

**Acceptance Scenarios**:

1. **Given** Settings, **When** the user navigates sections, **Then** Projects, DSN keys, Webhooks, and Team are reachable via a consistent secondary sidebar.
2. **Given** DSN keys, **When** the user creates or copies a key, **Then** the connection string uses the same copy affordance pattern as setup (one-click copy, plain labels).
3. **Given** Releases and Alerts pages, **When** the user visits with no data, **Then** empty states use title + one-line hint + optional action (no mascot).
4. **Given** the same shell from login through all routes, **When** the user navigates, **Then** no separate “focus” or stripped layout is used for onboarding vs app.

---

### User Story 6 — Design Quality Gate (Priority: P1) · J5

As the product owner, I ship only when reskinned screens pass the design QA checklist and journey proofs.

**Why this priority**: Publish is blocked until UX pass is proven, not merely implemented.

**Independent Test**: [design/QA.md](../../../../design/QA.md) checklist; `/__design` lab matches feature usage; J1–J4 recorded.

**Acceptance Scenarios**:

1. **Given** reskinned Issues, Setup, and Settings, **When** reviewed against QA.md, **Then** all items pass (no off-token colors, mono for stacks/DSN, accent discipline).
2. **Given** the design lab route in development builds, **When** primitives are updated, **Then** they reflect tokens used on production screens.

---

### Edge Cases

- **User skips setup mid-flow**: Issues home shows checklist with resume link; no dead-end blank screen.
- **DSN copied but wrong environment**: Checklist or banner explains “no events yet” with symptom-based hints (wrong env filter, firewall, invalid key) — not silent empty list.
- **Zero issues after 24h with active DSN**: Non-alarming empty state (“No unresolved exceptions”) distinct from “setup incomplete.”
- **Revoked DSN during setup**: Copy step still works; verification step surfaces ingest rejection in plain language.
- **Member role (not Admin)**: Setup can use existing project DSN; cannot create webhooks — clear permission message, not broken UI.
- **Returning user after setup complete**: Never see setup flow again unless they create a new org/project without keys.
- **Second project added**: Project switcher appears; per-project stats and lists respect selection.
- **Regression count zero**: Stat shows `0` without looking like an error state.

---

## Requirements

### Functional Requirements

#### Onboarding & setup

- **FR-UX-001**: Dashboard MUST present a guided setup flow for new users covering project naming and DSN copy before expecting self-serve discovery.
- **FR-UX-002**: Dashboard MUST provide one-click copy of the ingest connection string (DSN) during setup and from DSN key management.
- **FR-UX-003**: Dashboard MUST show a compact setup checklist on Issues home until the first grouped issue is visible, then dismiss or complete it.
- **FR-UX-004**: Dashboard MUST NOT require README or external docs to complete the path from login to first visible issue (J1).

#### Issues home

- **FR-UX-005**: Issues home MUST display headline stats: **Unresolved**, **Events (7d)**, **Regressions** with plain-language labels. **Unresolved** and **Regressions** MUST be clickable to apply the corresponding filter; **Events (7d)** MUST NOT be clickable (time window scopes the list).
- **FR-UX-005a**: Issues home MUST NOT include chart libraries or hero graphs; regression/spike context MAY appear as text strips only.
- **FR-UX-005b**: Issue rows SHOULD show per-issue user count when available (`unique_user_count`); no aggregate users graph.
- **FR-UX-005c**: Issues home page header MUST unify stats (left) and filter controls (right) in one band — filters MUST NOT live only inside the list column sidebar.
- **FR-UX-005d**: Issues home MUST expose a time window selector (plain-language presets, default 7 days) that scopes the issue list and Events stat count; Events stat label MUST reflect the window (e.g. Events (30d)) and MUST NOT be clickable.
- **FR-UX-005e**: Issues home MUST expose a sort selector (plain-language labels, default last seen newest first) wired to server-side issue list ordering via `?sort=` URL param.
- **FR-UX-006**: Issues home MUST default to showing unresolved issues without requiring query syntax on the primary surface.
- **FR-UX-007**: Advanced filtering (preset chips and query syntax) MUST be behind a **Filter** control, not a always-visible query bar.
- **FR-UX-008**: Top bar MUST show project name as a static label when only one project exists; MUST show a switcher when two or more projects exist.

#### Issue detail

- **FR-UX-009**: Issue detail MUST use a tabbed layout: **Overview**, **Stack**, **Breadcrumbs**, **More** (four tabs; keyboard `1`–`4`).
- **FR-UX-010**: **Overview** MUST show title, status, event count, last seen, environment, release (when present), and primary **Resolve** / **Ignore** actions without scrolling past advanced panels.
- **FR-UX-011**: **Stack** MUST be a dedicated tab showing the full demangled stack as `CodeBlock`(s) with vendor frame collapse and occurrence picker.
- **FR-UX-012**: **Breadcrumbs** MUST present contextual trail entries as a vertical timeline (time-ordered flow), not a flat list with log-product copy.
- **FR-UX-013**: **More** MUST host advanced actions: export, merge/split, occurrence/release compare, tags, fingerprint — **without** duplicating Snooze or Copy for AI (toolbar only).
- **FR-UX-013a**: **Overview** SHOULD show an impact strip (occurrence count, users affected when >0, relative first/last seen) and last occurrences list per [issue-detail-ux-research.md](./research/issue-detail-ux-research.md) slices I1–I3.
- **FR-UX-013b**: **Overview** MAY show a detail-only occurrence timeline as text strip and/or smooth SVG line chart with hover tooltips (no chart library); MUST NOT add charts to Issues home.
- **FR-UX-013c**: **Copy for AI** MUST be discoverable on Overview (and command palette); MUST copy issue context + resolution prompt to clipboard without calling an external LLM API.

#### Progressive disclosure & power features

- **FR-UX-014**: Keyboard navigation (`j`/`k`, resolve, ignore, bulk select, focus search) MUST remain functional (001 non-regression).
- **FR-UX-015**: Keyboard shortcut hints MUST NOT be permanently visible in the issue detail header; MUST be discoverable via command palette or help (`?`).
- **FR-UX-016**: Command palette (`⌘K` / `Ctrl+K`) MUST remain available but MUST NOT be promoted on first-run Issues home.
- **FR-UX-017**: Merge, split, bulk resolve/ignore/delete MUST remain available to users who enter multi-select or advanced flows (001 non-regression).

#### Shell, settings, secondary pages

- **FR-UX-018**: Application MUST use one consistent shell (rail, top bar, main) from login through all authenticated routes — no separate onboarding layout fork.
- **FR-UX-019**: Settings MUST retain secondary sidebar navigation: Projects, DSN keys, Webhooks, Team.
- **FR-UX-020**: Releases and Alerts MUST use title + hint empty states consistent with charter (no mascot, no celebratory copy).
- **FR-UX-020a**: Releases rail MUST show scannable release rows with plain-language delta counts when available; drill-down MUST navigate to Issues filtered by release (no separate release detail page).
- **FR-UX-020b**: Alerts rail MUST show scannable alert rows with plain-language velocity/regression copy; row click MUST deep-link to the issue in Issues (`?issue=`); MUST NOT use chart libraries on the Alerts surface.

#### Design system & quality

- **FR-UX-021**: All reskinned UI MUST use design tokens only ([tokens.css](../../../../design/tokens.css)); no hex literals or default Tailwind palette as brand in product JSX.
- **FR-UX-022**: Reskinned screens MUST pass [design/QA.md](../../../../design/QA.md) before publish (J5).
- **FR-UX-023**: [design/DASHBOARD.md](../../../../design/DASHBOARD.md) MUST be updated to reflect Plausible-shaped thesis when this feature is complete.

#### Data display (read path)

- **FR-UX-024**: Dashboard MUST be able to display **Events (7d)** and **Regressions** counts per active project and environment filter without client-side guesswork from partial lists.
- **FR-UX-025**: Setup completion state MUST persist per user/org/project so returning users are not re-prompted after J1 success.

### Key Entities (UX-facing)

- **Setup progress**: Tracks steps completed (project created, DSN copied, first issue seen); drives checklist and redirects.
- **Headline stats**: Aggregated counts for Issues home (unresolved, 7-day events, regressions) scoped to active project and environment.
- **Filter state**: Active chips and optional query string; applied to issue list; not shown as hero input by default.
- **Issue detail tab state**: Which tab is active (Overview, Stack, Breadcrumbs, More) for the selected issue.

---

## Success Criteria

### Measurable Outcomes

- **SC-UX-001**: A new user completes login → setup → DSN copy → first visible issue **without opening README** (J1 pass).
- **SC-UX-002**: In a 5-second test, a non-builder participant correctly identifies open crashes and count on Issues home (J2 pass).
- **SC-UX-003**: On issue select, **Resolve** and **Ignore** are visible without scrolling before any advanced panel (J3 pass).
- **SC-UX-004**: All 001 Tier 4 keyboard and bulk proofs pass after UX ship (J4 pass).
- **SC-UX-005**: Design QA checklist passes on Issues, Setup, Settings, Releases, Alerts (J5 pass).
- **SC-UX-006**: A Sentry-experienced user can resolve an issue and find the stack trace within **5 minutes** of first login without a UI migration guide (qualitative timed test).
- **SC-UX-007**: Public publish ([PUBLISH.md](../../PUBLISH.md)) proceeds only after SC-UX-001 through SC-UX-005 are recorded with date and method.

---

## Assumptions

- `001-phase-1-oss` ingest, API, auth, and FEATURES behavior are complete and frozen except read aggregations needed for FR-UX-024/025.
- Target users are developers self-hosting via Docker or running locally; English UI only for this slice.
- Primary persona (P1) has not used Sentry; secondary (P2) may have; both are served by plain defaults + progressive depth.
- Signal Room visual identity ([VERDICT.md](../../../../design/VERDICT.md)) is fixed; UX pass changes hierarchy and IA, not brand colors.
- Keyboard and command-palette power features remain product commitments from 001; hiding is not removing.
- Agency or Stitch mockups, if used, are reference only — shipped UI conforms to tokens and this spec.
- Mobile web is responsive enough for desktop-first triage; native mobile apps remain out of scope.

---

## ROADMAP Alignment

| Slice | Delivers | Proof gate |
|-------|----------|------------|
| **S3d** | FR-UX-001–025 | J1–J5 journeys; blocks PUBLISH.md |

**Phase 1 exit** (updated): S0–S6 + **S3d** + public GitHub.

---

## Dependencies

- `001-phase-1-oss` complete (spec, implementation, tests)
- [charter.md](./charter.md) · [research/](./research/)
- Design system: [SYSTEM.md](../../../../design/SYSTEM.md) · [COMPONENTS.md](../../../../design/COMPONENTS.md) · [QA.md](../../../../design/QA.md)
- Constitution v1.1.0 (Google/password auth; Postgres + RLS)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| UX pass breaks 001 proofs | J4 non-regression gate; run quickstart S4 after each slice |
| Stat APIs missing | FR-UX-024 explicit; plan slice for minimal read endpoints |
| Over-simplification removes merge/diff | FR-UX-013, FR-UX-017; host in More / Filter |
| Design drift from tokens | FR-UX-021, J5 QA; Design Lab route |
| Scope creep into charts/replay | Out of scope section; constitution Principle I |
| Publish slip | SC-UX-007 ties publish to recorded proofs |
