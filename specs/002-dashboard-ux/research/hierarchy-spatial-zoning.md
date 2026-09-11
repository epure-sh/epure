# Visual hierarchy — structure & spatial zoning

**Status:** Research (2026-09-13) — no implementation  
**Inputs:** `web/src/features/issues/index.tsx` · `web/src/ui/issue-overview-panel.tsx` · `web/src/ui/issue-more-panel.tsx` · `web/src/ui/breadcrumb-timeline.tsx` · `web/src/shell/*` · [ui-polish-layout-structure.md](./ui-polish-layout-structure.md) · [issue-detail-ux-research.md](./issue-detail-ux-research.md) · `web/design/tokens.css`  
**Charter:** [charter.md](../charter.md) · [issue-surface-spec.md](./issue-surface-spec.md)  
**Companion:** [ui-polish-layout-structure.md](./ui-polish-layout-structure.md) covers **page chrome bands** (L-P1–L-P5). This doc covers **in-pane section zoning** (L-H1–L-H5).

---

## Executive summary

The flat-UI pain is not missing color — it is **missing structural contrast**. Every Issues surface uses the same `bg-surface` canvas, the same `divide-y divide-border` hairlines, and the same `px-4 py-3` padding band. Section labels vary in weight (`text-xs text-ink-muted` vs `text-sm font-medium text-ink` vs plain `text-sm`) without a shared primitive. The only elements that break the plane are **CodeBlock** (`bg-bg-subtle` + border), **breadcrumb list** (`bg-bg-subtle` + border), and **left-accent banners** (snooze/regression).

**Root cause:** separation relies exclusively on 1px dividers on a single surface level. Hairlines alone cannot carry hierarchy when typography scale is also compressed (compact dashboard tokens).

**Fix thesis:** Introduce a **three-tier surface ladder** (`bg` → `surface` → `bg-subtle` / `surface-raised`) plus a **`Section` / `SectionHeader` primitive** with consistent mono micro-labels. Reserve hairlines for *within* a section; use **padding bands** and **surface steps** between major zones.

---

## 1. Current zone map & visual weight assessment

### 1.1 Global shell (authenticated)

```
┌─ G0 Rail ─────────┬─ G0 TopStrip ─────────────────────────────────────────┐
│ bg-bg             │ bg-surface · border-b                                   │
│ border-r          │                                                         │
├───────────────────┼─────────────────────────────────────────────────────────┤
│ G1 Project nav    │ G2 Route outlet (main bg-bg)                            │
│                   │                                                         │
└───────────────────┴─────────────────────────────────────────────────────────┘
```

| Zone | Token / class | Weight | Blends with |
|------|---------------|--------|-------------|
| Rail | `bg-bg` | Low — recessive | Main canvas (both `bg`) |
| Top strip | `bg-surface` + `border-b` | Medium | Issues page header (also `bg-surface`) |
| Main | `bg-bg` | Low | Hidden under Issues children |

**Assessment:** Shell tiers work. The flatness begins **inside** the route outlet where list + detail + all Overview sections share `bg-surface`.

---

### 1.2 Issues page — vertical bands (page chrome)

```
G0  TopStrip                    [surface]  ─────────────────────────  weight: M
G1  SetupChecklist (conditional) [surface]  border-b                 weight: M
G2  Header: IssuesListHeader + StatBar + FilterPanel
                               [surface]  border-b                 weight: H (stats text-xl)
G3  IssuesContextStrip (conditional)
                               [bg-subtle/30] border-b            weight: M-L (accent on regression)
G4  Master-detail row
    G4a List column             [surface]  border-r @lg             weight: M
    G4b Detail column           [surface]  (no step from list)      weight: M
```

| What blends | Why |
|-------------|-----|
| G2 header ↔ G4 list | Same `bg-surface`, adjacent hairlines only |
| G3 context strip ↔ G2 | `bg-subtle/30` is ~indistinguishable from `surface` at a glance |
| G4a list ↔ G4b detail | **Same surface, same typography** — master-detail reads as one pane |

**Files:** `features/issues/index.tsx` lines 632–684 (header), 686–694 (context strip), 703–846 (master-detail).

---

### 1.3 Detail pane — chrome stack

