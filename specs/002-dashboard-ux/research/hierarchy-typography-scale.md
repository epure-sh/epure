# Hierarchy through typography and size

**Status:** Research complete (2026-09-13)  
**Scope:** Typography and size only — how users distinguish main sections, secondary meta, and actions  
**Pain:** Can't tell page title from tab from section heading from metadata; everything reads at `text-sm` / `text-xs`  
**Inputs:** `web/design/tokens.css` · `web/tailwind.config.ts` · `web/design/tailwind.theme.cjs` · `web/src/app.css` · audited `web/src/ui/*` · `web/src/features/issues/` · `web/src/shell/`  
**Constraint:** Research only — no implementation in this dossier

---

## Executive summary

Epure has a **well-defined token scale** (`2xs` → `5xl`) and a compact dashboard intent, but the **runtime app compresses almost all UI into two sizes**: `text-xs` (147 usages) and `text-sm` (128 usages). Larger steps (`lg`–`3xl`) appear fewer than 15 times combined. Weight differentiation is limited to `font-medium` on interactive controls and row titles — section headings often share the same size *and* weight as body copy.

The root cause of the user pain is **role collapse**, not missing tokens:

| Intended role | What users see today |
|---------------|---------------------|
| Page title | `text-2xl` *or* `text-lg` depending on which header component mounted |
| List context title | `text-sm font-medium` — **same as row title** |
| Detail issue title | `text-lg font-medium` — **same size as PageChrome h1** |
| Tab label | `text-sm font-medium` — **same as section heading** |
| Section heading (h3) | `text-sm` sans *or* mono, medium optional |
| Body / values | `text-sm` regular |
| Meta / timestamps | `text-xs text-ink-muted` |
| Actions | `text-xs` toolbar buttons — correctly smaller |

**Polish thesis:** Reserve **two size jumps** for hierarchy (page → section → meta). Use **weight and face (sans vs mono)** only where size alone can't separate roles. Actions are already differentiated by size; sections and titles are not.

---

## 1. Current type scale audit

### Token layer (canonical)

From `web/design/tokens.css` + `web/tailwind.config.ts`:

| Token | Size | Leading | Tailwind class |
|-------|------|---------|----------------|
| `2xs` | 0.6875rem (11px) | 0.875rem | `text-2xs` |
| `xs` | 0.75rem (12px) | 1rem | `text-xs` |
| `sm` | 0.8125rem (13px) | 1.25rem | `text-sm` |
| `md` | 0.875rem (14px) | 1.375rem | `text-md` |
| `lg` | 1rem (16px) | 1.5rem | `text-lg` |
| `xl` | 1.125rem (18px) | 1.75rem | `text-xl` |
| `2xl` | 1.5rem (24px) | 2rem | `text-2xl` |
| `3xl` | 2rem (32px) | 2.375rem | `text-3xl` |
| `4xl` | 2.75rem (44px) | 3rem | `text-4xl` |
| `5xl` | 3.5rem (56px) | 3.75rem | `text-5xl` |

**Body default** (`web/src/app.css`): `font-size: var(--text-md)` + `line-height: var(--leading-md)` + `font-weight: 400`. Most components override downward to `text-sm` or `text-xs`, so inherited body size is rarely visible.

**Note:** `web/design/tokens.json` documents `xl` as 1.25rem and recommends weight 600 for `lg`+, while runtime CSS uses 1.125rem and only weights 400/500. Align JSON ↔ CSS before implementing roles.

### Usage distribution (`web/src/**/*.tsx`)

| Class | Count | % of typed text | Primary surfaces |
|-------|------:|----------------:|------------------|
| `text-xs` | 147 | 50% | Meta, timestamps, toolbar buttons, badges, filter chips, dl labels, hints |
| `text-sm` | 128 | 44% | Row titles, tabs, section labels, form controls, body copy, banners |
| `text-lg` | 4 | 1% | `PageChrome` h1, `IssueOverviewPanel` h2, `DialogTitle`, design-lab |
| `text-2xl` | 5 | 2% | `PageHeader` h1, login, billing prices |
| `text-base` | 3 | 1% | `CardTitle` default |
| `text-xl` | 1 | <1% | StatBar compact values only |
| `text-3xl` | 1 | <1% | StatBar full values only |
| `text-2xs` | 2 | <1% | Rail section labels, rail badges |
| `text-md` | 0 | 0% | Never used as Tailwind class (body only) |
| `text-4xl` / `text-5xl` | 0 | 0% | Defined but unused |

