# Implementation Plan: Dashboard UX (Plausible-shaped)

**Branch**: `002-dashboard-ux` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-dashboard-ux/spec.md`

---

## Summary

Reshape the Epure dashboard so solo devs and small SaaS teams can connect a DSN, see the first exception, and triage without learning query syntax — **Plausible for error tracking**, not a Sentry UI clone.

Technical approach:

1. **Frontend-first**: Add Radix Tabs + Popover primitives; ship six P0 `ui/` components (SetupChecklist, CopyDsnBlock, StatBar, FilterPanel, IssueDetailTabs, IssueOverviewPanel); refactor `features/issues/` and `features/settings/` for progressive disclosure.
2. **Minimal backend**: Two read-only dashboard endpoints — headline stats (FR-UX-024) and setup progress (FR-UX-025) — scoped by RLS org context, project, and environment filter.
3. **One shell**: `/setup` route inside existing AppShell; no separate onboarding layout fork.
4. **Non-regression**: All 001 Tier 4–6 capabilities remain reachable via Filter, More tab, multi-select, and command palette (J4).
5. **Publish gate**: J1–J5 journey proofs recorded before [PUBLISH.md](../../PUBLISH.md).

---

## Technical Context

**Language/Version**: Rust (stable, edition 2021) + TypeScript / React 19

**Primary Dependencies**: Axum, SQLx, PostgreSQL 16 (unchanged); React 19, Vite 7, Radix (add `@radix-ui/react-tabs`, `@radix-ui/react-popover`), cmdk, lucide-react, react-router-dom 7

**Storage**: PostgreSQL 16 — one new table `user_setup_progress`; stats via aggregate queries on existing `issues` and `events` partitions (no new event storage)

**Testing**: `cargo test` for new API routes; browser journey proofs J1–J5; re-run `001-phase-1-oss` quickstart S4 rows after UX ship (J4)

**Target Platform**: Linux/macOS dev; Linux VPS/Docker production (2-container compose unchanged)

**Project Type**: Monolithic web service — dashboard UX pass on embedded SPA + minimal read API additions

**Performance Goals**:

- Headline stats endpoint: <100 ms p95 for typical org (single project, <10k issues)
- Issues home perceived load: stat bar + list render without blocking on client-side full-list aggregation
- No change to ingest hot path (202 <10 ms)

**Constraints**:

- Dashboard UX only — no ingest, processing, storage engine, or lifecycle behavior changes
- OSS compose = exactly 2 containers (Epure + postgres)
- UI: `@design` tokens only; no hex in JSX; no shadcn default theme
- One shell from login through all routes (FR-UX-018)
- English UI only; responsive desktop-first

**Scale/Scope**: ~12 new `ui/` components (6 P0, 4 P1, 2 P2); 2 new API routes; 1 migration; reskin Issues home, issue detail, setup, Settings; update `design/DASHBOARD.md`

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Plan compliance | Notes |
|---|---|---|
| **I. Exception-only** | PASS | No tracing/replay/profiling/log UI; stat bar is issue counts only, not chart dashboard |
| **II. Rust + Postgres 16** | PASS | Read APIs via SQLx + RLS; setup progress in Postgres; no new containers or stores |
| **III. Honest Sentry wire** | PASS | Ingest unchanged; DSN copy uses existing key format |
| **IV. Ingress stays cheap** | PASS | Stats/setup are dashboard read path only; no ingest hot-path work |
| **V. Spec-driven S0→S6** | PASS | S3d slice after S0–S6; blocks publish, does not skip FEATURES rows |
| **VI. Design system** | PASS | New controls in `ui/` + Design Lab + COMPONENTS.md before feature reskin; QA.md gate (J5) |

**Forbidden items scan**: No Redis, SQLite-primary, SSR triage, iOS/Android, hex in JSX, chart libraries, shadcn theme, separate onboarding layout fork.

**Post-design re-check (Phase 1)**: PASS — `data-model.md`, `contracts/dashboard.openapi.yaml`, and `quickstart.md` align with constitution; no gate violations. Setup progress table is scoped per user/org/project under RLS; stats queries read existing tenant data only.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-dashboard-ux/
├── plan.md              # This file
├── research.md          # Phase 0 — UX + library decisions
├── data-model.md        # Phase 1 — setup progress + stats shapes
├── quickstart.md        # Phase 1 — J1–J5 validation guide
├── contracts/
│   └── dashboard.openapi.yaml
├── charter.md           # Approved direction (input)
├── journeys.md          # J1–J5 proof scenarios (input)
├── research/            # Dossiers (input, synthesized in research.md)
├── spec.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (`apps/epure/`)

```text
apps/epure/
├── crates/
│   ├── storage/
│   │   ├── migrations/
│   │   │   └── 20260912000001_setup_progress.sql   # user_setup_progress table
│   │   └── src/
│   │       ├── setup.rs          # setup progress CRUD
│   │       └── stats.rs          # headline aggregate queries
│   └── server/
│       └── src/routes/api/
│           ├── setup.rs          # GET/PATCH /api/v1/setup
│           └── stats.rs          # GET /api/v1/stats
├── web/
│   ├── src/
│   │   ├── ui/
│   │   │   ├── tabs.tsx          # P0 — Radix Tabs
│   │   │   ├── popover.tsx       # P0 — Radix Popover
│   │   │   ├── copy-button.tsx   # P0
│   │   │   ├── stat-bar.tsx      # P0
│   │   │   ├── setup-checklist.tsx
│   │   │   ├── copy-dsn-block.tsx
│   │   │   ├── filter-panel.tsx
│   │   │   ├── issue-detail-tabs.tsx
│   │   │   └── issue-overview-panel.tsx
│   │   ├── features/
│   │   │   ├── setup/            # /setup route (project + DSN steps)
│   │   │   ├── issues/           # reskin: StatBar, FilterPanel, tabs
│   │   │   └── settings/         # CopyDsnBlock, SettingsNav, Field adoption
│   │   └── shell/
│   │       └── app-shell.tsx     # add /setup route
│   └── design/
│       └── components.md         # recipes for new primitives
└── design/
    └── DASHBOARD.md              # update thesis when complete