```
D0  Toolbar (back + actions)     [surface]  border-b          weight: M
D1  TabsList                     [surface]  border-b          weight: M
D2  Tab content scroll area      [surface]  (inherits)        weight: L
D3  KeyboardHintsFooter          [surface]  border-t          weight: L
```

| What blends | Why |
|-------------|-----|
| D0 toolbar ↔ D1 tabs | Two consecutive `border-b` bands, same bg — reads as one thick chrome block |
| D1 tabs ↔ D2 content | Tab content has no top padding band; first Overview block starts flush under tab underline |
| Mobile title ×3 | Truncated title in D0 + h2 in Overview + impact strip text — three title-adjacent lines before stack |

**Files:** `ui/issue-detail-tabs.tsx` lines 82–116.

---

### 1.4 Overview tab — section map (primary pain)

`IssueOverviewPanel` uses a single `divide-y divide-border` column — **9 potential bands**, all on `bg-surface`:

| # | Section | Component | Padding | Label style | Surface step | Weight |
|---|---------|-----------|---------|-------------|--------------|--------|
| Z1 | Title + badges | inline | `px-4 py-3` | h2 `text-lg font-medium` | none | **H** |
| Z2 | Impact strip | `IssueImpactStrip` | `px-4 py-2` | none — muted inline text | none | **L** ← blends into Z1/Z3 |
| Z3 | Stack trace | `StackTracePanel` embedded | `border-t` + `px-4 py-3` | `text-sm font-medium` | CodeBlock → `bg-subtle` | **M–H** (code only) |
| Z4 | Context grid | `dl` | `px-4 py-3` | `dt text-xs muted` | none | **L** |
| Z5 | Timeline | `IssueOccurrenceTimeline` | `px-4 py-3` | `text-xs muted` "When it happened" | chart has accent stroke only | **L–M** |
| Z6 | Recent occurrences | `IssueRecentOccurrences` | `px-4 py-3` | `text-sm font-medium` | row hover `bg-subtle` | **M** |
| Z7 | Snooze banner | conditional | `px-4 py-2.5` | plain `text-sm` | `bg-subtle/40` + left accent | **M** |
| Z8 | Regression banner | conditional | same | plain `text-sm` | same | **M** |
| Z9 | Stored gap + tags | inline | `px-4 py-2/3` | `text-xs muted` / badges | none | **L** |

**What blends together (user-reported "flat"):**

1. **Z2 + Z4** — Impact strip and context `dl` are both muted `text-sm`/`text-xs` prose blocks separated by only a hairline; no container, no label.
2. **Z4 + Z5 + Z6** — Three consecutive `py-3` bands with similar label weights; timeline chart is 56px tall and easy to miss between metadata grid and occurrence list.
3. **Z1 + Z2** — Title block and impact strip feel like one paragraph; impact metrics don't read as a "stat row."
4. **Z3 header + Z4** — Stack section title (`font-medium`) immediately followed by env/release grid with no surface step between stack body and metadata.
5. **Z6 rows** — Selected row uses `bg-accent-muted/50`; unselected rows have no border — list floats in the same plane as timeline above.

**Contrast winners (keep):**

- `CodeBlock` — bordered `bg-bg-subtle` (Z3 body)
- Breadcrumb tab list — `rounded-sm border bg-bg-subtle` (`breadcrumb-timeline.tsx` line 314)
- Conditional banners — 3px left accent (`border-l-accent`, `border-l-semantic-danger`)

---

### 1.5 Breadcrumbs tab

| Zone | Treatment | Weight |
|------|-----------|--------|
| Occurrence picker | bare `p-4` | L |
| Filter bar | ghost/secondary buttons | M |
| Timeline list | **bordered `bg-bg-subtle` box** | **H** ← only strong container on tab |
| Drawer | `border-l` + header `border-b` | H |

Breadcrumbs tab is **more structured than Overview** because the timeline list is boxed. Overview should borrow this pattern.

---

### 1.6 More tab

`MorePanel` → `divide-y divide-border` with `[&>div]:px-4 [&>div]:py-3`:

| Section | Label | Weight |
|---------|-------|--------|
| Compare | `text-sm text-ink` (no mono, no uppercase) | L |
| Tags & runtime | same | L |
| Occurrences | same | L |
| Grouping | same | L |
| Merged issues | same | L |
| User feedback | same | L |

