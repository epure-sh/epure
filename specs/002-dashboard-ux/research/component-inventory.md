# Component inventory — gap analysis

**Scope:** `apps/epure/web/src/` as of 2026-09-12  
**Target UX:** [charter.md](../charter.md) — Plausible-shaped error monitoring (J1–J5)  
**Baseline contract:** [design/DASHBOARD.md](../../../../design/DASHBOARD.md) (Linear/Sentry-era thesis; partially superseded by 002)

---

## Executive summary

The kit (`ui/`) covers foundational chrome and triage primitives well: buttons, badges, issue rows, code blocks, filter chips, command palette building blocks. **Shell IA already matches the v2 target** (Rail: Issues · Releases · Alerts · Settings; TopStrip: env · project · ⌘K · user).

The gap is not “missing a design system” — it is **screen composition and progressive disclosure**. Issues is still Sentry-shaped: query syntax is the hero surface, detail is one long scroll (stack + breadcrumbs + diff + keyboard cheat sheet all visible), and setup lives in Settings/README archaeology instead of an in-app ritual.

Roughly **12 new `ui/` components** (6 P0, 4 P1, 2 P2) plus **refactors of 5 feature-local modules** are needed to reach Plausible-shaped UX without regressing Tier 4–5 power proofs.

---

## Existing `ui/` primitives

| Component | File | Role | Used in features |
|-----------|------|------|------------------|
| **Badge** | `badge.tsx` | Status/env/severity pills (`error`, `warning`, `env`) | Issues detail, Alerts |
| **Button** | `button.tsx` | Primary / secondary / ghost / danger | All features |
| **CodeBlock** | `code-block.tsx` | Numbered stack frames; fault-line highlight | Issues (`event-detail`) |
| **Command** | `command.tsx` | ⌘K palette (Dialog + input + groups) | Shell (`command-palette`) |
| **Dialog** | `dialog.tsx` | Modal shell (Radix) | Command palette only |
| **DropdownMenu** | `dropdown-menu.tsx` | User menu in TopStrip | Shell (`top-strip`) |
| **Empty** | `empty.tsx` | Typographic empty state; default `0 UNRESOLVED EXCEPTIONS` | Issues, Releases, Alerts |
| **FairUseBanner** | `fair-use-banner.tsx` | Left-accent warning strip | **Unused** in features |
| **Field** | `field.tsx` | Label + hint + error wrapper | **Unused** in features |
| **FilterChip** | `filter-chip.tsx` | Toggle/removable query token chip | Issues (`filter-row`), Design Lab |
| **Input** | `input.tsx` | Mono text field | Issues, Settings, Design Lab |
| **IssueRow** | `issue-row.tsx` | 36px list row; unread signal bar; selected ring | Issues (`issue-list`) |
| **Kbd** | `kbd.tsx` | Keyboard hint pill | Issues detail header, TopStrip, Design Lab |
| **PageHeader** | `page-header.tsx` | Title + description + optional actions | Settings, Releases, Alerts, Design Lab |
| **Select** | `select.tsx` | Radix select (env, project) | Shell (`top-strip`) |
| **Skeleton** | `skeleton.tsx` | Pulse placeholder; `IssueRowSkeleton` variant | Issues, Releases, Alerts, Design Lab |
| **Toast** | `toast.tsx` | Graphite status toast | Issues, Settings |
| **Tooltip** | `tooltip.tsx` | Radix tooltip provider | Shell (`app-shell`) |

**Export surface:** `ui/index.ts` — 18 named exports + Command/Dialog/Dropdown/Select subcomponents.

**Kit gaps vs design contract:** No Tabs, Sheet/Drawer, CopyButton, Progress/Stepper, DataList, SettingsNav, or DSN slab (`COMPONENTS.md` describes “Input + DSN” recipe — not implemented as a primitive).

---

## Shell layer (`shell/`)

| Module | Role | Status vs v2 |
|--------|------|--------------|
| **AppShell** | Rail + TopStrip + Routes + CommandPalette | ✅ One shell; no separate focus layout |
| **Rail** | Primary nav (Issues · Releases · Alerts · Settings) | ✅ Matches charter IA |
| **TopStrip** | Env select, project (hidden when single), ⌘K search, user menu | ✅ Env not duplicated in filters; project switcher gated |
| **CommandPalette** | Navigate + “Search issues” action | ✅ Progressive disclosure for power |
| **AppContext** | Env/project persistence; `buildQuery()` injects `env:` | ✅ Filter rule #1 satisfied |
| **AuthGuard** | Session gate → `/login` | ✅ Out of dashboard scope |

**Shell gaps:** No setup-route detection; no first-run redirect; no stat fetching hook at shell level (could stay feature-local).

---

## Feature-local components (not in `ui/`)

