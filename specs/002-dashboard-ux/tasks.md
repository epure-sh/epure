# Tasks: Dashboard UX (Plausible-shaped)

**Feature**: `002-dashboard-ux` | **Branch**: `002-dashboard-ux`

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [data-model.md](./data-model.md) · [quickstart.md](./quickstart.md) · [research/component-inventory.md](./research/component-inventory.md)

**Prerequisites**: `001-phase-1-oss` complete (S0–S6 proofs green) · Constitution v1.1.0

**Forbidden in every task**: ingest/processing/storage engine changes, Redis, chart libraries, shadcn default theme, hex literals in JSX, separate onboarding layout fork.

## Format

```text
- [x] T### [P?] [USn?] Description — files — depends: T### — AC: FR-UX-### / J#
```

- **[P]**: parallel-safe (different files, no incomplete deps)
- **[USn]**: maps to spec user story
- **AC**: functional requirement ID and journey proof gate

## FR-UX Coverage Map

| FR-UX | Slice | Task ID(s) |
|---|---|---|
| FR-UX-001–004, FR-UX-025 | 1 — Setup (J1) | T010–T024 |
| FR-UX-005–008, FR-UX-024 | 2 — Issues home (J2) | T025–T038 |
| FR-UX-009–013 | 3 — Issue detail tabs (J3) | T039–T052 |
| FR-UX-014–017 | 4 — Power regression (J4) | T053–T062 |
| FR-UX-018–020, FR-UX-023 | 5 — Settings + DASHBOARD.md | T063–T074 |
| FR-UX-021–022 | 6 — Journey proofs (J5) | T075–T082 |

---

## Phase 0: Foundation (blocking)

**Purpose**: Shared kit primitives and backend APIs that slice 1–2 depend on. No user-story UI until this phase completes.

**Checkpoint**: `cargo test` green for setup routes; `npm run build` in `web/` with new Radix packages.