All six sections are **visually equivalent** — only hairlines separate them. Diff panel inside Compare may have internal structure, but the section envelope is flat.

---

## 2. Separation techniques (epure-appropriate)

Signal Room policy: **hairlines only, no shadows** (`tokens.css` `--shadow-sm: none`). Separation must come from structure, not elevation shadows.

### 2.1 Technique matrix

| Technique | Token / pattern | Best for | Avoid |
|-----------|-----------------|----------|-------|
| **Hairline divider** | `divide-y divide-border` or `border-b border-border` | Rows within a section (occurrence list items, stack frames) | Between major zones on same surface — reads flat |
| **Surface step** | `bg-surface` → child `bg-bg-subtle` or `bg-surface-raised` | Stack body, timeline chart area, impact strip | More than 2 steps nested (visual noise) |
| **Padding band** | `py-4` between major zones vs `py-2` within | Section breaks without lines | `py-6+` — violates compact charter |
| **Section label** | `SectionHeader`: mono `text-xs uppercase tracking-wide text-ink-muted` | Every scannable block (timeline, occurrences, stack) | `text-sm font-medium sans` — too close to body |
| **Left accent bar** | `border-l-[3px] border-l-accent` or `semantic-danger` | Alerts, snooze, regression — **one per viewport max** | Decorative accents on every section |
| **Bordered inset** | `rounded-sm border border-border bg-bg-subtle` | Timeline list (breadcrumbs), mini-chart container | Full-width cards on Overview (too heavy) |
| **Typography contrast** | mono + `font-mono-slash` for counts; sans for labels | Impact numbers, occurrence timestamps | Mixed scales without container |

### 2.2 Recommended surface ladder (in-pane)

```
Level 0  bg              app canvas (main, rail)
Level 1  surface          pane background (list column, detail scroll)
Level 2  bg-subtle       inset panels (code, chart well, boxed lists)
Level 3  surface-raised  sticky bars (bulk actions — already used)
```

**Rule:** A major Overview section should use **at least one** of: surface step, section label, or padding band jump. Hairline alone is insufficient.

### 2.3 Section label convention (align with Design Lab)

`design-lab/index.tsx` already defines an informal pattern:

```tsx
<h2 className="font-mono text-sm font-medium text-ink">{title}</h2>
```

For **in-pane sections** (not page titles), downgrade to micro-label per `ui-polish-visual-system.md`:

```
font-mono text-xs uppercase tracking-wide text-ink-muted
```

Page titles stay `text-lg`/`text-xl` sans. Section headers stay mono xs uppercase. Body stays sans sm.

---

## 3. Overview tab — making sections scannable

Target order per [issue-detail-ux-research.md §3](./issue-detail-ux-research.md) (Z1–Z7). Below: **structural** treatment per block.

### 3.1 Impact strip (Z2)

**Current:** One `text-sm text-ink-muted` line, dot-separated.  
**Problem:** Reads as subtitle overflow from title, not a metrics row.

**Proposed structure:**

```
┌─ SectionHeader: "IMPACT" (optional — may omit if counts are self-evident) ─┐
│  [48 occurrences]  ·  [12 users]  ·  last seen 2m ago  ·  first seen 4d ago   │
│   mono medium       mono medium     sans xs muted       sans xs muted        │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Container | `bg-bg-subtle/50` full-bleed inset OR `border-y border-border` without side padding change |
| Count values | `font-mono-slash text-sm font-medium text-ink` |
| Separators | `·` in `text-ink-muted` |
| Padding | `px-4 py-2.5` — **tighter than** context grid below (`py-3`) |

**Scannability:** P1 eye path = title → **bold counts** → actions. Strip must be the second-highest weight block after title.

---

### 3.2 Stack trace (Z3)

**Current:** `border-t` + `text-sm font-medium` label + bare `CodeBlock`.  
**Problem:** Header competes with section label pattern; stack floats between impact and metadata without a "well."

**Proposed structure:**

```
┌─ SectionHeader: "STACK TRACE" ─────────────── Grouped by file · fn → More ─┐
│  ┌─ inset well (bg-bg-subtle border rounded-sm) ─────────────────────────┐ │
│  │ CodeBlock frames…                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Section wrapper | `Section` with `padding="compact"` — no extra hairline above if impact strip has `border-b` |
| Well | CodeBlock already correct — wrap header + block in `space-y-2` |
| Occurrence picker | Inside section, below header — not floating between sections |