**Finding:** The scale is **designed for 10 steps** but **operates as a 2-step UI** (xs/sm) with rare spikes for page headers and stat counts.

### Ad-hoc escapes (outside scale)

| Location | Class | Should be |
|----------|-------|-----------|
| `web/src/shell/top-strip.tsx` | `text-[9px]` prod badge | `text-2xs` |
| `web/src/shell/top-strip.tsx` | `text-[10px]` avatar, Kbd | `text-2xs` |

---

## 2. Section title hierarchy

### Two page header primitives (P0 conflict)

| Component | File | Title | Description | Used by |
|-----------|------|-------|-------------|---------|
| `PageHeader` | `web/src/ui/page-header.tsx` | `text-2xl font-medium tracking-ui` | `text-sm text-ink-muted` | Org home, settings, setup, billing, usage, team, design-lab |
| `PageChrome` | `web/src/ui/page-chrome.tsx` | `text-lg font-medium tracking-ui` | `text-xs text-ink-muted` | Releases, Alerts |

Same semantic role (page h1), **33% size difference**, inverted description sizing (sm vs xs). Users switching between Issues → Releases → Settings perceive inconsistent "main title" weight.

### Issues triage — no page title tier

`web/src/features/issues/index.tsx` uses a custom chrome band, not `PageHeader` or `PageChrome`:

```
IssuesListHeader  →  text-sm font-medium   ("Unresolved")
                 →  text-xs text-ink-muted (count subtitle)
StatBar compact   →  text-xs label / text-xl value
FilterPanel       →  toolbar controls
Tabs (detail)     →  text-sm font-medium
IssueOverview h2  →  text-lg font-medium
```

The list context title (`IssuesListHeader`) is **the same size and weight as each `IssueRow` title** (`text-sm font-medium`). The detail issue title (`text-lg`) is only one step above row titles but shares size with `PageChrome` page titles on other routes.

### Tab vs section heading collision

| Element | Size | Weight | Face | File |
|---------|------|--------|------|------|
| `TabsTrigger` | `text-sm` | `font-medium` | sans | `web/src/ui/tabs.tsx` |
| `IssuesListHeader` title | `text-sm` | `font-medium` | sans | `web/src/features/issues/issues-list-header.tsx` |
| `IssueRow` title | `text-sm` | `font-medium` | sans | `web/src/ui/issue-row.tsx` |
| Section "Stack trace" | `text-sm` | `font-medium` | sans | `web/src/ui/stack-trace-panel.tsx` |
| Section "Recent occurrences" | `text-sm` | `font-medium` | sans | `web/src/ui/issue-recent-occurrences.tsx` |
| Section "Compare" (More tab) | `text-sm` | **regular** | sans | `web/src/ui/issue-more-panel.tsx` |
| Settings h3 "Members" | `text-sm` | **regular** | mono | `web/src/features/settings/team.tsx` |
| Design Lab h2 | `text-sm` | `font-medium` | mono | `web/src/features/design-lab/index.tsx` |

**Four different section-title recipes**, all at `text-sm`. Tabs are indistinguishable from in-panel section headers by typography alone (only position + underline differentiate tabs).

### Meta tier (works better)

Meta consistently uses `text-xs text-ink-muted`:

- Row `lastSeen`, row `meta` — `web/src/ui/issue-row.tsx`
- dl `<dt>` labels — `web/src/ui/issue-overview-panel.tsx`
- Timeline labels — `web/src/ui/issue-occurrence-timeline.tsx`
- Chrome crumbs — `web/src/shell/navbar-crumb.tsx` (`text-xs`)
- Context strip hints — `web/src/ui/issues-context-strip.tsx`

**Meta is the only role with consistent size + color treatment.**

### Heading element misuse

| Element | Actual styling | Semantic issue |
|---------|----------------|----------------|
| `h1` in `PageHeader` | `text-2xl` | Correct |
| `h1` in `PageChrome` | `text-lg` | Under-scaled vs other h1s |
| `h2` in `IssueOverviewPanel` | `text-lg` | Competes with page h1 on other routes |
| `h2` in `org/home` project cards | `text-sm font-medium` | Card title, not page section |
| `h3` in settings | `font-mono text-sm` | No weight, no spacing contract |
| `IssuesListHeader` title | `<p>` not heading | No document outline |

