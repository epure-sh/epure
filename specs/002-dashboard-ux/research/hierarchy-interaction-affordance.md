# Interaction affordance — visual hierarchy research

**Status:** Research (2026-09-13)  
**Inputs:** [components.md](../../../web/design/components.md) · [tokens.css](../../../web/design/tokens.css) · [ui-polish-visual-system.md](./ui-polish-visual-system.md) · [issue-detail-ux-research.md](./issue-detail-ux-research.md) · [tab-debate.md](./tab-debate.md) · [ui-polish-component-audit.md](./ui-polish-component-audit.md)  
**Scope:** Buttons, tabs, list selection, stat bar filters, toolbar clusters — research only; no UI implementation in this pass.  
**User pain:** Main actions do not stand out; everything looks equally clickable or equally muted.

---

## 1. Executive summary

Epure's **Signal Room palette is correct** — resin forest (`accent`) for structure, phosphor chartreuse (`signal`) for the one loud CTA, warm paper surfaces. The hierarchy problem is **not missing color** but **mis-assigned variants**: the same `secondary` bordered button wraps Resolve, Snooze, bulk "Mark resolved", and regression CTAs; `ghost` and `secondary` compete at equal weight; selected/hover/active states all wash to `bg-bg-subtle`.

**Root cause:** `components.md` defines a clear variant ladder (`signal` = one per view, `primary` = accent fill, `secondary` = bordered utility, `ghost` = tertiary) but **triage surfaces ignore it**. Resolve — the job users came to do — renders as `secondary`, the same affordance as Snooze and filter-adjacent controls.

**Ratified direction:**

1. **One loud action per viewport zone** — `signal` for Resolve when issue is unresolved; nowhere else in that zone.
2. **Secondary = supporting commit** — Snooze, Copy for AI, Apply filter, mode toggles in segmented groups.
3. **Ghost = reversible / dismiss** — Ignore, Clear selection, Cancel, back navigation.
4. **Selection states use distinct tokens** — not the same `bg-bg-subtle` for hover, focus, selected row, active stat, and active tab background (where added).

---

## 2. Button variant audit

### 2.1 Variant definitions (canonical)

From `button.tsx` + `components.md`:

| Variant | Token role | Intended use |
|---------|------------|--------------|
| **`signal`** | `bg-signal` chartreuse | **One primary CTA per view** — setup milestone, unresolved Resolve |
| **`primary`** | `bg-accent` forest | Form submit, confirm in modals, **segmented control active pill** |
| **`secondary`** | bordered transparent | Supporting actions, dropdown triggers, bulk non-primary ops |
| **`ghost`** | no border, muted hover | Tertiary, dismiss, navigation, low-commit |
| **`danger`** | danger border | Destructive — isolated, never clustered with resolve |
| **`outline`** | surface + border | Rare; prefer secondary |
| **`link`** | underline accent | Inline text actions |

Default `<Button>` without variant = **`primary`** (accent fill).

### 2.2 Production usage snapshot

| Surface | Control | Variant today | Should be |
|---------|---------|---------------|-----------|
| **Issue detail toolbar** | Resolve | `secondary` | **`signal`** when unresolved; `ghost` when resolved/reopen context |
| **Issue detail toolbar** | Ignore | `ghost` | ✓ |
| **Issue detail toolbar** | Snooze | `secondary` | **`ghost`** or secondary **only if** Resolve is signal (max one bordered cluster mate) |
| **Issue detail toolbar** | Copy for AI | `ghost` | ✓ (or `secondary` if promoted — still below Resolve) |
| **Bulk bar** | Mark resolved | `secondary` | **`signal`** (zone primary) |
| **Bulk bar** | Ignore / Unresolve / Merge | `ghost` | ✓ |
| **Bulk bar** | Delete | `danger` | ✓ |
| **Bulk bar** | Clear | `ghost` | ✓ |
| **DiffPanel** | Compare occurrences / releases | active=`primary`, idle=`secondary` | ✓ as **segmented pair** — not a CTA; keep `primary`/`secondary` |
| **FilterPanel** | Filter trigger | `ghost` + manual `border` | **`secondary`** — drop ad-hoc border override |
| **FilterPanel** | Apply | default (`primary`) | ✓ |
| **FilterPanel** | Cancel | `ghost` | ✓ |
| **Setup** | Create project | `signal` | ✓ — only correct signal usage in app |
| **SnoozeMenu** | trigger | `secondary` | **`ghost`** in detail toolbar context |
| **RegressionStrip / IssuesContextStrip** | View regressions | `secondary` | `secondary` ✓ — not same zone as Resolve |
| **CopyButton** | Copy | `secondary` | ✓ |
| **Forms (account, DSN rotate)** | Save / submit | `secondary` | Acceptable — no competing signal in form zone |