- [x] T001 [P] Install `@radix-ui/react-tabs` and `@radix-ui/react-popover` in `web/package.json` — depends: — — AC: library-fit P0
- [x] T002 [P] Implement token-skinned Radix Tabs primitive in `web/src/ui/tabs.tsx` (hairline underline, `border-accent` active, no pills) and export from `web/src/ui/index.ts` — depends: T001 — AC: FR-UX-021
- [x] T003 [P] Implement token-skinned Radix Popover primitive in `web/src/ui/popover.tsx` and export from `web/src/ui/index.ts` — depends: T001 — AC: FR-UX-021
- [x] T004 [P] Implement `CopyButton` in `web/src/ui/copy-button.tsx` (one-click copy + toast feedback) and export from `web/src/ui/index.ts` — depends: — — AC: FR-UX-002
- [x] T005 Add SQLx migration `crates/storage/migrations/20260912000001_setup_progress.sql` creating `user_setup_progress` with PK `(user_id, org_id, project_id)`, columns `project_named BOOLEAN NOT NULL DEFAULT false`, `dsn_copied_at TIMESTAMPTZ`, `first_issue_seen_at TIMESTAMPTZ`, `completed_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, plus RLS policy `org_id = current_setting('app.current_org_id')::uuid` — depends: — — AC: FR-UX-025
- [x] T006 Implement setup progress storage in `crates/storage/src/setup.rs`: `get_setup_progress`, `upsert_setup_progress` (idempotent PATCH; set `completed_at` when `first_issue_seen_at` recorded) — depends: T005 — AC: FR-UX-025
- [x] T007 [P] Implement headline stats queries in `crates/storage/src/stats.rs`: `unresolved` (`status = 'unresolved'`, `merge_parent_id IS NULL`), `events_7d` (`occurred_at >= now() - interval '7 days'`, partition-pruned), `regressions` (`status = 'regression'`); scope by `project_id` + optional `environment`; zero counts return `0` — depends: — — AC: FR-UX-024
- [x] T008 Implement `GET/PATCH /api/v1/setup` in `crates/server/src/routes/api/setup.rs` per `contracts/dashboard.openapi.yaml`; wire in `crates/server/src/routes/api/mod.rs` — depends: T006 — AC: FR-UX-025
- [x] T009 [P] Implement `GET /api/v1/stats` in `crates/server/src/routes/api/stats.rs` per `contracts/dashboard.openapi.yaml`; wire in `crates/server/src/routes/api/mod.rs` — depends: T007 — AC: FR-UX-024
- [x] T010 [P] Add integration tests for setup and stats routes in `crates/server/tests/dashboard_ux.rs` (session auth, RLS isolation, zero-count edge case) — depends: T008, T009 — AC: FR-UX-024, FR-UX-025
- [x] T011 [P] Add `fetchSetupProgress`, `patchSetupProgress`, `fetchHeadlineStats` to `web/src/lib/api.ts` matching OpenAPI shapes — depends: T008, T009 — AC: FR-UX-024, FR-UX-025
- [x] T012 [P] Add Design Lab previews for Tabs, Popover, CopyButton in `web/src/features/design-lab/index.tsx` — depends: T002, T003, T004 — AC: FR-UX-021
- [x] T013 **Phase 0 checkpoint**: run `cargo test dashboard_ux` and `cd web && npm run build` — depends: T001–T012 — AC: foundation ready

---

## Slice 1 — Setup flow + CopyDsnBlock + setup persistence (J1)

**Goal**: Fresh user completes project naming + DSN copy in-app, sees checklist on Issues until first issue, never needs README.

**User Story**: US1 (P1) · **Journey**: J1 · **Independent test**: [quickstart.md J1](./quickstart.md#j1--first-issue-without-readme)

- [x] T014 [P] [US1] Implement `CopyDsnBlock` in `web/src/ui/copy-dsn-block.tsx` (mono DSN slab, `CopyButton`, plain-language label, optional reveal) and export from `web/src/ui/index.ts` — depends: T004, T013 — AC: FR-UX-002
- [x] T015 [P] [US1] Implement `StepIndicator` in `web/src/ui/step-indicator.tsx` (token bars + `--signal` checkmarks, no Radix Progress) and export from `web/src/ui/index.ts` — depends: T013 — AC: FR-UX-001
- [x] T016 [US1] Implement `SetupChecklist` in `web/src/ui/setup-checklist.tsx` (steps: Create project · Copy DSN · Send test error · First issue received; horizontal/card layout) and export from `web/src/ui/index.ts` — depends: T015 — AC: FR-UX-003
- [x] T017 [P] [US1] Implement `SdkSnippetBlock` in `web/src/ui/sdk-snippet-block.tsx` (copy-ready init snippet with DSN placeholder) and export from `web/src/ui/index.ts` — depends: T004 — AC: FR-UX-004
- [x] T018 [US1] Create setup feature page in `web/src/features/setup/index.tsx`: step 1 project name (`Field` + `Input` + `createProject`), step 2 `CopyDsnBlock` (`createDsnKey` + `formatDsn`); PATCH `project_named` and `dsn_copied` on advance — depends: T011, T014, T017 — AC: FR-UX-001, FR-UX-002
- [x] T019 [US1] Add `/setup` route inside existing `AppShell` in `web/src/shell/app-shell.tsx` (no separate layout fork — FR-UX-018) — depends: T018 — AC: FR-UX-001, FR-UX-018
- [x] T020 [US1] Add first-run redirect in `web/src/shell/auth-guard.tsx` or `web/src/features/issues/index.tsx`: incomplete setup (`!complete` from `fetchSetupProgress`) → `/setup` or Issues with prompt — depends: T019 — AC: FR-UX-001, FR-UX-025
- [x] T021 [US1] Wire compact `SetupChecklist` on Issues home in `web/src/features/issues/index.tsx` for steps 3–4 after `/setup` steps 1–2; show resume link when user skips mid-flow (edge case) — depends: T016, T020 — AC: FR-UX-003
- [x] T022 [US1] On Issues load when `issues.length >= 1`, PATCH `first_issue_seen: true` via `patchSetupProgress` and dismiss checklist — depends: T021 — AC: FR-UX-003, FR-UX-025
- [x] T023 [US1] Replace Issues empty-state README archaeology with setup-aware copy: distinguish "setup incomplete" vs "No unresolved exceptions" (`0 UNRESOLVED EXCEPTIONS`) — depends: T021 — AC: FR-UX-004
- [x] T024 **Slice 1 checkpoint**: run [quickstart.md J1](./quickstart.md#j1--first-issue-without-readme) (fresh account → setup → DSN copy → fixture error → issue visible; no README) — depends: T014–T023 — AC: J1, SC-UX-001

---

## Slice 2 — StatBar + FilterPanel + Issues home (J2)

**Goal**: Issues home shows plain-language headline stats, default unresolved list, Filter behind a button — no query syntax hero.

**User Story**: US2 (P1) · **Journey**: J2 · **Independent test**: [quickstart.md J2](./quickstart.md#j2--five-second-scan)

- [x] T025 [P] [US2] Implement `StatBar` in `web/src/ui/stat-bar.tsx` (three metrics: **Unresolved**, **Events (7d)**, **Regressions**; `font-mono-slash`; zero shows `0`) and export from `web/src/ui/index.ts` — depends: T013 — AC: FR-UX-005
- [x] T026 [US2] Implement `FilterPanel` in `web/src/ui/filter-panel.tsx` (`Popover` trigger labeled **Filter**; plain-language preset chips; optional query `Input` for advanced syntax; active filter chip summary on home) and export from `web/src/ui/index.ts` — depends: T003 — AC: FR-UX-007
- [x] T027 [US2] Wire `StatBar` to `fetchHeadlineStats` in `web/src/features/issues/index.tsx` scoped to active `projectId` + `environment` from `AppContext` — depends: T011, T025 — AC: FR-UX-005, FR-UX-024
- [x] T028 [US2] Replace always-visible `FilterRow` / `QueryBar` hero with `FilterPanel` + chip summary in `web/src/features/issues/index.tsx`; remove `is:unresolved` from default visible surface — depends: T026 — AC: FR-UX-006, FR-UX-007
- [x] T029 [US2] Default Issues list query to unresolved only without exposing `is:unresolved` token on primary surface (internal default via `query-utils.ts` or empty `q` + server default) in `web/src/features/issues/index.tsx` — depends: T028 — AC: FR-UX-006
- [x] T030 [US2] Map preset chip plain labels ("Unresolved", "Error", "Regression") to query tokens in `web/src/features/issues/query-utils.ts`; keep token syntax available inside FilterPanel only — depends: T028 — AC: FR-UX-007
- [x] T031 [US2] Verify TopStrip project behavior in `web/src/shell/top-strip.tsx`: static name label when one project; `Select` switcher when two or more — depends: T013 — AC: FR-UX-008
- [x] T032 [P] [US2] Add Design Lab previews for `StatBar`, `FilterPanel`, `SetupChecklist`, `CopyDsnBlock` in `web/src/features/design-lab/index.tsx` — depends: T025, T026, T016, T014 — AC: FR-UX-021
- [x] T033 [US2] Delete or gut unused `web/src/features/issues/filter-row.tsx` and `web/src/features/issues/query-bar.tsx` after FilterPanel migration — depends: T028 — AC: FR-UX-007
- [x] T034 **Slice 2 checkpoint**: run [quickstart.md J2](./quickstart.md#j2--five-second-scan) (stat bar plain labels; no query hero; 5-second scan) — depends: T025–T033 — AC: J2, SC-UX-002

---

## Slice 3 — IssueDetailTabs + Overview/Stack/Breadcrumbs/More (J3)

**Goal**: Issue detail uses tabs; Overview shows Resolve/Ignore above fold; advanced panels behind Stack/Breadcrumbs/More.

**User Story**: US3 (P1) · **Journey**: J3 · **Independent test**: [quickstart.md J3](./quickstart.md#j3--one-screen-triage)

- [x] T035 [P] [US3] Implement `IssueOverviewPanel` in `web/src/ui/issue-overview-panel.tsx` (title, status badge, event count, last seen, environment, release, Resolve/Ignore actions — no scroll required) and export from `web/src/ui/index.ts` — depends: T002 — AC: FR-UX-010
- [x] T036 [P] [US3] Extract `StackTracePanel` in `web/src/ui/stack-trace-panel.tsx` (wraps `CodeBlock`; empty state; `OccurrencePicker` slot) — depends: T002 — AC: FR-UX-011
- [x] T037 [P] [US3] Extract `BreadcrumbTimeline` in `web/src/ui/breadcrumb-timeline.tsx` (filter chips All/HTTP/Console/Errors + time-ordered list) from `web/src/features/issues/event-detail.tsx` — depends: T002 — AC: FR-UX-012
- [x] T038 [P] [US3] Implement `MorePanel` in `web/src/ui/more-panel.tsx` (hosts DiffPanel, SnoozeMenu, export, merge/split entry points) — depends: T002 — AC: FR-UX-013
- [x] T039 [US3] Implement `IssueDetailTabs` in `web/src/ui/issue-detail-tabs.tsx` composing Overview · Stack · Breadcrumbs · More via `tabs.tsx`; lazy-mount non-Overview tabs — depends: T035, T036, T037, T038 — AC: FR-UX-009
- [x] T040 [US3] Refactor `web/src/features/issues/event-detail.tsx` to wire data into tab panels; remove single-scroll layout — depends: T039 — AC: FR-UX-009
- [x] T041 [US3] Remove permanent keyboard hint row (`Kbd` strip) from issue detail header in `web/src/features/issues/index.tsx` — depends: T040 — AC: FR-UX-015
- [x] T042 [US3] Move `DiffPanel` mount from default view to More tab only in `web/src/features/issues/index.tsx` / `event-detail.tsx` — depends: T038, T040 — AC: FR-UX-013
- [x] T043 [US3] Ensure Resolve and Ignore remain visible on Overview without scrolling past stack/diff/keyboard panels — depends: T035, T040 — AC: FR-UX-010
- [x] T044 [P] [US3] Add Design Lab preview for `IssueDetailTabs` + panel children in `web/src/features/design-lab/index.tsx` — depends: T039 — AC: FR-UX-021
- [x] T045 **Slice 3 checkpoint**: run [quickstart.md J3](./quickstart.md#j3--one-screen-triage) (Overview above fold; tabs gate depth) — depends: T035–T044 — AC: J3, SC-UX-003

---

## Slice 4 — Power features behind Filter/More; 001 non-regression (J4)

**Goal**: Keyboard triage, merge/split, bulk actions, export, and query syntax remain functional — relocated, not removed.

**User Story**: US4 (P2) · **Journey**: J4 · **Independent test**: [quickstart.md J4](./quickstart.md#j4--power-regression)

- [x] T046 [US4] Verify `j`/`k`/`e`/`i`/`x` keyboard handlers in `web/src/features/issues/issue-list.tsx` still work after FilterPanel + tab refactor — depends: T045 — AC: FR-UX-014
- [x] T047 [US4] Verify `MergeActions` and `BulkActions` in list column (`web/src/features/issues/merge-actions.tsx`, `bulk-actions.tsx`) remain reachable in multi-select mode — depends: T045 — AC: FR-UX-017
- [x] T048 [US4] Wire export (`Cmd+Shift+C` + More tab button) via `web/src/features/issues/export-markdown.ts` inside `MorePanel` — depends: T038 — AC: FR-UX-013, FR-UX-014
- [x] T049 [US4] Reimplement `SnoozeMenu` using `DropdownMenu` in `web/src/features/issues/snooze-menu.tsx`; mount in More tab only — depends: T038 — AC: FR-UX-013
- [x] T050 [P] [US4] Implement `KeyboardHintsFooter` in `web/src/ui/keyboard-hints-footer.tsx` (collapsible or `?`-triggered); wire from command palette help action — depends: T041 — AC: FR-UX-015
- [x] T051 [US4] Confirm command palette (`⌘K`) in `web/src/shell/command-palette.tsx` remains available but is not promoted on first-run Issues home (no hero CTA) — depends: T028 — AC: FR-UX-016
- [x] T052 [US4] Confirm FilterPanel advanced query syntax applies to list identically to pre-refactor `FilterRow` behavior — depends: T030 — AC: FR-UX-007, FR-UX-014
- [x] T053 [US4] Run `cargo test` full suite from `apps/epure/` — depends: T046–T052 — AC: FR-UX-014
- [x] T054 [US4] Re-run [001 quickstart S4](../001-phase-1-oss/quickstart.md) keyboard and bulk proof rows — depends: T053 — AC: J4, SC-UX-004
- [x] T055 **Slice 4 checkpoint**: run [quickstart.md J4](./quickstart.md#j4--power-regression) — depends: T046–T054 — AC: J4

---

## Slice 5 — Settings polish + DASHBOARD.md update

**Goal**: Settings uses same visual calm as Issues; DSN copy matches setup; secondary nav consistent; design contract updated.

**User Story**: US5 (P2) · **Also**: FR-UX-023

- [x] T056 [P] [US5] Extract `SettingsNav` in `web/src/ui/settings-nav.tsx` (vertical nav: Projects · DSN keys · Webhooks · Team) and use in `web/src/features/settings/index.tsx` — depends: T013 — AC: FR-UX-019
- [x] T057 [US5] Replace raw `<pre>` DSN display with `CopyDsnBlock` in `web/src/features/settings/dsn-keys.tsx` — depends: T014 — AC: FR-UX-002, FR-UX-019
- [x] T058 [P] [US5] Adopt `Field` wrapper and remove native `<select>` from `web/src/features/settings/projects.tsx` (use `Select` primitive) — depends: T013 — AC: FR-UX-021
- [x] T059 [P] [US5] Adopt `Field` + `Select`; remove native `<select>` from `web/src/features/settings/webhooks.tsx` — depends: T013 — AC: FR-UX-021
- [x] T060 [P] [US5] Adopt `Field` + `Select`; remove native `<select>` from `web/src/features/settings/team.tsx` — depends: T013 — AC: FR-UX-021
- [x] T061 [US5] Replace native `<select>` in `web/src/features/issues/diff-panel.tsx` with `Select` primitive (now under More tab) — depends: T042, T013 — AC: FR-UX-021
- [x] T062 [P] [US5] Ensure Releases and Alerts empty states in `web/src/features/releases/index.tsx` and `web/src/features/alerts/index.tsx` use title + one-line hint + optional action (no mascot) — depends: T013 — AC: FR-UX-020
- [x] T063 [US5] Add component recipes for new P0 primitives to `web/design/components.md` (CopyDsnBlock, StatBar, FilterPanel, IssueDetailTabs, SetupChecklist) — depends: T014, T025, T026, T039, T016 — AC: FR-UX-021
- [x] T064 [US5] Update `design/DASHBOARD.md` thesis from Linear/Sentry-era to Plausible-shaped clarity (IA, filter rules, tabbed detail, setup ritual) per [charter.md](./charter.md) — depends: T028, T039, T056 — AC: FR-UX-023
- [x] T065 **Slice 5 checkpoint**: Settings → DSN keys → one-click copy; secondary sidebar navigable; DASHBOARD.md reflects v2 IA — depends: T056–T064 — AC: FR-UX-019, FR-UX-023

---

## Slice 6 — Journey proofs J1–J5 + ROADMAP S3d

**Goal**: Record all journey proofs; mark S3d complete; unblock PUBLISH.md.

**User Stories**: US6 (J5) + cross-cutting SC-UX-007

- [x] T066 Run [quickstart.md J1](./quickstart.md#j1--first-issue-without-readme) end-to-end; record date + method in proof table — depends: T024 — AC: J1, SC-UX-001
- [x] T067 Run [quickstart.md J2](./quickstart.md#j2--five-second-scan) with non-builder participant; record date + method — depends: T034 — AC: J2, SC-UX-002
- [x] T068 Run [quickstart.md J3](./quickstart.md#j3--one-screen-triage); record date + method — depends: T045 — AC: J3, SC-UX-003
- [x] T069 Run [quickstart.md J4](./quickstart.md#j4--power-regression); record date + method — depends: T055 — AC: J4, SC-UX-004
- [x] T070 Run [design/QA.md](../../../design/QA.md) checklist on Issues, Setup, Settings, Releases, Alerts; record pass — depends: T065 — AC: J5, FR-UX-022, SC-UX-005
- [x] T071 [P] Run hex-literal grep per [quickstart.md J5](./quickstart.md#j5--design-qa) on `web/src/features`, `web/src/ui`, `web/src/shell` — depends: T065 — AC: FR-UX-021
- [x] T072 Verify `/__design` lab previews match production primitives used on reskinned screens — depends: T032, T044 — AC: FR-UX-022
- [x] T073 Update proof record table in `specs/002-dashboard-ux/quickstart.md` with all five journeys checked — depends: T066–T072 — AC: SC-UX-007
- [x] T074 Mark **S3d — Dashboard UX** complete in `ROADMAP.md` (checkbox + proof reference to quickstart J1–J5); update **Next action** to Phase 1 exit / PUBLISH.md — depends: T073 — AC: S3d, SC-UX-007
- [x] T075 **Slice 6 checkpoint**: all J1–J5 proofs recorded; ROADMAP S3d checked; ready for [PUBLISH.md](../../PUBLISH.md) — depends: T066–T074 — AC: SC-UX-007

---

## Dependencies & Execution Order

### Phase / slice order (strict)

```text
Phase 0 (T001–T013)
  → Slice 1 Setup/J1 (T014–T024)
  → Slice 2 Issues home/J2 (T025–T034)
  → Slice 3 Issue tabs/J3 (T035–T045)
  → Slice 4 Power/J4 (T046–T055)
  → Slice 5 Settings (T056–T065)
  → Slice 6 Proofs (T066–T075)
```

### Parallel opportunities

| After | Parallel group |
|---|---|
| T013 | T014 + T015 + T017 (Slice 1 ui/) |
| T013 | T025 + T026 (Slice 2 ui/) |
| T039 | T035 + T036 + T037 + T038 (tab panel extractions) |
| T065 | T066–T069 (journey proofs, different testers) |
| T065 | T070 + T071 (QA checklist + hex grep) |

### MVP scope

**Slice 1 only** (T001–T024): delivers J1 — first issue without README. Minimum viable publish comprehension gate.

---

## Implementation Strategy

1. Complete **Phase 0** before any slice UI — backend + primitives block everything.
2. Ship **Slice 1** → validate J1 → demo onboarding.
3. Ship **Slice 2** → validate J2 → Issues home is legible.
4. Ship **Slice 3** → validate J3 → triage path calm.
5. Ship **Slice 4** → validate J4 → power users safe.
6. Ship **Slice 5** → Settings + design contract aligned.
7. **Slice 6** records proofs and closes S3d — only then proceed to PUBLISH.md.

**Total tasks**: 75 (Phase 0: 13 · Slice 1: 11 · Slice 2: 10 · Slice 3: 11 · Slice 4: 10 · Slice 5: 10 · Slice 6: 10)