---

## 3. Stat bar vs list row vs detail — size relationships

### Intended density ladder

```
STAT VALUE (xl–3xl, mono, medium)     ← loudest data
    ↓
PAGE TITLE (2xl, sans, medium)        ← route context
    ↓
DETAIL TITLE (xl–lg, sans, medium)    ← selected entity
    ↓
SECTION TITLE (sm, mono, medium)      ← panel zones
    ↓
ROW TITLE / TAB (sm, sans, medium)    ← scannable list + nav
    ↓
BODY / VALUES (sm–md, sans/mono, regular)
    ↓
META / LABELS (xs, sans, regular, muted)
    ↓
ACTIONS (xs, sans, medium)            ← toolbar buttons
    ↓
MICRO (2xs, mono, uppercase)          ← rail section labels
```

### Shipped relationships

| Surface | Primary | Secondary | Tertiary | Ratio primary:meta |
|---------|---------|-----------|----------|-------------------|
| **StatBar full** | value `text-3xl` mono | label `text-sm` | — | **4.0×** (32px:12px effective) |
| **StatBar compact** (issues header) | value `text-xl` mono | label `text-xs` | — | **2.4×** (18px:12px) |
| **IssueRow** | title `text-sm` | meta `text-xs` | lastSeen `text-xs` | **1.08×** (13px:12px) |
| **IssuesListHeader** | title `text-sm` | subtitle `text-xs` | — | **1.08×** — same as row |
| **IssueOverview** | h2 `text-lg` | badges `text-xs` | impact strip `text-sm` muted | **1.33×** title:meta |
| **IssueOverview dl** | dd `text-sm` | dt `text-xs` muted | — | **1.08×** |
| **TabsTrigger** | `text-sm` active | `text-sm` inactive muted | — | **1.0×** (color only) |
| **Toolbar actions** | `text-xs` buttons | — | — | Correctly below body |

**Critical gap:** Row title ↔ meta is only **1px / ~8% size difference**. Users rely entirely on `text-ink` vs `text-ink-muted` for row scanning. List header ↔ row title has **zero** size differentiation.

**Stat bar compact vs row:** Stat values at `text-xl` correctly dominate the issues chrome band, but the "Unresolved" list title beside them stays `text-sm` — visually subordinate to stat numbers but structurally a peer heading.

---

## 4. Proposed type roles

Semantic roles with token names. Implement as Tailwind `@utility` aliases or a `typeRoles` export in `web/src/ui/typography.tsx` (future — not in scope here).

| Role | Token size | Token leading | Face | Weight | Color | Tailwind shorthand (proposed) |
|------|------------|---------------|------|--------|-------|-------------------------------|
| **display** | `--text-2xl` | `--leading-2xl` | `--font-display` | `--font-weight-medium` | `--text` | `text-2xl leading-2xl font-medium tracking-ui text-ink` |
| **title** | `--text-lg` | `--leading-lg` | `--font-sans` | `--font-weight-medium` | `--text` | `text-lg leading-lg font-medium tracking-ui text-ink` |
| **title-compact** | `--text-md` | `--leading-md` | `--font-sans` | `--font-weight-medium` | `--text` | `text-md font-medium tracking-ui text-ink` |
| **section** | `--text-sm` | `--leading-sm` | `--font-mono` | `--font-weight-medium` | `--text` | `text-sm leading-sm font-mono font-medium text-ink` |
| **body** | `--text-md` | `--leading-md` | `--font-sans` | `--font-weight-regular` | `--text` | *(inherit from body — avoid `text-sm` on prose)* |
| **body-compact** | `--text-sm` | `--leading-sm` | `--font-sans` | `--font-weight-regular` | `--text` | `text-sm leading-sm text-ink` |
| **meta** | `--text-xs` | `--leading-xs` | `--font-sans` | `--font-weight-regular` | `--text-muted` | `text-xs leading-xs text-ink-muted` |
| **mono-data** | `--text-sm` | `--leading-sm` | `--font-mono` | `--font-weight-regular` | `--text` | `text-sm leading-sm font-mono text-ink` |
| **mono-data-xs** | `--text-xs` | `--leading-xs` | `--font-mono` | `--font-weight-regular` | `--text` / muted | `text-xs font-mono text-ink` |
| **count** | `--text-3xl` | `--leading-3xl` | `--font-mono` | `--font-weight-medium` | `--text` | `text-3xl font-mono-slash font-medium tracking-tight` |
| **count-compact** | `--text-xl` | `--leading-xl` | `--font-mono` | `--font-weight-medium` | `--text` | `text-xl font-mono-slash font-medium leading-tight` |
| **action** | `--text-xs` | `--leading-xs` | `--font-sans` | `--font-weight-medium` | varies | *(Button `size="toolbar"` — already correct)* |
| **micro** | `--text-2xs` | `--leading-2xs` | `--font-mono` | `--font-weight-medium` | `--text-muted` | `text-2xs font-mono uppercase tracking-wide text-ink-muted` |