**Critical finding:** `variant="signal"` appears **once** (`setup/index.tsx`). `variant="primary"` appears **only** as DiffPanel mode toggle and default Apply. Triage never uses the loud variant.

### 2.3 Wrong-variant patterns

#### A. Resolve demoted to secondary

```760:766:web/src/features/issues/index.tsx
                    <Button
                      variant="secondary"
                      size="toolbar"
                      onClick={() => void handleResolve(selectedIssue.id)}
                    >
                      Resolve
                    </Button>
```

Resolve is the charter primary triage action (`e` shortcut, J3 one-screen goal). Secondary reads as "available option" not "do this now."

#### B. Snooze equals Resolve weight

```30:32:web/src/features/issues/snooze-menu.tsx
        <Button variant="secondary" size="toolbar">
          Snooze
        </Button>
```

Two bordered toolbar buttons side by side — visual tie. Snooze is tertiary per [issue-detail-ux-research.md §5.2](./issue-detail-ux-research.md).

#### C. Bulk primary action uses secondary

```45:47:web/src/features/issues/bulk-actions.tsx
          <Button variant="secondary" className="text-xs" disabled={busy} onClick={onResolve}>
            Mark resolved
          </Button>
```

When bulk bar replaces list header, **Mark resolved** is the zone's job — should be `signal`.

#### D. Ghost + manual border (fake secondary)

```134:136:web/src/ui/filter-panel.tsx
            <Button variant="ghost" className="h-8 border border-border px-3 text-xs">
              Filter
            </Button>
```

Bypasses CVA; looks like secondary but hover is ghost wash — inconsistent with chip row.

#### E. Design Lab encodes the bug

Design Lab issue detail preview uses Resolve=`secondary`, Snooze=`secondary` — documents the wrong pattern as reference.

#### F. Segmented vs CTA confusion (acceptable exception)

DiffPanel mode buttons correctly use `primary`/`secondary` toggle — **not** a mistake if we reserve `signal` for commit actions and `primary` for in-place mode switches:

```201:215:web/src/features/issues/diff-panel.tsx
        <Button
          variant={mode === "occurrence" ? "primary" : "secondary"}
          ...
        >
          Compare occurrences
        </Button>
        <Button
          variant={mode === "release" ? "primary" : "secondary"}
          ...
        >
          Compare releases
        </Button>
```

**Rule:** segmented groups may use `primary`/`secondary`; **never** use `signal` inside a pair.

---

## 3. Tab active state — visible enough?

### 3.1 Current implementation

```32:35:web/src/ui/tabs.tsx
      "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors duration-fast hover:text-ink data-[state=active]:border-accent data-[state=active]:text-accent focus-ring",
```

Active tab = **2px bottom border** + **accent text color** (forest green on white). No background fill. Inactive = muted ink.

### 3.2 Assessment

| Criterion | Verdict |
|-----------|---------|
| Distinguishable from inactive at glance | **Marginal** — accent-on-white is low contrast; only bottom edge signals state |
| Distinct from hover | **Weak** — hover lifts inactive to `text-ink`; active adds border + accent text — easy to miss in peripheral vision |
| Distinct from selected issue row | **Colliding metaphor** — row selection uses background wash; tabs use underline-only — user may not map "underline = you are here" vs "background = selected item" |
| Keyboard focus | ✓ `.focus-ring` on triggers |
| Meets Plausible calm | ✓ — no pill chrome |

**Verdict:** Active tab is **technically present but under-signaled** for a master-detail layout where tabs compete with a dense list and stat bar. Users report "everything equally muted" partly because **accent text on muted baseline** is the same family as filter chips' active state (`text-accent` + `bg-accent-muted`).

### 3.3 Recommended enhancement (research)

Keep underline pattern (charter: hairlines, no pills). Add **one** secondary cue — pick one:

1. **Preferred:** `data-[state=active]:font-semibold` or `font-medium` → `font-semibold` + keep border (no new color)
2. **Optional background:** `data-[state=active]:bg-bg-subtle` **only on tab strip** — distinct from row selected if row uses `bg-state-selected` token
3. **Refuse:** filled pill tabs, signal color on tabs (reserves chartreuse for Resolve)

Detail tabs (Overview · Stack · Breadcrumbs · More) are **navigation, not primary action** — accent underline is correct *family*; needs **stronger weight delta**.

---

## 4. Issue row — selected vs hover vs bulk-selected

### 4.1 State matrix (shipped)

