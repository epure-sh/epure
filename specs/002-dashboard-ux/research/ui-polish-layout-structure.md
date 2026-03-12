# UI polish — shell, layout & information architecture

**Status:** Research (2026-09-13) — no implementation  
**Inputs:** `web/src/shell/*` · `web/src/features/issues|releases|alerts|settings/*` · [metrics-layout-verdict.md](./metrics-layout-verdict.md) (Z0–Z7) · `web/design/tokens.css`  
**Charter:** [charter.md](../charter.md) · [issue-surface-spec.md](./issue-surface-spec.md)

---

## Executive summary

The global shell (rail + top strip) is coherent and matches the charter IA. **Pain concentrates on the Issues route:** too many stacked horizontal bands before the first list row, inconsistent page chrome vs sibling routes (Releases, Alerts, Settings), and a master-detail pane that adds its own mini-header stack on top of page-level chrome. Secondary routes use `PageHeader` correctly but disagree on scroll behavior, max-width, and sub-navigation pattern (sidebar vs tabs).

**Root cause:** Issues evolved as a bespoke layout (stat bar + filter band + list sub-header) while other routes adopted `PageHeader` + centered content. There is no shared **page chrome contract** — only a global chrome contract (rail + top strip).

---

## 1. Current structure map

### 1.1 Global shell (all authenticated routes)

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│ ShellRail    │ TopStrip (Z0)                                              │
│ w-rail 12rem │ [logo] · project ▾ · env ▾ · Connect · Feedback · ⌘K · 👤 │
│              ├────────────────────────────────────────────────────────────┤
│ OrgRail OR   │                                                            │
│ ProjectRail  │  <main> — route outlet                                     │
│              │                                                            │
│ Issues       │                                                            │
│ Releases     │                                                            │
│ Alerts       │                                                            │
│ Settings     │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
```

**Files:** `app-shell.tsx` · `shell-rail.tsx` · `org-rail.tsx` · `project-rail.tsx` · `top-strip.tsx` · `project-scope.tsx`

**Tokens:** `--chrome-rail-width: 12rem` · `--chrome-top-height: 2.5rem`

---

### 1.2 Workspace routes (`/`, `/team`, `/settings`, `/usage`, `/billing`)

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│ OrgRail      │ TopStrip — project switcher shows "Select project"           │
│ Projects     ├────────────────────────────────────────────────────────────┤
│ Team         │ ▼ scrollable main (bg-bg, p-4)                             │
│ Settings     │   ┌──────────────────────────────────── max-w-2xl/3xl/4xl ─┐ │
│ Usage        │   │ PageHeader (title text-2xl, py-5, border-b)            │ │
│ Billing      │   │   — Org home: header scrolls WITH content              │ │
│              │   │   — Usage/Billing: header FIXED, content scrolls below │ │
│              │   │ route body (cards, tables, forms)                      │ │
│              │   └──────────────────────────────────────────────────────┘ │
└──────────────┴────────────────────────────────────────────────────────────┘
```

**Org home** (`org/home.tsx`): `h-full overflow-auto` — entire page including `PageHeader` scrolls.  
**Usage / Billing** (`org/usage.tsx`, `org/billing.tsx`): `flex-col` — header pinned, body `overflow-auto`.  
**Account settings** (`org/account/index.tsx`): `PageHeader` + horizontal `TabsList` + scroll body (`max-w-2xl`).

---