### Role assignment map (target state)

| UI element | Current | Target role |
|------------|---------|-------------|
| `PageHeader` h1 | `text-2xl` | **display** |
| `PageChrome` h1 | `text-lg` | **display** (unify — not title-compact) |
| `IssuesListHeader` title | `text-sm font-medium` | **title-compact** (`text-md`) |
| `IssueRow` title | `text-sm font-medium` | **body-compact** + `font-medium` (drop to regular weight option for dense lists) |
| `IssueOverviewPanel` h2 | `text-lg` | **title** (bump to `text-xl` if page chrome stays compact) |
| `TabsTrigger` | `text-sm font-medium` | **body-compact** regular inactive / medium active only |
| Panel section headings | mixed | **section** (mono sm medium — one recipe) |
| dl labels | `text-xs text-ink-muted` | **meta** |
| dl values (env, release) | `text-sm font-mono` | **mono-data** |
| StatBar values | `text-3xl` / `text-xl` | **count** / **count-compact** |
| Rail `sectionLabel` | `text-2xs` | **micro** |
| Toolbar buttons | `text-xs` | **action** (no change) |

### Page chrome contract (proposed)

| Tier | Scope | Role | Example |
|------|-------|------|---------|
| L0 | Workspace routes | **display** `2xl` | Settings, Org home |
| L1 | Project list routes | **display** `2xl` *or* **title-compact** `md` when inline stats | Issues (with StatBar), Releases |
| L2 | Detail entity | **title** `lg`–`xl` | Issue title in overview |
| L3 | Panel zone | **section** `sm` mono | Stack trace, Compare |
| L4 | Row / control | **body-compact** `sm` | Issue row, tabs |
| L5 | Meta | **meta** `xs` | last seen, field labels |

---

## 5. Weight contrast — where underused

### Available weights

`web/design/tailwind.theme.cjs` exposes only `font-normal` (400) and `font-medium` (500). No semibold/bold in theme — correct for IBM Plex dashboard restraint.

### Current `font-medium` usage (~45 occurrences)

Concentrated on: buttons, tabs, labels, row titles, stat values, a few section headers. **Medium is doing triple duty** — interactive affordance, primary content emphasis, and heading weight.

### Underused patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Section headings without medium | `issue-more-panel.tsx` sections use regular weight at `text-sm` — read as body | Apply **section** role (`font-medium` + mono) |
| Settings h3 without medium | `team.tsx` h3 `font-mono text-sm` only | Add `font-medium` |
| Body copy at medium | `IssueRow` title, list header — medium on everything | Reserve medium for **one emphasis level** per viewport zone |
| Regular weight never explicit on headings | Headings inherit medium inconsistently | Section = medium; body = regular; meta = regular muted |
| `CardTitle` `leading-none` | `web/src/ui/card.tsx` — tight leading fights readable hierarchy | Use `leading-sm` with **title-compact** |

### Recommended weight rules

1. **display / title / section** → always `font-medium`
2. **body / meta** → always `font-normal` (400)
3. **row primary line** → `font-medium` *or* size bump to `text-md` with `font-normal` (pick one, not both)
4. **tabs inactive** → `font-normal`; **tabs active** → `font-medium`
5. **actions** → `font-medium` at `text-xs` (current Button toolbar — keep)

---

## 6. Line height and spacing rhythm

### Line height