### `features/issues/`

| Component | Role | v2 target mapping | Gap |
|-----------|------|-------------------|-----|
| **FilterRow** | Preset chips + always-visible query `Input` | Should become **FilterPanel** trigger + chips summary | Query bar is hero — fails J2 |
| **QueryBar** | Thin Input wrapper | Absorbed into FilterPanel advanced mode | Duplicate of FilterRow input |
| **IssueList** | Keyboard triage (`j/k/e/i/x/`) + scroll | Keep; pair with StatBar | ✅ Power path intact |
| **EventDetailPanel** | Occurrences, diff picker, stack, breadcrumbs — **one scroll** | Split into **IssueDetailTabs** children | Fails J3 (advanced visible before tabs) |
| **DiffPanel** | Occurrence/release JSON diff | Move to **More** tab | Visible by default today |
| **MergeActions** | Merge/split bar in list column | Keep in list column or **More** on bulk | OK for P3 |
| **BulkActions** | Resolve/ignore/delete bar | Keep; progressive (only when `x`) | ✅ |
| **SnoozeMenu** | Custom absolute popover | Refactor to **DropdownMenu** | Ad-hoc popover |
| **query-utils** | Token parse/toggle/chips | Shared by FilterPanel | ✅ Reuse |

### `features/settings/`

| Component | Role | v2 target mapping | Gap |
|-----------|------|-------------------|-----|
| **SettingsPage** | Inline secondary nav + nested routes | Extract **SettingsNav** | Nav logic not reusable |
| **ProjectsSettings** | CRUD + native `<select>` for project/retention | Setup step 1 + settings | No Field wrapper; native select |
| **DsnKeysSettings** | Key list + raw `<pre>` for DSN | **CopyDsnBlock** in setup | Fails J1 — DSN not copy-first |
| **WebhooksSettings** | Create form + list | Settings depth | Native `<select>` for format |
| **TeamSettings** | Members + invites | Settings depth | Native `<select>` for role |

### Other features

| Page | Primitives used | Gap |
|------|-----------------|-----|
| **Releases** | PageHeader, Empty, Skeleton, inline list | No **ReleaseRow** primitive; empty hints README-style CLI |
| **Alerts** | PageHeader, Empty, Skeleton, Badge, inline list | No **AlertRow**; no link to issue |
| **Design Lab** | Previews subset of kit | Missing previews for proposed P0 components |
| **Auth/login** | (not in scope) | — |

---

## Current vs target — Issues home

```
TODAY                          TARGET (charter v2)
─────────────────────────────  ─────────────────────────────
FilterRow (chips + query hero) SetupChecklist (first-run) OR banner
IssueList                      StatBar (3 headline numbers)
(master-detail split)          IssueList (default: unresolved)
                               [ Filter ] → FilterPanel
```

| Journey | Current blocker |
|---------|-----------------|
| **J1** | Empty state says “paste DSN” but no copy block, no steps, no verification |
| **J2** | Query placeholder `is:unresolved level:error …` dominates; preset chips use token syntax |
| **J3** | Detail header shows keyboard hints + Export + Snooze + Diff inline |
| **J4** | Power features exist but will break if removed — must relocate, not delete |
| **J5** | Native `<select>` in DiffPanel violates DASHBOARD.md content rule |

---

## Current vs target — Issue detail

```
TODAY (single scroll)              TARGET (tabs)
──────────────────────────────     ──────────────────────────
Header: title + all actions        Header: title + Resolve / Ignore
Permanent Kbd hint row             (hints on demand only)
EventDetailPanel:                  IssueDetailTabs:
  - Occurrence buttons               Overview · Stack · Breadcrumbs · More
  - Diff-with buttons                Overview: status, env, last seen, message
  - Stack trace                      Stack: CodeBlock + OccurrencePicker
  - Breadcrumbs + regex              Breadcrumbs: timeline + filter
DiffPanel (always mounted)           More: Diff, merge context, export, snooze
```

---

## Proposed new `ui/` components

### P0 — blocks publish gates J1–J3

| Component | Purpose | Maps to screen(s) | Replaces / extracts |
|-----------|---------|-------------------|---------------------|
| **SetupChecklist** | Horizontal or card stepper: ① Project ② Copy DSN ③ Send test ④ First issue ✓ | Issues home (first-run overlay/banner); optional `/setup` route | Empty state copy-only message |
| **CopyDsnBlock** | Mono DSN slab + one-click copy + “copied” feedback; optional secret reveal | SetupChecklist step 2; `settings/dsn-keys` | Raw `<pre>` in DsnKeysSettings |
| **StatBar** | Three plain-language metrics: Unresolved · Events (7d) · Regressions | Issues home above list | Nothing (new) |
| **FilterPanel** | `[ Filter ]` button → Sheet/Dialog: plain toggles + optional query syntax field | Issues home | FilterRow as default chrome |
| **IssueDetailTabs** | Radix Tabs: Overview · Stack · Breadcrumbs · More | Issues detail right pane | Ad-hoc sections in EventDetailPanel |
| **IssueOverviewPanel** | Title, status badge, last seen, env, release, user, primary actions | Issues detail → Overview tab | Top of EventDetailPanel + header actions |