### 1.3 Issues home (`/p/:id/issues`) — master-detail

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│ ProjectRail  │ TopStrip (env · Connect · ⌘K)                                │
│              ├────────────────────────────────────────────────────────────┤
│              │ [A] SetupChecklist (conditional, border-b)                   │
│              ├────────────────────────────────────────────────────────────┤
│              │ [B] StatBar + FilterPanel band (px-6 py-3, border-b)  ← Z2  │
│              ├────────────────────────────────────────────────────────────┤
│              │ [C] IssuesHomeHint (conditional, border-b)                   │
│              ├────────────────────────────────────────────────────────────┤
│              │ [D] RegressionStrip (conditional, border-b)                  │
│              ├──────────────────────────┬─────────────────────────────────┤
│              │ [E] IssuesListHeader     │  (detail hidden until selection)  │
│              │ [F] BulkActions (sticky) │                                   │
│              │ IssueList                │  ≥1024px: IssueDetailTabs        │
│              │ w-issue-list 30rem       │    [G] back + actions bar         │
│              │                          │    [H] tab bar (4 tabs)           │
│              │ <1024px: full width      │    [I] tab content                │
│              │ detail overlays list     │    [J] KeyboardHintsFooter (?)    │
│              └──────────────────────────┴─────────────────────────────────┘
└──────────────┴────────────────────────────────────────────────────────────┘
```

**Bands A–D** can stack to **4–6 bordered rows** before the first issue row (E). At `text-3xl` stat values, vertical budget exceeds the ≤120px target in [metrics-layout-verdict.md §4](./metrics-layout-verdict.md).

**First-run empty:** single column, no master-detail, centered `Empty` + `SetupChecklist`.

---

### 1.4 Issue detail (inside Issues master-detail, ≥1024 or full-screen <1024)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [G] Toolbar: ← Back | truncated title (mobile) | Resolve Ignore Snooze Copy │
├─────────────────────────────────────────────────────────────────────────────┤
│ [H] Tabs: Overview · Stack · Breadcrumbs · More                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ [I] Overview tab body:                                                      │
│     h2 title + status badges (duplicate of toolbar context)                 │
│     IssueImpactStrip · dl grid · timeline · occurrences · banners           │
├─────────────────────────────────────────────────────────────────────────────┤
│ [J] ? keyboard hints footer                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.5 Releases (`/p/:id/releases`)

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│ ProjectRail  │ TopStrip                                                     │
│              ├────────────────────────────────────────────────────────────┤
│              │ PageHeader — "Releases" + description                        │
│              ├────────────────────────────────────────────────────────────┤
│              │ scroll body (p-6, max-w-3xl mx-auto)                         │
│              │   bordered list rows → link to Issues with release filter  │
└──────────────┴────────────────────────────────────────────────────────────┘
```

---