| Source | Leading | Notes |
|--------|---------|-------|
| Token pairs via `fontSize` in `tailwind.config.ts` | `leading-xs` … `leading-5xl` | Correct default for each text step |
| `body` | `--leading-md` (1.375rem) | Good for prose; undermined by `text-sm` children |
| Overrides | `leading-tight` on StatBar compact values | Intentional — keep for counts |
| Overrides | `leading-none` on `CardTitle`, `Label` | Risks clipping on multi-line titles |
| Overrides | `leading-relaxed` on breadcrumb timeline | One-off; not in token scale |
| Missing | `tracking-ui` on section headings | Only on page titles and list header today |

### Vertical spacing rhythm (observed)

| Zone | Padding | Gap | File |
|------|---------|-----|------|
| `PageHeader` | `px-6 py-5` | `mt-1` description | `page-header.tsx` |
| `PageChrome` | `px-4 py-3 md:px-6` | `mt-0.5` description | `page-chrome.tsx` |
| Issues chrome band | `px-4 py-2 md:px-6` | `gap-x-4` | `features/issues/index.tsx` |
| Detail panel sections | `px-4 py-3` | `divide-y` | `issue-overview-panel.tsx`, `more-panel.tsx` |
| Issue row | `px-4 py-2` | `gap-0.5` title/meta | `issue-row.tsx` |
| StatBar full | `px-6 py-4` | `gap-8`, `mt-1` value | `stat-bar.tsx` |
| Tabs | `py-2.5` trigger | border-b-2 | `tabs.tsx` |

**Rhythm issues:**

1. **Three header paddings** (`py-5`, `py-3`, `py-2`) without a named chrome tier — spacing doesn't reinforce type hierarchy.
2. **Section title → content** often `space-y-2` (`more-panel.tsx`) or `mt-1` — no shared `section-gap` token.
3. **Detail h2 → badges** uses `mt-1.5` ad hoc; dl uses `mt-0.5` on dd — inconsistent label-to-value gap.

### Proposed spacing contract (pairs with type roles)

| Role transition | Spacing token | Value |
|-----------------|---------------|-------|
| display → meta description | `--space-1` | `mt-1` (4px) |
| display → context strip | `--space-0` | flush border |
| section → body | `--space-2` | `mt-2` (8px) |
| meta label → mono-data value | `--space-1` | `mt-1` |
| panel section vertical | `--space-3` | `py-3` (12px) — keep |
| row internal title → meta | `--space-1` | `gap-1` not `gap-0.5` — slightly more air |

---

## 7. Ranked fixes (P0–P2)

### P0 — stops role collapse (ship first)

| # | Fix | Files | Rationale |
|---|-----|-------|-----------|
| P0-1 | **Unify page title to `display` role** — `PageChrome` h1 `text-lg` → `text-2xl`; description stays `text-sm` | `web/src/ui/page-chrome.tsx`, consumers: `web/src/features/releases/index.tsx`, `web/src/features/alerts/index.tsx` | Same h1 semantics, 33% size jump today |
| P0-2 | **Bump list context title** — `IssuesListHeader` title `text-sm` → `text-md font-medium` | `web/src/features/issues/issues-list-header.tsx` | Separates "what list am I viewing" from row titles |
| P0-3 | **Single `SectionHeading` recipe** — `text-sm font-mono font-medium` + optional `tracking-wide` | New: `web/src/ui/section-heading.tsx`; apply in `web/src/ui/issue-more-panel.tsx`, `web/src/ui/stack-trace-panel.tsx`, `web/src/ui/issue-recent-occurrences.tsx`, `web/src/features/settings/team.tsx`, `web/src/features/settings/projects.tsx` | Ends 4 conflicting section styles |
| P0-4 | **Tabs inactive → regular weight** | `web/src/ui/tabs.tsx` — `font-medium` only on `data-[state=active]` | Separates tabs from section headings at same size |

### P1 — strengthens detail vs list

| # | Fix | Files | Rationale |
|---|-----|-------|-----------|
| P1-1 | **Issue detail title → `text-xl`** | `web/src/ui/issue-overview-panel.tsx` h2 | One clear step above section headings |
| P1-2 | **Row title → regular weight** (keep `text-sm`) *or* keep medium but ensure list header is `text-md` (P0-2) | `web/src/ui/issue-row.tsx`, `web/src/features/alerts/alert-row.tsx` | Weight budget: not everything medium |
| P1-3 | **`IssueRow` meta → `font-mono-slash text-xs`** per `web/design/components.md` | `web/src/ui/issue-row.tsx` | Meta reads as data; title reads as prose |
| P1-4 | **Demote `issue-more-panel` section labels** from `text-sm text-ink` to **section** role | `web/src/ui/issue-more-panel.tsx` | Currently weakest section style |
| P1-5 | **Align `tokens.json` xl/lg weights with `tokens.css`** | `web/design/tokens.json` | Prevents implement drift |
| P1-6 | **`PageChrome` description → `text-sm`** (from `text-xs`) when title goes to 2xl | `web/src/ui/page-chrome.tsx` | Match `PageHeader` description pairing |