```32:39:web/src/ui/issue-row.tsx
        selected
          ? "bg-bg-subtle"
          : bulkSelected
            ? "bg-signal-muted/40 hover:bg-signal-muted/55"
            : "bg-surface hover:bg-bg-subtle",
        unread && !selected && !bulkSelected && "border-l-2 border-l-signal pl-[14px]",
```

Checkbox column (when bulk mode):

```133:135:web/src/features/issues/issue-list.tsx
                checked
                  ? "bg-accent-muted/60"
                  : "bg-surface",
```

### 4.2 Distinctness audit

| Transition | Visual delta | Distinct? |
|------------|--------------|-----------|
| Default → hover | `surface` → `bg-subtle` | Subtle — OK for list |
| Default → **selected** (keyboard/list focus) | → `bg-subtle` | **Same as hover** — selected row indistinguishable from hovered non-selected row |
| Default → **bulk selected** | → `signal-muted/40` | ✓ — chartreuse wash reads as "checked" |
| Selected + bulk checked | selected wins (`bg-subtle` only) | **Gap** — bulk check visible in gutter but row loses signal wash |
| Unread | 2px `signal` left bar | ✓ — matches `components.md` (audit doc was stale on accent bar) |
| Checkbox gutter when checked | `accent-muted/60` | Third green family alongside signal bulk + bg-subtle selected |

### 4.3 Problems

1. **Hover ≡ selected** — both `bg-bg-subtle`; user cannot see which issue drives the detail pane without reading content.
2. **Three selection languages** — signal wash (bulk), neutral wash (selected), accent-muted (checkbox column).
3. **Selected + bulk** — precedence hides bulk styling on row body; only checkbox communicates multi-select.

### 4.4 Target state matrix (proposed)

Use CSS tokens from `tokens.css` (`--state-hover`, `--state-selected`) — map in Tailwind theme, not hex in JSX.

| State | Background | Left edge | Notes |
|-------|------------|-----------|-------|
| Default | `bg-surface` | unread: 2px `signal` | |
| Hover (not selected) | `bg-state-hover` | preserve unread bar | |
| **Selected** (detail target) | `bg-state-selected` + **`border-l-2 border-l-accent`** or inset ring | suppress unread bar | Must differ from hover |
| Bulk selected | `bg-signal-muted/40` | optional 2px `signal` | |
| Selected + bulk | `bg-state-selected` + signal gutter checkbox | combine cues | |
| Focus | `.focus-ring` | | |

**Principle:** *Selected = structural accent edge*; *bulk = signal wash*; *hover = lightest wash only*.

---

## 5. StatBar — clickable vs non-clickable

### 5.1 Current implementation

```27:52:web/src/ui/stat-bar.tsx
        {items.map((item) => {
          const clickable = Boolean(item.onClick);
          return (
            <button
              ...
              disabled={!clickable}
              ...
              className={cn(
                ...
                clickable &&
                  "cursor-pointer rounded-md transition-colors duration-fast hover:bg-bg-subtle focus-ring -mx-1 px-1 py-0.5",
                item.active && "bg-bg-subtle",
              )}
            >
```

Issues home usage:

| Stat | Clickable | Active filter |
|------|-----------|---------------|
| Unresolved | ✓ → `is:unresolved` | `active` when token in query |
| Events (7d) | ✗ | — |
| Regressions | ✓ → `is:regression` | `active` when token in query |

### 5.2 Assessment

| Criterion | Verdict |
|-----------|---------|
| Clickable vs static distinguishable at rest | **Weak** — disabled `<button>` still looks like content; no `cursor-default` on non-clickable (browser may show not-allowed on disabled) |
| Hover affordance | Only on clickable — good, but **Events** stat never shows hover; difference is invisible until mouse move |
| Active filter state | `bg-bg-subtle` only — **same token as row hover/selected** |
| Label vs value hierarchy | ✓ — muted label, mono count |
| Plausible click-to-filter pattern | Concept ✓ — execution under-signaled |

### 5.3 Recommended differentiation

**Non-clickable items:**

- Render as `<div>` not disabled button — avoids false affordance and bad a11y (`disabled` controls in toolbar)
- `cursor-default`; no focus ring; no hover wash

**Clickable items:**

- Keep `<button>`; `cursor-pointer`; hover `bg-state-hover`
- **Active:** `bg-state-selected` + **`font-semibold` on count** or 2px bottom `border-accent` on stat cell (mirrors tabs — consistent "filter active" language)
- Optional: `text-accent` on label when active (match FilterChip active)

**Do not** make Events (7d) clickable until it does something — [tab-debate.md](./tab-debate.md) keeps it informational.