```

**Structure Decision**: Dashboard UX is a cross-cutting slice — minimal Rust additions in `storage` + `server`, primary work in `web/src/ui/` and `web/src/features/`. Shell IA already matches v2 target; no rail/top-strip restructure needed.

---

## Implementation Slices

Build order mirrors component-inventory P0 → P1 and journey dependencies.

| Slice | Delivers | Proof | Status |
|---|---|---|---|
| **D0** | Migration + stats + setup APIs | `curl` stats/setup; `cargo test` route tests | |
| **D1** | Radix Tabs, Popover, CopyButton + Design Lab | `/__design` previews | |
| **D2** | Setup flow (`/setup`) + SetupChecklist + CopyDsnBlock | J1 steps 1–2 | |
| **D3** | Issues home: StatBar + FilterPanel + default unresolved list | J2 | |
| **D4** | Issue detail tabs (Overview · Stack · Breadcrumbs · More) | J3 | |
| **D5** | Settings polish (SettingsNav, CopyDsnBlock in DSN keys) | J1 step 5, User Story 5 | |
| **D6** | Power regression pass + keyboard hints on demand | J4 + 001 S4 quickstart | |
| **D7** | QA.md + DASHBOARD.md update | J5 | **done** |
| **D8** | Layout positioning (L1–L2): unified Z2 header band; hide detail until selection | J2 scan ≤5s to filters | **done** |
| **D9** | Row polish (M1–M2): `unique_user_count` API + two-line rows, relative time, Came back badge | J2 row readability | **done** |
| **D10** | Overview regression text strip (M3) + layout polish (L3–L5) + triage UX (J4) | J3/J4 | **done** — L4 list width 30rem; M3 strips; bulk bar; list header; back/Esc; mobile detail (L5); L3 header actions (D15) |
| **D11** | Phase 1b: area heuristics + filter chips (M5–M6, 80% seed gate) | Seed fixtures pass | **skipped** — no heuristics backend; 80% gate not met |
| **D12** | Breadcrumbs drawer + logs redirect copy (M7) | Tier 4 breadcrumb filter | **done** |
| **D13** | Releases rail UX (M4): header, empty state, text deltas, drill to Issues | P2 migrant | **done** |
| **D14** | Alerts rail UX: header, empty state, scannable rows, issue links | Velocity journey | **done** |
| **D15** | Issue detail Overview (I1–I8): impact strip, header actions, last occurrences, timeline, Copy for AI | J3/J4 | **done** |
| **D16** | UI polish: C-P0 token bugs + V1 reconciliation + L-P2 band compression + C-P1 primitives | J2/J5 | **done** |
| **D17** | Visual hierarchy: H1–H5 color/affordance/type/section primitives | J2/J3/J5 | **done** |

**Research source:** [hierarchy-verdict.md](./research/hierarchy-verdict.md) · [ui-polish-verdict.md](./research/ui-polish-verdict.md) · [metrics-layout-verdict.md](./research/metrics-layout-verdict.md) · [issue-surface-spec.md](./research/issue-surface-spec.md) · [issue-detail-ux-research.md](./research/issue-detail-ux-research.md)

**Recommended build order:** D16b + D11 gated. D7–D17 shipped 2026-09-13 (L-P4/L-H5 detail header consolidation included).

---

## Complexity Tracking

> No constitution violations. Table empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