### P2 — polish and guardrails

| # | Fix | Files | Rationale |
|---|-----|-------|-----------|
| P2-1 | **Replace `text-[9px]` / `text-[10px]`** with `text-2xs` | `web/src/shell/top-strip.tsx` | Scale compliance |
| P2-2 | **Export `typeRoles` map** or document in `web/design/components.md` | `web/design/components.md`, optional `web/src/ui/typography.ts` | Prevent re-collapse |
| P2-3 | **`CardTitle` → `text-md` + `leading-sm`** (not `text-base leading-none`) | `web/src/ui/card.tsx` | Card titles between section and display |
| P2-4 | **Normalize chrome band padding** — issues `py-2` → `py-3` when title bumps to md | `web/src/features/issues/index.tsx` | Spacing supports larger title |
| P2-5 | **`tracking-ui` on all display/title roles** | `page-chrome.tsx`, `issue-overview-panel.tsx` | Subtle sans heading cohesion |
| P2-6 | **Design Lab section blocks** — use shared `SectionHeading` | `web/src/features/design-lab/index.tsx` | Living styleguide |
| P2-7 | **Audit `leading-none`** on `Label` / `CardTitle` — switch to token leading | `web/src/ui/label.tsx`, `web/src/ui/card.tsx` | Multi-line safety |

---

## Appendix: file reference index

| Area | Key files |
|------|-----------|
| Tokens | `web/design/tokens.css`, `web/design/tokens.json`, `web/tailwind.config.ts`, `web/design/tailwind.theme.cjs` |
| Body defaults | `web/src/app.css` |
| Page chrome | `web/src/ui/page-header.tsx`, `web/src/ui/page-chrome.tsx` |
| Issues triage | `web/src/features/issues/index.tsx`, `web/src/features/issues/issues-list-header.tsx`, `web/src/ui/issue-row.tsx` |
| Issue detail | `web/src/ui/issue-detail-tabs.tsx`, `web/src/ui/issue-overview-panel.tsx`, `web/src/ui/stack-trace-panel.tsx`, `web/src/ui/issue-more-panel.tsx` |
| Stats | `web/src/ui/stat-bar.tsx` |
| Shell | `web/src/shell/top-strip.tsx`, `web/src/shell/navbar-crumb.tsx`, `web/src/shell/rail-nav.tsx` |
| Controls | `web/src/ui/button.tsx`, `web/src/ui/tabs.tsx`, `web/src/ui/badge.tsx`, `web/src/ui/label.tsx` |
| Recipes | `web/design/components.md` |
| Prior art | `specs/002-dashboard-ux/research/ui-polish-visual-system.md` §2 |

---

## Principles

1. **Two size jumps beat color alone** — `sm`→`xs` is not a hierarchy; `md`→`sm`→`xs` is.
2. **One heading recipe per level** — display, title, section, meta; no per-feature improvisation.
3. **Mono marks structure** — section headings and data; sans marks prose and navigation.
4. **Medium is scarce** — if everything is medium, nothing is emphasized.
5. **Actions stay small** — toolbar `text-xs` already works; don't shrink meta further to compensate.

## Anti-patterns

- Using `text-sm font-medium` for both page context and row primary line
- Section headings as plain `<p className="text-sm text-ink">` without mono or medium
- Two page header components with different title sizes for the same semantic level
- `text-[Npx]` outside the token scale
- Bumping weight instead of size when roles collide

## Candidate patterns for Epure

- **Plausible-style list header** — context title one step above row text (`text-md` vs `text-sm`)
- **Linear-style section labels** — mono uppercase micro for rail; mono sm medium for in-panel sections
- **Instrument counts** — stat values remain the loudest typographic element in the chrome band (keep `text-xl` compact / `text-3xl` full)