### P1 — polish, J4 preservation, settings consistency

| Component | Purpose | Maps to screen(s) | Notes |
|-----------|---------|-------------------|-------|
| **SdkSnippetBlock** | Copy-ready init snippet with DSN placeholder | SetupChecklist step 3 | Plausible snippet pattern |
| **OccurrencePicker** | Compact occurrence switcher (not full button row) | Stack / Breadcrumbs tabs | Extract from EventDetailPanel |
| **BreadcrumbTimeline** | Filter chips (All/HTTP/Console/Errors) + scroll list | Breadcrumbs tab | Extract from EventDetailPanel |
| **StackTracePanel** | CodeBlock wrapper + empty state | Stack tab | Extract from EventDetailPanel |
| **SettingsNav** | Vertical section nav (Projects · DSN · Webhooks · Team) | `features/settings/index` | Inline nav today |
| **KeyboardHintsFooter** | Collapsible or `?`-triggered hint row | Issues detail footer | Permanent header hints today |
| **VerificationBadge** | Step complete checkmark / “waiting for event…” pulse | SetupChecklist step 4 | New |

### P2 — list primitives + depth consolidation

| Component | Purpose | Maps to screen(s) | Notes |
|-----------|---------|-------------------|-------|
| **AlertRow** | Alert list row with kind badge + link to issue | Alerts | Inline `<li>` today |
| **ReleaseRow** | Release version + artifact meta | Releases | Inline `<li>` today |
| **DataList** | Bordered divided list shell (settings tables, releases, alerts) | Settings, Releases, Alerts | Repeated `ul` pattern |
| **MorePanel** | Hosts DiffPanel, merge info, export, snooze | Issues detail → More tab | Relocate DiffPanel + SnoozeMenu |

### Supporting primitives (library-fit dependency)

| Primitive | Needed by | Status |
|-----------|-----------|--------|
| **Tabs** | IssueDetailTabs, Settings (optional) | Missing |
| **Sheet** or **Dialog** (wide) | FilterPanel | Dialog exists; Sheet preferred for filter |
| **CopyButton** | CopyDsnBlock, SdkSnippetBlock, export | Missing (icon button + toast) |
| **Progress** / **StepIndicator** | SetupChecklist | Missing |

---

## Screen → component map (target state)

| Screen / route | Layout | Primary components |
|----------------|--------|-------------------|
| **Issues `/`** | Master-detail | SetupChecklist (conditional) · StatBar · FilterPanel + chip summary · IssueList · IssueRow |
| **Issue detail** (right pane) | Tabbed | IssueDetailTabs → IssueOverviewPanel · StackTracePanel · BreadcrumbTimeline · MorePanel |
| **Issues list chrome** | Left column footer | BulkActions · MergeActions (unchanged; P3) |
| **Setup `/setup`** (optional) | Full-width wizard | SetupChecklist · CopyDsnBlock · SdkSnippetBlock · VerificationBadge |
| **Settings `/settings/*`** | Secondary nav + content | SettingsNav · PageHeader · Field · Input · Select · CopyDsnBlock (dsn tab) · DataList |
| **Releases `/releases`** | Table home | PageHeader · ReleaseRow · DataList · Empty |
| **Alerts `/alerts`** | Table home | PageHeader · AlertRow · DataList · Empty · Badge |
| **Shell** (all routes) | Chrome | Rail · TopStrip · CommandPalette · TooltipProvider |
| **Design Lab `/__design`** | Catalog | All ui/ primitives including new P0 previews |

---

## Refactor plan (feature → ui/)

| Current location | Action |
|------------------|--------|
| `features/issues/filter-row.tsx` | Rename/split → `FilterPanel` (ui) + thin `IssuesFilterBar` (feature) |
| `features/issues/event-detail.tsx` | Decompose → tab panels in ui/; feature wires data |
| `features/issues/diff-panel.tsx` | Move under More tab; keep feature logic |
| `features/issues/snooze-menu.tsx` | Reimplement with DropdownMenu |
| `features/settings/dsn-keys.tsx` | Replace `<pre>` block with CopyDsnBlock |
| `features/settings/*.tsx` | Adopt Field + Select; remove native `<select>` |
| `features/settings/index.tsx` | Extract SettingsNav to ui/ |

---

## Anti-patterns observed in current code