---

## 6. Toolbar action cluster — should Resolve dominate?

### 6.1 Shipped cluster (issue detail header)

Order: **Resolve** (`secondary`) · **Ignore** (`ghost`) · **Snooze** (`secondary`) · **Copy for AI** (`ghost`)

All `size="toolbar"` (`h-7 text-xs`) — equal height, equal visual weight class.

### 6.2 Hierarchy analysis

| Action | Job frequency | Risk | Should dominate? |
|--------|---------------|------|------------------|
| **Resolve** | Highest — closes triage loop | Low | **Yes** |
| Ignore | Common | Medium | No |
| Snooze | Repeat | Low | No |
| Copy for AI | Power user | None | Promoted secondary, not primary |

**Answer: Yes — Resolve must dominate** the header-right cluster on Overview. Today it does not.

### 6.3 Target cluster (wide viewport)

```
[ Resolve ■ signal ]  [ Ignore ]  [ Snooze ▾ ]  [ Copy for AI ]
     ↑ only filled/chartreuse control
```

Rules:

1. **Exactly one** `signal` button in the detail header when status is unresolved.
2. If issue is resolved/regressed, primary becomes **Reopen** or **Resolve again** — still one signal max.
3. Snooze drops to `ghost` + chevron; never bordered alongside signal Resolve.
4. Optional: `Kbd` hint on Resolve (`e`) — affordance without adding buttons.

Bulk bar mirrors same ladder: **Mark resolved** = signal; everything else ghost/danger.

### 6.4 Anti-pattern to refuse

- Two `secondary` buttons in the triage cluster (current)
- `signal` on Copy for AI (competes with Resolve)
- `primary` accent fill on Resolve (forest green) — reserves **chartreuse** for the one CTA per [components.md](../../../web/design/components.md)

---

## 7. Proposed affordance rules

### 7.1 Global

1. **One `signal` per viewport zone** — zone = sticky header band, bulk bar, modal footer, setup step. Never two chartreuse buttons visible in the same band.
2. **`primary` (accent fill)** — form submit, dialog confirm, **segmented control active segment** only.
3. **`secondary`** — dropdown triggers, copy actions, filter triggers, regression CTAs outside triage cluster.
4. **`ghost`** — ignore, dismiss, back, clear, tertiary utilities.
5. **`danger`** — isolated; minimum 8px gap from signal/primary; never first in cluster.
6. **No hex in JSX** — token classes only; tune contrast in `tokens.css` if signal-on-toolbar feels loud.

### 7.2 Viewport zones (Issues master-detail)

| Zone | Primary (`signal`) | Secondary | Ghost |
|------|-------------------|-----------|-------|
| Issues header (no selection) | none | Filter trigger | — |
| Bulk bar | Mark resolved | Merge (if shown) | Ignore, Clear, … |
| Detail toolbar | Resolve (unresolved) | Copy for AI (optional) | Ignore, Snooze |
| DiffPanel mode | — | inactive segment | — |
| DiffPanel mode active | — | — | use `primary` segment |
| Filter popover | Apply (`primary`) | — | Cancel |

### 7.3 Selection & navigation (non-button)

| Element | Active/selected cue |
|---------|---------------------|
| Issue row (detail target) | `bg-state-selected` + left accent bar |
| Issue row (bulk) | `bg-signal-muted/40` |
| Issue row (hover) | `bg-state-hover` only |
| StatBar filter | `bg-state-selected` + label accent or bottom hairline |
| Tab | bottom `border-accent` + semibold + optional strip bg |
| FilterChip active | `bg-accent-muted text-accent` (keep) |
| Nav rail | existing left tick + `bg-bg-subtle` |

### 7.4 Focus

Unify on `.focus-ring` (1px accent outline per `qa.md`) — already on Button, rows, StatBar clickable, tabs. No Tailwind ring on one control and custom on another.

### 7.5 Documentation update (when implementing)

Extend `web/design/components.md` §Buttons with **zone map** and **forbidden pairs** (e.g. `secondary` Resolve, dual secondary in toolbar).

---

## 8. Implementation slices I-H1–I-H6

Ordered for incremental proof. Depends on **V1 token reconciliation** (`--state-hover`, `--state-selected` in theme) where noted.