**Scannability:** Boxed well creates the **strongest** visual anchor on Overview (correct — stack is the fix target).

---

### 3.3 Context grid (Z4)

**Current:** Bare `dl` grid after stack hairline.  
**Proposed:** Fold under `SectionHeader: "CONTEXT"` or merge into impact strip on narrow viewports.

| Property | Value |
|----------|-------|
| Label | `CONTEXT` mono xs uppercase |
| Grid | Keep 2-col `dl`; values `font-mono text-sm` |
| Surface | Stay on `surface` (level 1) — metadata should not compete with stack well |

**Optional collapse:** On `<md`, show env + release inline in impact strip; move user to occurrences default row.

---

### 3.4 Timeline (Z5)

**Current:** `text-xs muted` label, 56px chart, summary line — all in open `px-4 py-3`.  
**Problem:** Chart height + muted label = easy to skip; blends with Z4 and Z6.

**Proposed structure:**

```
┌─ SectionHeader: "WHEN IT HAPPENED" ──────────── [7d] [14d] [30d] ─┐
│  ┌─ chart well (bg-bg-subtle border rounded-sm p-2) ──────────────┐ │
│  │ 56px sparkline                                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  3 in the last hour · 12 in the last 24 hours                       │
└──────────────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Chart container | Match breadcrumb list pattern (`rounded-sm border bg-bg-subtle`) |
| Window toggles | Right-aligned in `SectionHeader` actions slot |
| Summary | `text-xs text-ink-muted` below well — not above |
| Single-occurrence | Collapse well; show summary line only (per issue-detail-ux §4) |

**Scannability:** Box + header creates a **chart zone** distinct from occurrence list below.

---

### 3.5 Recent occurrences (Z6)

**Current:** `text-sm font-medium` title + flat button rows.  
**Proposed:**

```
┌─ SectionHeader: "RECENT OCCURRENCES" ───── showing last 12 of 48 ─┐
│  ┌─ optional inset (border-t first row only) or row dividers ────────┐ │
│  │ 2m ago   user@…   production   v1.4.2                            │ │
│  │ ─────────────────────────────────────────────────────────────────  │ │
│  │ 1h ago   …                                                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Rows | Keep `border-b border-border` per row OR inset box like breadcrumbs |
| Selected | `bg-accent-muted/50` — add `ring-1 ring-border` for clearer selection |
| Header meta | Stored gap count in `SectionHeader` description slot (right) |
| Spacing above | `pt-4` padding band jump from timeline (no hairline if chart well has border) |

**Scannability:** Occurrence list is the **interactive** zone — rows need row-level dividers, not just hover wash.

---

### 3.6 Conditional strips (Z7–Z9)

Keep left-accent banners — they already break the plane. Move **above** timeline when active (snooze/regression are action-relevant). Tags (`Z9`) belong in a `SectionHeader: "RUNTIME"` block or stay in More tab only.

---

### 3.7 Overview target wireframe

```
┌─ D0/D1 chrome (toolbar + tabs) ─────────────────────────────────────────┐
├─ Z1 Title + badges only (drop h2 duplicate on lg+ per L-P4) ────────────┤
├─ Z2 Impact strip [subtle band / mono counts] ───────────────────────────┤
├─ Z3 STACK TRACE [well] ─────────────────────────────────────────────────┤
│       ↑ surface step ─────────────────────────────────────────────────────│
├─ Z4 CONTEXT [dl] ───────────────────────────────────────────────────────┤
├─ Z5 WHEN IT HAPPENED [chart well] ──────────────────────────────────────┤
│       ↑ surface step ─────────────────────────────────────────────────────│
├─ Z6 RECENT OCCURRENCES [row dividers] ────────────────────────────────────┤
├─ Z7–Z8 Banners (conditional) ───────────────────────────────────────────┤
└─ Z9 Tags (optional / fold to More) ─────────────────────────────────────┘
```

---

## 4. Master-detail — list vs detail pane contrast

### 4.1 Current state