### 1.6 Alerts (`/p/:id/alerts`)

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│ ProjectRail  │ TopStrip                                                     │
│              ├────────────────────────────────────────────────────────────┤
│              │ PageHeader — "Alerts" + description | [Configure webhooks]   │
│              ├────────────────────────────────────────────────────────────┤
│              │ AlertsIssuesHint (conditional, border-b)                     │
│              ├────────────────────────────────────────────────────────────┤
│              │ scroll body (p-6, max-w-3xl mx-auto)                         │
│              │   summary line + bordered alert rows                         │
└──────────────┴────────────────────────────────────────────────────────────┘
```

---

### 1.7 Project settings (`/p/:id/settings/*`)

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│ ProjectRail  │ TopStrip (+ Connect → DSN)                                   │
│  … Settings  ├────────────────────────────────────────────────────────────┤
│   active     │ PageHeader — "Project settings"                              │
│              ├──────────────┬─────────────────────────────────────────────┤
│              │ SettingsNav  │ scroll body (bg-bg, p-4, max-w-2xl)         │
│              │ w-44 sidebar │   General | Connection | Webhooks forms     │
│              └──────────────┴─────────────────────────────────────────────┘
└──────────────┴────────────────────────────────────────────────────────────┘
```

---

### 1.8 Setup (`/p/:id/setup`)

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│ ProjectRail  │ TopStrip                                                     │
│              ├────────────────────────────────────────────────────────────┤
│              │ PageHeader — "Connect your app"                              │
│              ├────────────────────────────────────────────────────────────┤
│              │ scroll body (max-w-xl mx-auto p-6)                           │
│              │   StepIndicator + card forms                                 │
└──────────────┴────────────────────────────────────────────────────────────┘
```

---

## 2. Friction points

### 2.1 Too many bands (Issues home)

| Band | Component | When visible | Problem |
|------|-----------|--------------|---------|
| Z0 | `TopStrip` | always | OK — global |
| A | `SetupChecklist` | incomplete setup | Adds row; overlaps mentally with `/setup` |
| B | StatBar + FilterPanel | always (non-empty) | Custom chrome, not `PageHeader`; stats use `text-3xl` |
| C | `IssuesHomeHint` | until dismissed | Another full-width strip |
| D | `RegressionStrip` | regressions > 0 | Correct content, wrong stacking model |
| E | `IssuesListHeader` | always | Third "title" layer ("Unresolved" / filter-derived) |
| F | `BulkActions` | selection / split | Sticky sub-toolbar inside list column |

**Measured intent vs reality:** [metrics-layout-verdict.md](./metrics-layout-verdict.md) targets ≤120px from content top to first list row. Current stack is ~240–280px with checklist + hint + regression strip — **the primary "UI feels wrong" signal**.

### 2.2 Misaligned toolbars

| Location | Controls | Misalignment |
|----------|----------|--------------|
| Issues Z2 | stats left, filter/time/sort right | Correct Plausible shape — but **not** the same component/height as `PageHeader` on sibling rails |
| Issues list E+F | select-all, count subtitle, bulk bar | Lives inside list column; filters are outside — **split brain** for "what scope am I in?" |
| Detail G | back + 4 action buttons | Separate from tab bar H; wraps on `md` |
| Detail Overview | h2 title + badges again | Title appears in G (mobile truncate) and I (full) — redundant |
| TopStrip | Connect | Duplicates entry to DSN settings already in rail |

### 2.3 Inconsistent headers

| Route | Header pattern | Title scale | Padding | Scroll model |
|-------|----------------|-------------|---------|--------------|
| Issues | bespoke StatBar band | stat `text-3xl` | `px-6 py-3` | page flex, list scrolls inside |
| Releases / Alerts | `PageHeader` | `text-2xl` | `px-6 py-5` | header fixed, body scrolls |
| Settings | `PageHeader` | `text-2xl` | `px-6 py-5` | header fixed |
| Org home | `PageHeader` inside scroll | `text-2xl` | `px-6 py-5` | **header scrolls away** |
| Account | `PageHeader` + tabs | `text-2xl` | tabs `px-6` | tabs fixed below header |

No route except Issues puts **actions in the page header row** (Alerts has "Configure webhooks" — the right pattern).

### 2.4 Surface / width patchwork

- **Backgrounds:** `main` is `bg-bg`; Issues list/detail use `bg-surface`; settings content uses `bg-bg` with `surface` cards — three surface levels in one viewport.
- **Max-width:** `max-w-xl` (setup) · `max-w-2xl` (settings, account) · `max-w-3xl` (releases, alerts, usage) · `max-w-4xl` (org home) — no documented tier.
- **List width:** `--chrome-list-width: 30rem` (L4 shipped) — good; detail min width undocumented in tokens.

### 2.5 Navigation depth

At Settings, user sees **three vertical nav systems:** ProjectRail → SettingsNav sidebar → form sections. Account settings uses **tabs instead of sidebar** for the same conceptual job (section switching). Cognitive mismatch.

---

## 3. Proposed zone model — unified page chrome

Extend the Z0–Z7 model from [metrics-layout-verdict.md](./metrics-layout-verdict.md) with a **page-level contract** every route shares.

### 3.1 Two-tier chrome

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ G0  Global chrome (unchanged)                                               │
│     ShellRail + TopStrip                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ G1  Page chrome — ONE band, always                                          │
│     [Page title + optional subtitle]              [primary actions · tools] │
│     height: --chrome-page-header (~3rem compact, not py-5 marketing)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ G2  Context strip (0–1 row, optional, collapsible)                          │
│     stats · filter chips · dismissible hints · regression callout           │
│     merge multiple hints into one strip OR accordion                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ G3  Content region                                                          │
│     master-detail | list | form | setup wizard                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Route mapping

| Route | G1 (title \| actions) | G2 (context) | G3 (content) |
|-------|----------------------|--------------|--------------|
| **Issues** | `Issues` · env subtitle \| Filter, time▾, sort▾ | Stat pills (compact) + optional regression | master-detail |
| **Releases** | `Releases` · count subtitle \| — | — | version list |
| **Alerts** | `Alerts` · subtitle \| Configure webhooks | optional single hint | alert list |
| **Settings** | `Project settings` \| — | — (nav moves to G3 left rail) | sidebar + form |
| **Setup** | `Connect your app` \| — | StepIndicator inline in G3 | wizard card |

### 3.3 `PageChrome` component (spec only)

Single primitive wrapping today's `PageHeader` + Issues stat/filter row:

```tsx
// Spec shape — not implemented
<PageChrome
  title="Issues"
  description={envScopedSubtitle}
  actions={<FilterPanel … />}
  context={<StatBar variant="compact" … />}
/>
```

**Rules:**

1. **One bordered row** for G1; G2 may border-b but never duplicates title.
2. **Title scale:** `text-lg` or `text-xl` for app pages — not `text-2xl` + `text-3xl` stats on same screen ([charter](./charter.md): restraint).
3. **Stats in G2** use `text-xl` / `font-mono-slash` — not hero `text-3xl` (`stat-bar.tsx` line 42).
4. **Actions right-aligned** on `sm+`; stack below title only on `xs`.
5. **Padding:** `px-4` on `<md`, `px-6` on `md+` — match list column inset.

### 3.4 Issues home target (revised Z order)

```
G0  TopStrip
G1  PageChrome: "Issues" | Filter · time · sort
G2  Compact stats (inline pills) + optional merged hint/regression chip
G3  Master-detail (no list-column title band)
    G3a  List (30rem) — rows only; bulk bar overlays list top when active
    G3b  Detail — tabs + body
```

**Removes:** `IssuesListHeader` as permanent band (subtitle moves to G1/G2; select-all becomes floating or G2 left).

---

## 4. Master-detail refinements

### 4.1 List column

| Current | Proposed | Why |
|---------|----------|-----|
| `IssuesListHeader` with h2 + subtitle | Absorb into G1/G2 | Eliminates duplicate "Unresolved" labeling |
| `BulkActions` sticky inside list | Floating bar at G2/G3 boundary OR overlay top of list | One toolbar plane; doesn't compete with list header |
| Fixed `w-issue-list` 30rem | Keep token; add `min-w-0` on detail | L4 done |
| Empty right pane | Hidden until selection | L2 done |

### 4.2 Detail pane

| Current | Proposed | Why |
|---------|----------|-----|
| Toolbar G + Tabs H + Overview title | **Tab bar owns wayfinding**; Overview drops h2, keeps badges + dl | Single title source; J3 one-screen triage |
| Actions in toolbar above tabs | **Actions in G1 of detail sub-chrome** OR right of tab row on `lg+` | Matches charter "Resolve/Ignore on Overview" without extra band |
| `KeyboardHintsFooter` | Keep `?` toggle (L3 done) | OK |
| 4 tabs on mobile | Slice F: Overview + Stack primary; Breadcrumbs/More in overflow | [issue-surface-spec.md § Slice F](./issue-surface-spec.md) |

### 4.3 Detail header target

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Issues     Overview · Stack · [···]          Resolve  Ignore  Snooze      │
├─────────────────────────────────────────────────────────────────────────────┤
│ (tab content — Overview starts with badges + dl, no repeated h2)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

On `≥1024`, back control hidden (list visible). On `<1024`, full-screen with back.

---

## 5. Settings vs project-scoped layout consistency

### 5.1 Current divergence

| Aspect | Project settings | Account settings |
|--------|------------------|------------------|
| Sub-nav | Left `SettingsNav` w-44 | Horizontal `TabsList` |
| Content bg | `bg-bg` | `bg-bg` |
| Header | `PageHeader` | `PageHeader` + tabs below |
| Max width | `max-w-2xl` | `max-w-2xl` |

Both are valid patterns; **using both in one product** feels inconsistent when ProjectRail already highlights "Settings".

### 5.2 Recommendation

**Option A (preferred):** Sidebar sub-nav for all settings surfaces.

- Account: replace tabs with `SettingsNav`-style left rail (General · Security).
- Project: keep `SettingsNav`.
- **Proof:** user can predict "settings = left sections" everywhere.

**Option B:** Tabs for shallow settings (≤3 sections), sidebar for deep (project has connection + webhooks forms).

- Document in `web/design/components.md` when to use which.
- Account stays tabs; project stays sidebar — but **unify visual treatment** (same width `w-44`, same active border-l accent).

**Shared either way:**

- G1 `PageChrome` with title + description on all settings routes.
- Fixed header + scroll body (fix org home to match).
- `max-w-2xl` for form content tier (document as `--content-width-settings` token).

### 5.3 Rail duplication

`ProjectRail` includes Settings; `TopStrip` includes Connect → DSN. **Pick one primary path** for connection setup:

- Charter: Connect in top strip for J1 visibility.
- Settings → Connection for power users.
- Polish: Connect opens DSN panel, not a route change, OR Settings nav item renamed "Connection" with rail label staying "Settings".

---

## 6. Mobile / tablet breakpoint gaps

### 6.1 Breakpoint inventory

| Breakpoint | Tailwind | Current behavior | Gap |
|------------|----------|------------------|-----|
| `<640` | default | TopStrip: search icon only; detail back says "Issues" | **Rail still 12rem** — ~32% of 375px width lost |
| `640–1023` | `sm`–`md` | Master-detail collapses to single pane | Tablet shows rail + full-screen list — cramped |
| `≥1024` | `lg` | Master-detail side-by-side | OK per spec |
| `≥1024` | `lg` | TopStrip Feedback link appears | Minor |

**Critical gap:** `ShellRail` has **no responsive hide/collapse**. [issue-surface-spec.md §4.1](./issue-surface-spec.md) defines list/detail collapse at 1024px but not rail behavior.

### 6.2 Slice F status (mobile detail)

Per [issue-surface-spec.md § Slice F](./issue-surface-spec.md):

- [x] Back chevron + Esc (shipped in `issue-detail-tabs.tsx`)
- [x] Primary tabs reduced; Breadcrumbs/More in overflow (`···` menu)
- [x] Bulk/merge desktop-only (`lg+`); per-issue triage actions on mobile back row

Detail bulk/merge hidden below `lg`; Resolve/Ignore/Snooze remain on mobile for J3.

### 6.3 Tablet (768–1023) specific

- Stat + filter band wraps (`flex-wrap`) — height doubles on iPad portrait.
- `PageHeader` `py-5` + `text-2xl` consumes vertical space on short viewports.
- Settings sidebar `w-44` + form: horizontal squeeze; may need sidebar → horizontal scroll chips at `md`.

### 6.4 Token gaps

Add to `tokens.css` (spec):

```css
--chrome-page-header-height: 3rem;
--content-width-narrow: 36rem;   /* setup */
--content-width-default: 48rem;  /* settings */
--content-width-wide: 48rem;     /* lists — align max-w-3xl */
--breakpoint-master-detail: 64rem; /* 1024px — document explicitly */
```

---

## 7. Ranked layout fixes (L-P1 → L-P5)

Prioritized by user pain ("UI structure feels wrong") and dependency order. **Research only** — proof gates reference charter journeys J1–J5.

---

### L-P1 — Responsive global chrome (rail collapse)

**Scope:** Below `lg`, collapse `ShellRail` to icon-only (`3rem`) or bottom tab bar; hamburger to expand on `xs`. TopStrip project/env remain.

**Friction addressed:** 12rem rail on phone/tablet; content feels squeezed; "app shell fights the content".

**Proof gate:**

- [ ] iPhone 375px: content area ≥78% viewport width with nav usable
- [ ] J2: new user still names current project + page without opening menu
- [ ] J1: Connect + project switch reachable in ≤2 taps from Issues

**Depends on:** none  
**Effort:** M (shell only)

---

### L-P2 — Compress Issues vertical chrome

**Scope:** Implement G1/G2 model on Issues: merge StatBar into compact G2; demote stat scale `text-3xl` → `text-xl`; collapse `IssuesHomeHint` + `RegressionStrip` into G2 chip row or single dismissible context strip; remove `IssuesListHeader` band (metadata to G1 subtitle).

**Friction addressed:** Too many bands; first row too far below top; hero stat scale.

**Proof gate:**

- [ ] ≤120px from TopStrip bottom to first issue row (checklist dismissed, hint dismissed, no regression strip)
- [ ] J2 five-second scan unchanged or improved (blind test, n≥3)
- [ ] J4 filter/time/sort still reachable without opening detail

**Depends on:** none (can ship before L-P3)  
**Effort:** M (Issues page + StatBar variant)

---

### L-P3 — Unified `PageChrome` across routes

**Scope:** Extract `PageChrome` from `PageHeader`; migrate Releases, Alerts, Settings, Setup, Org routes; align scroll model (header fixed, body scrolls); normalize padding `py-3` compact; fix org home scrolling header.

**Friction addressed:** Inconsistent headers; org home header scroll; sibling routes feel like different apps.

**Proof gate:**

- [ ] Visual regression: J5 token QA on all routes
- [ ] Every project route has exactly one G1 band with title visible without scrolling
- [ ] Actions slot present on Alerts (reference implementation)

**Depends on:** L-P2 (Issues migration completes the pattern)  
**Effort:** M

---

### L-P4 — Master-detail header consolidation

**Scope:** Detail pane: drop Overview h2 duplicate; move actions to tab row right on `lg+`; implement Slice F tab reduction on `<lg`; bulk/merge hidden below `lg`.

**Friction addressed:** Misaligned toolbars; duplicate title; mobile action overload.

**Proof gate:**

- [ ] J3: message + status + resolve visible without scroll on 1280×800 and 390×844
- [ ] Slice F checklist complete in [issue-surface-spec.md](./issue-surface-spec.md)
- [ ] No h2 duplication in Overview (title only in tab context or mobile back row)

**Depends on:** L-P2 (list column simplified)  
**Effort:** M

---

### L-P5 — Settings & content-width system

**Scope:** Pick sidebar vs tabs policy (§5.2 Option A or B); add content-width tokens; unify settings + org form layouts; resolve Connect duplication (top strip vs settings).

**Friction addressed:** Three nav layers; max-width patchwork; Connect path confusion.

**Proof gate:**

- [ ] Designer/agent can place any form page using tokens only (no per-route `max-w-*` literals)
- [ ] J1: DSN copy path documented — one primary, one secondary
- [ ] Settings navigation pattern identical at account and project level (same component family)

**Depends on:** L-P3  
**Effort:** S–M

---

### Priority summary

| ID | Fix | Impact | Effort | Blocks |
|----|-----|--------|--------|--------|
| **L-P1** | Rail collapse mobile/tablet | High — shell width | M | — |
| **L-P2** | Issues band compression | **Highest** — primary pain | M | — |
| **L-P3** | PageChrome unification | High — cross-route cohesion | M | L-P2 |
| **L-P4** | Detail header cleanup | Medium — triage clarity | M | L-P2 |
| **L-P5** | Settings + width tokens | Medium — polish | S–M | L-P3 |

**Suggested sequence:** L-P2 → L-P1 → L-P3 → L-P4 → L-P5. L-P2 first because Issues is the daily home and the band stack is the clearest structural defect; L-P1 parallel if shell work is isolated.

---

## Appendix — file reference

| Concern | Primary files |
|---------|---------------|
| Shell layout | `web/src/shell/app-shell.tsx` |
| Rails | `shell-rail.tsx` · `project-rail.tsx` · `org-rail.tsx` · `rail-nav.tsx` |
| Top context | `top-strip.tsx` · `project-scope.tsx` |
| Issues orchestration | `web/src/features/issues/index.tsx` |
| List sub-chrome | `issues-list-header.tsx` · `bulk-actions.tsx` |
| Detail shell | `web/src/ui/issue-detail-tabs.tsx` · `issue-overview-panel.tsx` |
| Page header | `web/src/ui/page-header.tsx` |
| Stats / filters | `web/src/ui/stat-bar.tsx` · `web/src/ui/filter-panel.tsx` |
| Settings nav | `web/src/ui/settings-nav.tsx` · `features/settings/index.tsx` |
| Layout tokens | `web/design/tokens.css` · `web/tailwind.config.ts` |
| Prior layout research | `specs/002-dashboard-ux/research/metrics-layout-verdict.md` |

---

## Dissent / non-goals

| Proposal | Verdict |
|----------|---------|
| Separate "focus mode" chrome for triage | **Refuse** — charter one shell |
| Chart / graph header on Issues | **Refuse** — metrics-layout-verdict |
| Permanent keyboard footer | **Refuse** — `?` toggle shipped |
| Sentry-style query bar as hero | **Refuse** — filter behind panel |