| Slice | Scope | Files | Proof gate |
|-------|-------|-------|------------|
| **I-H1 — Variant contract** | Document zone rules in `components.md`; fix Design Lab toolbar demo to signal Resolve | `web/design/components.md`, `web/src/features/design-lab/index.tsx` | Design Lab shows one signal per detail header |
| **I-H2 — Triage toolbars** | Detail Resolve → `signal`; Snooze → `ghost`; bulk Mark resolved → `signal`; filter trigger → `secondary` (drop manual border) | `issues/index.tsx`, `bulk-actions.tsx`, `snooze-menu.tsx`, `filter-panel.tsx` | J3: Resolve is visually first in header; bulk bar scan test |
| **I-H3 — Row selection matrix** | Separate hover/selected/bulk tokens; selected row left accent bar; selected+bulk combo | `issue-row.tsx`, `issue-list.tsx`, `tailwind.theme.cjs` | Keyboard `j/k` — selected row obvious at rest without hover |
| **I-H4 — Tab active cue** | Semibold active label + optional `bg-bg-subtle` on active trigger only | `tabs.tsx` | Tab switch: active tab identifiable in <1s peripheral glance |
| **I-H5 — StatBar affordance** | Non-clickable → `div`; active filter styling; clickable hover | `stat-bar.tsx`, `issues/index.tsx` | Events stat does not look clickable; Regressions active state distinct from row hover |
| **I-H6 — QA + regression** | Add affordance checks to `qa.md`; dark mode pass on signal/selected states | `web/design/qa.md`, manual `/__design` | All qa.md affordance bullets pass; accent <10% pixels on list |

**Dependency order:** I-H1 → I-H2; V1 state tokens → I-H3/I-H5; I-H4 independent; I-H6 last.

**Explicitly not in I-H1–I-H6:** new button variants; shadow elevation; pill tabs; making Events stat clickable.

---

## 9. Related surfaces (brief)

| Component | Note |
|-----------|------|
| **FilterChip** | Active state is strongest filter affordance in header — good reference for StatBar active |
| **DiffPanel** | Segmented `primary`/`secondary` OK; height `h-9` vs toolbar `h-7` — intentional (mode switch vs triage) |
| **MergeActions** | Both buttons `secondary` — acceptable (no single primary; user must pick merge target) |
| **RegressionStrip** | `secondary` CTA correct — different zone from Resolve |
| **Checkbox** | `accent-muted` when checked — align gutter with row bulk `signal-muted` in I-H3 |

---

## 10. Principles

1. **Affordance = promised interaction** — if it looks like a button, it must act; static metrics are not disabled buttons.
2. **One loud commit per band** — chartreuse `signal` is scarce on purpose.
3. **Selection ≠ action** — background/border states for "where am I" never reuse the same wash as hover.
4. **Segmented ≠ CTA** — mode toggles use accent fill pair; triage uses signal.
5. **Signal Room restraint** — phosphor appears on unread bar, bulk wash, and one Resolve — not sprinkled on tabs and stats.

---

## 11. Anti-patterns

| Anti-pattern | Why it hurts |
|--------------|--------------|
| Resolve as `secondary` | Main job looks optional |
| Snooze `secondary` beside Resolve | Two equals in the decision cluster |
| Hover same as selected row | User loses list↔detail link |
| Disabled button for static stat | False affordance; poor screen reader semantics |
| `ghost` + manual border | Bypasses design system; hover mismatch |
| `signal` on multiple buttons in one band | Chartreuse noise; nothing wins |
| Active tab = only muted accent text | Tabs disappear against busy list header |

---

## 12. Proof checklist (manual)

- [ ] At 1280×800 Issues + detail open: identify Resolve in <2s without reading labels
- [ ] Hover row ≠ selected row at rest (no mouse on list)
- [ ] Bulk select 2+ rows: bulk wash distinct from detail-selected row
- [ ] Click Regressions stat: active state visible; Events stat never shows pointer cursor
- [ ] Overview tab active vs Breadcrumbs: clear without clicking
- [ ] Dark mode: `signal` Resolve still meets contrast on `surface-raised`
- [ ] No hex literals added in `src/features` or `src/ui`

---

## Appendix — File reference map

| File | Affordance role |
|------|-----------------|
| `web/src/ui/button.tsx` | Variant source of truth |
| `web/src/ui/tabs.tsx` | Detail tab triggers |
| `web/src/ui/issue-row.tsx` | List selection states |
| `web/src/ui/stat-bar.tsx` | Header metrics + filters |
| `web/src/ui/filter-chip.tsx` | Active filter reference pattern |
| `web/src/ui/issue-detail-tabs.tsx` | Toolbar shell + tab layout |
| `web/src/features/issues/index.tsx` | Detail actions composition |
| `web/src/features/issues/bulk-actions.tsx` | Bulk primary action |
| `web/src/features/issues/diff-panel.tsx` | Segmented control pattern |
| `web/design/tokens.css` | Signal Room tokens — edit contrast here only |