| Aspect | List column | Detail column |
|--------|-------------|---------------|
| Background | `bg-surface` | `bg-surface` |
| Separator | `border-r border-border` @lg | — |
| Selection | Row `bg-bg-subtle` when selected | — |
| Width | `w-issue-list` (30rem) | `flex-1` |
| Chrome | BulkActions `bg-surface-raised` sticky | Toolbar + tabs `bg-surface` |

**Problem:** At rest, list and detail are **the same color plane**. The border-r hairline is the only cue — insufficient on wide monitors and invisible when detail is full-screen `<lg`.

### 4.2 Proposed contrast model

| Aspect | List column | Detail column |
|--------|-------------|---------------|
| Background | **`bg-bg`** (recessed — "index") | **`bg-surface`** (elevated — "document") |
| Separator | `border-r border-border` | keep |
| Selected row | `bg-surface` on `bg-bg` canvas — row "lifts" | — |
| Hover row | `bg-bg-subtle` | — |
| Detail first section | — | optional `border-t-0`; content starts with padding band |

**Rationale:** Matches shell pattern (rail `bg-bg`, top strip `bg-surface`). List is navigation; detail is workspace. Plausible uses a similar recess for sidebar analytics nav.

### 4.3 List column internal structure

| Element | Treatment |
|---------|-----------|
| Issue rows | `border-b` row dividers (already) |
| Bulk bar | Keep `surface-raised` sticky — floats above list |
| No list header band | Per [ui-polish-layout-structure.md §4.1](./ui-polish-layout-structure.md) — metadata in page G1/G2 |

### 4.4 Detail column internal structure

| Element | Treatment |
|---------|-----------|
| Toolbar + tabs | `bg-surface` sticky stack — OK |
| Tab body | `bg-surface` with `Section` children |
| Scroll | Tab content only — toolbar/tabs pinned |

### 4.5 Mobile `<lg`

Detail goes full-screen `bg-surface` — list hidden. Contrast model pauses; back affordance (D0) provides context switch.

---

## 5. Proposed `Section` / `SectionHeader` primitive spec

Research-only API. Implement in `web/src/ui/section.tsx` when L-H2 ships.

### 5.1 `Section`

```tsx
interface SectionProps {
  children: React.ReactNode;
  /** Visual envelope */
  variant?: "plain" | "inset" | "band";
  /** Vertical spacing tier */
  density?: "compact" | "default";
  className?: string;
}

// variant="plain"   — padding only, no border (CONTEXT dl)
// variant="inset"   — rounded-sm border border-border bg-bg-subtle p-3 (chart, code well)
// variant="band"    — full-bleed bg-bg-subtle/50 py-2.5 px-4 (impact strip)
```

**Layout rules:**

1. `Section` never applies `divide-y` — parent `IssueOverviewPanel` stops using outer `divide-y`; each child is a `Section`.
2. Gap between sections: `density="default"` → `py-3` internal + `border-b border-border` **or** `py-4` without border (pick one per parent — not both).
3. `variant="inset"` children skip bottom hairline — the box carries separation.

### 5.2 `SectionHeader`

```tsx
interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

// Renders:
// <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
//   <h3 className="font-mono text-xs uppercase tracking-wide text-ink-muted">
//     {title}
//   </h3>
//   {description ? <p className="text-xs text-ink-muted">{description}</p> : null}
//   {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
// </div>
```

**Rules:**

| Rule | Detail |
|------|--------|
| Title case | `STACK TRACE` not `Stack trace` — uppercase in markup or CSS |
| No `font-medium` on header | Weight comes from mono + uppercase + muted color |
| Actions slot | Window toggles (timeline), "View all →" links, stored-count meta |
| Page vs section | `PageHeader` = sans lg/xl; `SectionHeader` = mono xs — never interchange |
| Accessibility | Render `<h3>` inside tab panel for landmark nesting (h1 page → h2 detail title → h3 sections) |

### 5.3 Migration map

| Current location | Primitive |
|------------------|-----------|
| `IssueImpactStrip` | `Section variant="band"` — header optional |
| `StackTracePanel` embedded header | `SectionHeader title="Stack trace"` + `Section variant="inset"` |
| `IssueOccurrenceTimeline` header row | `SectionHeader` with actions = window buttons |
| `IssueRecentOccurrences` title row | `SectionHeader` with description = stored gap |
| `MorePanel` section titles | `Section` + `SectionHeader` per block |
| `BreadcrumbTimeline` | `SectionHeader` + `Section variant="inset"` (already partially there) |
| `design-lab/Section` | Refactor to import shared primitive |