| Anti-pattern | Where | Charter / DASHBOARD violation |
|--------------|-------|-------------------------------|
| Query syntax as hero | `FilterRow` placeholder + preset chips tied to tokens | J2; “plain labels” thesis |
| Permanent keyboard cheat sheet | Issues detail header | Refuse: “permanent keyboard cheat sheet in header” |
| Advanced panels before tabs | DiffPanel + diff picker visible on load | J3 |
| README archaeology for DSN | Empty state text only; DSN in Settings | J1 |
| Native `<select>` in content | DiffPanel, Projects, Webhooks, Team | DASHBOARD.md content rule |
| Ad-hoc popover | SnoozeMenu | Inconsistent with DropdownMenu kit |
| Unused kit pieces | FairUseBanner, Field not used in settings forms | Missed convergence (J5) |

---

## Principles

1. **Home tells one story** — StatBar + unresolved list; no query training on first paint.
2. **Setup is a product surface** — SetupChecklist + CopyDsnBlock complete in-app; Settings is maintenance, not onboarding.
3. **Plain labels, tokens behind a door** — FilterPanel exposes “Unresolved / Error / Release” first; `is:unresolved` in advanced/query mode only.
4. **Tabs gate depth** — Overview answers “what broke?” in one screen; Stack/Breadcrumbs/More require intentional navigation (J3).
5. **One shell, progressive power** — Shell unchanged; ⌘K, `j/k`, merge, export move to Filter / More / palette — never deleted (J4).
6. **Primitives before screens** — New control lands in `ui/` + Design Lab + COMPONENTS.md before feature reskin.
7. **Token law** — No hex in JSX; no native selects in content; accent < 10% on issue list.

---

## Anti-patterns (refuse for 002)

- Query bar as Issues hero or default empty-state focus
- Chart/dashboard home (GA4-style)
- Pixel-level Sentry clone or GlitchTip fork
- Mascot empty states or confetti first-run
- Stock shadcn zinc theme or purple gradients
- Permanent shortcut strip in detail header
- Duplicating env filter in page filters (already correct in TopStrip)
- Building setup only in README or Settings tab without checklist verification

---

## Candidate patterns for Epure

Priority aligns with publish gates (J1 → J5) and charter steal/refuse list.

| Priority | Component / pattern | Rationale |
|----------|---------------------|-----------|
| **P0** | **SetupChecklist** | J1 — first issue without README |
| **P0** | **CopyDsnBlock** | J1 — Plausible copy-paste ritual |
| **P0** | **StatBar** | J2 — five-second scan (“how many open”) |
| **P0** | **FilterPanel** | J2 + J4 — hide query syntax; preserve power |
| **P0** | **IssueDetailTabs** | J3 — one-screen triage on Overview |
| **P0** | **IssueOverviewPanel** | J3 — Resolve/Ignore above fold |
| **P1** | **SdkSnippetBlock** | J1 step 3 — optional test error helper |
| **P1** | **StackTracePanel** | J3 — Stack tab; Sentry borrow |
| **P1** | **BreadcrumbTimeline** | J3 — Breadcrumbs tab |
| **P1** | **KeyboardHintsFooter** | J4 — hints on demand, not header |
| **P1** | **SettingsNav** + **Field** adoption | J5 — settings convergence; kill native selects |
| **P1** | **Tabs** + **Sheet** primitives | Dependencies for FilterPanel + detail tabs |
| **P1** | **CopyButton** | Shared by DSN, snippet, export affordances |
| **P2** | **MorePanel** (Diff + export + snooze) | J4 — power without Overview clutter |
| **P2** | **AlertRow** · **ReleaseRow** · **DataList** | Home-adjacent lists; QA consistency |
| **P2** | **VerificationBadge** | Setup step 4 — “first issue seen” closure |
| **P2** | **FairUseBanner** wiring | Billing/ingest cap notice when backend signals |

**Suggested build order:** Tabs + Sheet + CopyButton → SetupChecklist + CopyDsnBlock → StatBar → FilterPanel → IssueDetailTabs (+ panel extractions) → SettingsNav/Field pass → Design Lab update → J1–J5 proofs.

---

## References

- [002 charter](../charter.md) — IA target, steal/refuse, journeys
- [002 journeys](../journeys.md) — J1–J5 acceptance
- [design/DASHBOARD.md](../../../../design/DASHBOARD.md) — filter rules, density, keyboard (update when spec ratified)
- [design/COMPONENTS.md](../../../../design/COMPONENTS.md) — DSN slab recipe (not yet in ui/)
- [web/design/components.md](../../../web/design/components.md) — local recipes
- Source: `web/src/ui/`, `web/src/shell/`, `web/src/features/issues/`, `web/src/features/settings/`