---

## 6. Whitespace budget — compact but not flat

Charter: compact dashboard, not spacious marketing. Flatness ≠ density — we need **rhythm variation**, not more absolute space.

### 6.1 Spacing tiers (token-backed)

| Tier | Token | Use |
|------|-------|-----|
| **Tight** | `--space-2` (0.5rem) | Within SectionHeader, badge gaps, chip rows |
| **Default** | `--space-3` (0.75rem) | Section internal padding (`py-3 px-4`) |
| **Band** | `--space-4` (1rem) | Between major Overview sections (`py-4` top on Z5, Z6) |
| **Chrome** | `--chrome-page-header-height` (3rem) | Page G1 only — not in-pane |

### 6.2 Overview vertical budget (1280×800, detail open)

| Block | Target height | Notes |
|-------|---------------|-------|
| D0 toolbar | ~2.5rem | single row @lg |
| D1 tabs | ~2.5rem | |
| Z1 title + badges | ~3.5rem | drop h2 @lg → save ~1.5rem |
| Z2 impact band | ~2rem | |
| Z3 stack well | ~8–12rem | variable; cap preview frames |
| Z4 context | ~4rem | |
| Z5 timeline well | ~5rem | chart 56px + header + summary |
| Z6 occurrences (5 rows) | ~8rem | |
| **Total above fold** | **~36–40rem** | Stack dominates — correct for P1 |

**J3 proof:** Title + impact + actions visible without scroll. Stack may require scroll — acceptable.

### 6.3 Anti-patterns (cause flatness without saving space)

| Anti-pattern | Why it fails |
|--------------|--------------|
| Uniform `py-3` on every block | No rhythm; hairlines blur together |
| `divide-y` on parent + borders on children | Double lines |
| Muted `text-sm` for both labels and values | No scan path |
| Same `bg-surface` for list + detail + all sections | Zero plane change |
| Section titles as `text-sm font-medium sans` | Indistinguishable from body emphasis |

### 6.4 Compact scannability checklist

- [ ] At least **two surface steps** visible in Overview without scrolling
- [ ] At least **three distinct type roles** in viewport (title / mono count / muted meta)
- [ ] **No more than two consecutive hairlines** without a padding band or surface step
- [ ] Section labels **mono uppercase xs** — consistent across Overview, More, Breadcrumbs

---

## 7. Ranked structural fixes (L-H1 → L-H5)

Structural hierarchy fixes — complementary to layout chrome fixes L-P1–L-P5 in [ui-polish-layout-structure.md](./ui-polish-layout-structure.md).

---

### L-H1 — Master-detail surface contrast

**Scope:** List column `bg-bg`; detail column stays `bg-surface`; selected row `bg-surface` on list; verify unread `border-l-signal` on recessed bg.

**Friction addressed:** List and detail feel like one flat pane; selection doesn't "lift."

**Proof gate:**

- [ ] Side-by-side @1280: list visually recesses vs detail without relying on border-r alone
- [ ] Selected row readable on `bg-bg` canvas (contrast QA)
- [ ] J2 five-second scan unchanged

**Depends on:** none  
**Effort:** S (`features/issues/index.tsx`, `issue-row.tsx`)

---

### L-H2 — `Section` / `SectionHeader` primitive + More panel migration

**Scope:** Add `web/src/ui/section.tsx`; migrate `MorePanel`, `IssueMorePanel` section titles; align `design-lab/Section`.

**Friction addressed:** More tab is six identical blocks; establishes kit contract before Overview refactor.

**Proof gate:**

- [ ] All More tab blocks use `SectionHeader` mono xs uppercase
- [ ] Design Lab documents Section primitive
- [ ] No `text-sm font-medium` sans section titles remain in More

**Depends on:** none  
**Effort:** S

---

### L-H3 — Overview section zoning (impact, timeline, occurrences)

**Scope:** Refactor `IssueOverviewPanel` to `Section` children; impact band with mono counts; timeline chart in inset well; occurrence rows with row dividers; remove outer `divide-y`.

**Friction addressed:** **Primary flat-UI pain** — Overview sections blend together.

**Proof gate:**

- [ ] ≥2 surface steps visible in Overview (impact band + chart well minimum)
- [ ] P1 blind test (n≥3): user can name "occurrences" vs "timeline" block without hesitation
- [ ] J3: title + impact + actions above fold @1280×800

**Depends on:** L-H2 (primitive exists)  
**Effort:** M

---

### L-H4 — Stack trace section envelope

**Scope:** `StackTracePanel` embedded mode: `Section` + inset well; move occurrence picker inside section; `SectionHeader` with grouping hint in actions slot.

**Friction addressed:** Stack header/metadata/grid collision; stack doesn't read as primary anchor.

**Proof gate:**

- [ ] CodeBlock inset visible against `bg-surface` detail pane
- [ ] No bare `border-t` between impact strip and stack — use section gap instead
- [ ] Grouping hint link in header actions, not floating subline

**Depends on:** L-H2, L-H3 (partial — can ship with L-H3)  
**Effort:** S

---

### L-H5 — Overview title dedup + header rhythm

**Scope:** Drop Overview h2 on `≥lg` (title lives in toolbar/tab context per L-P4); tighten D0+D1 into single visual chrome block or reduce double `border-b`; relocate snooze/regression banners above timeline.

**Friction addressed:** Triple title lines; toolbar+tabs chrome stack; banners below fold.

**Proof gate:**

- [ ] One title source @lg+ in detail pane
- [ ] D0+D1 combined height ≤4.5rem @lg
- [ ] Active snooze/regression banner visible without scroll when present

**Depends on:** L-P4 (layout research), L-H3  
**Effort:** S–M

---

### Priority summary

| ID | Fix | Impact | Effort | Blocks |
|----|-----|--------|--------|--------|
| **L-H1** | List `bg-bg` / detail `bg-surface` | High — master-detail read | S | — |
| **L-H2** | Section primitive + More tab | Medium — kit foundation | S | — |
| **L-H3** | Overview zoning | **Highest** — flat UI pain | M | L-H2 |
| **L-H4** | Stack envelope | Medium — P1 anchor | S | L-H2 |
| **L-H5** | Title dedup + banner order | Medium — chrome noise | S–M | L-H3, L-P4 |

**Suggested sequence:** L-H2 → L-H1 → L-H3 → L-H4 → L-H5. L-H2 first (small, unlocks consistency); L-H1 parallel (one-line surface change, immediate master-detail win); L-H3 is the main Overview payoff.

**Cross-reference:** Ship L-P2 (page band compression) before or with L-H5 to avoid fighting double chrome refactors.

---

## Appendix — file reference

| Concern | Primary files |
|---------|---------------|
| Issues layout | `web/src/features/issues/index.tsx` |
| Overview sections | `web/src/ui/issue-overview-panel.tsx` |
| Impact / timeline / occurrences | `issue-impact-strip.tsx` · `issue-occurrence-timeline.tsx` · `issue-recent-occurrences.tsx` |
| Stack | `web/src/ui/stack-trace-panel.tsx` |
| More tab | `web/src/ui/issue-more-panel.tsx` · `more-panel.tsx` |
| Breadcrumbs | `web/src/ui/breadcrumb-timeline.tsx` |
| Detail chrome | `web/src/ui/issue-detail-tabs.tsx` |
| List row | `web/src/ui/issue-row.tsx` |
| Shell surfaces | `web/src/shell/app-shell.tsx` · `top-strip.tsx` · `rail-nav.tsx` |
| Tokens | `web/design/tokens.css` |
| Informal Section (lab) | `web/src/features/design-lab/index.tsx` |
| Page chrome research | `specs/002-dashboard-ux/research/ui-polish-layout-structure.md` |
| Overview content research | `specs/002-dashboard-ux/research/issue-detail-ux-research.md` |

---

## Dissent / non-goals

| Proposal | Verdict |
|----------|---------|
| Card shadows between sections | **Refuse** — tokens.css hairlines-only |
| Heavy bordered card around every Overview block | **Refuse** — chart + stack wells sufficient |
| Larger default padding (`p-6`) | **Refuse** — compact charter |
| Color-coded section backgrounds | **Refuse** — surface steps only |
| Collapsible accordion sections by default | **Defer** — adds interaction cost; snooze/regression only |
