# Visual hierarchy — color & semantic tokens

**Status:** Research (2026-09-13)  
**Pain:** “Eye hardly distinguish element priority, main action, main sections — colors don’t guide attention.”  
**Inputs:** [tokens.css](../../../web/design/tokens.css) · [components.md](../../../web/design/components.md) · [QA.md](../../../../design/QA.md) · [button.tsx](../../../web/src/ui/button.tsx) · [badge.tsx](../../../web/src/ui/badge.tsx) · [stat-bar.tsx](../../../web/src/ui/stat-bar.tsx) · [issue-overview-panel.tsx](../../../web/src/ui/issue-overview-panel.tsx) · [issue-detail-tabs.tsx](../../../web/src/ui/issue-detail-tabs.tsx) · [issues/index.tsx](../../../web/src/features/issues/index.tsx) · related `ui/` + `shell/` usage grep  
**Constraint:** Research only — token names in proposals, no hex in JSX; no implementation in this pass.

---

## Executive summary

Epure’s **palette is capable of hierarchy** — resin forest (`--accent`) for structure, phosphor chartreuse (`--signal`) for sparing emphasis, warm paper surfaces for calm. The pain is not missing colors; it is **role collapse**:

1. **Primary triage action (Resolve) renders as `secondary`** — same bordered-ghost treatment as Snooze, regression CTAs, bulk actions, and filter triggers.
2. **`--accent` and `--accent-muted` are over-applied** to navigation, filters, selections, and occurrences — everything reads “equally selected.”
3. **Semantic danger competes with structure** — unresolved status uses the error badge; regression strips, context strips, and status badges all shout at similar volume.
4. **Surfaces are flat** — `--surface` vs `--bg-subtle` delta is ~5% on warm paper; section boundaries rely on 1px hairlines and identical `text-ink` / `text-ink-muted` pairs.

**Hierarchy thesis:** Color should answer three questions in order — *What do I do?* (one loud action) · *Where am I?* (section + nav) · *What’s metadata?* (quiet). Today all three land in the middle gray-green band.

---

## 1. Current color usage audit — what competes for attention

### 1.1 Token roles (as designed)

| Token | Design intent (`tokens.json` meta) | Shipped role |
|-------|-----------------------------------|--------------|
| `--accent` | Brand / structure (resin forest) | Primary button fill, active tab text+border, rail tick, filter-chip active text, checkbox checked, links, top-strip icon button |
| `--accent-muted` | Soft structural wash | Active filter chips, occurrence row selection, bulk-checkbox column, billing highlight |
| `--signal` | Phosphor chartreuse — CTAs, unread bar | Unread left bar on rows, bulk-select row wash, setup “Create project” only |
| `--text` / `--text-muted` | Ink hierarchy | Titles, stat values, body vs meta — but stat **values** and **titles** both use `text-ink` |
| `--semantic-danger` | Live exceptions only (QA) | Error badges, regression left borders, regression copy |
| `--semantic-warning` | Caution | Level badges, row “Came back” badge (inconsistent with Overview) |
| `--bg-subtle` | Hover / selection wash | Row hover, selected row, stat active chip, hint strips, code blocks |
| `--surface` | Panel default | Headers, list rows, detail panes — dominant fill |

### 1.2 Attention competitors on the Issues screen (worst case)

```
┌─ header: bg-surface ─────────────────────────────────────────────┐
│  title (text-ink) · stat values (text-ink 3xl mono) · filter btn  │  ← all same ink weight
├─ context strip: bg-bg-subtle/30 · optional danger left bar ──────┤
├─ list / detail: bg-surface everywhere ────────────────────────────┤
│  unread: border-l-signal · selected: bg-bg-subtle · bulk: signal-muted │
│  regression badge: warning · unresolved row: signal bar              │
├─ detail toolbar ──────────────────────────────────────────────────┤
│  [Resolve secondary] [Ignore ghost] [Snooze secondary] [Copy ghost] │  ← Resolve not loudest
├─ tabs: active = text-accent + border-accent ──────────────────────┤
├─ overview: title text-ink · badges error/warning · impact text-muted │
│  sections: divide-y only · banners: accent OR danger left bar      │
└────────────────────────────────────────────────────────────────────┘
```

### 1.3 Specific collisions

| Elements | Shared treatment | Effect |
|----------|------------------|--------|
| **Resolve** + **Snooze** + **Show came back** + **Mark resolved** (bulk) | `Button variant="secondary"` toolbar/default | No primary action visible in triage |
| **Ignore** + **Copy for AI** + **Dismiss** + **Clear** | `Button variant="ghost"` + `text-ink-muted` (some) | Secondary actions blend together |
| **Active tab** + **active FilterChip** + **checked Checkbox** | `--accent` text/border + `--accent-muted` fill | “Everything is active” |
| **Unresolved badge** + **regression banner** + **context regression strip** | `--semantic-danger` borders/fills | Normal open issue looks like emergency |
| **Stat bar value** + **list title** + **issue detail H2** | `text-ink` + `font-medium` | Metrics compete with titles for scan priority |
| **Selected occurrence** + **bulk checkbox column** | `bg-accent-muted/50–60` | Green tint = selection, but also filters/chips use same family |
| **Snooze banner** vs **regression banner** | `border-l-accent` vs `border-l-semantic-danger`, same `bg-bg-subtle/40` | Two alert types, similar volume |

### 1.4 Underused tokens (missed hierarchy levers)

| Token | Defined | Used in Issues flow? |
|-------|---------|----------------------|
| `Button variant="primary"` (`bg-accent` solid) | ✓ | **Never** in features (Design Lab only) |
| `Button variant="signal"` | ✓ | Setup page only — not triage |
| `--surface-raised` | ✓ | Bulk-actions sticky bar only |
| `--success` | ✓ | Not wired to resolved/snoozed/healthy states |
| `--text-subtle` | ✗ (proposed in ui-polish) | Snoozed suffix uses `text-ink-muted/70` ad hoc |
| `--state-selected` / `--state-hover` | ✓ in tokens.css | Not referenced in Tailwind theme — inline `/40` `/60` opacities instead |

### 1.5 `text-ink-muted` overload

`text-ink-muted` (`#3D4A40` light) is doing too many jobs at once:

- Ghost button default color  
- Inactive tab labels  
- Stat labels **and** should-be-quieter meta  
- Badge `env` variant text  
- Impact strip (`IssueImpactStrip` — important triage context)  
- Section `dt` labels (Environment, Release)  
- Hint copy in context strip  

When muted is used for both **action labels** (Ignore) and **primary-adjacent context** (impact strip), nothing steps down far enough to create a floor.

---

## 2. Action priority ladder — primary vs secondary vs ghost vs danger

### 2.1 Shipped button matrix (`button.tsx`)

| Variant | Light-mode appearance | Designed for (`components.md`) | Actual usage (Issues) |
|---------|----------------------|-------------------------------|------------------------|
| **primary** | Solid `--accent`, white contrast | Primary | **Unused** in features |
| **signal** | Solid `--signal`, dark contrast | Chartreuse CTA — one per view | Setup only |
| **secondary** | Hairline border, transparent, `text-ink` | Secondary | **Resolve**, Snooze, bulk resolve, regression CTA, vendor frames |
| **ghost** | No border, `text-ink-muted` | Tertiary | Ignore, Copy for AI, Dismiss, Clear, back nav |
| **danger** | Danger border + text, surface fill | Destructive | Delete (bulk), settings deletes |

### 2.2 Toolbar cluster analysis (`issues/index.tsx` L760–786)

Current order: `Resolve (secondary)` · `Ignore (ghost)` · `Snooze (secondary)` · `Copy for AI (ghost)`

| Problem | Detail |
|---------|--------|
| **Resolve not primary** | Spec says Signal = one CTA per view; Resolve is the triage terminus — it should be the single filled control |
| **Snooze = Resolve weight** | Both `secondary` at `size="toolbar"` — identical border + height |
| **Ghost pair indistinct** | Ignore vs Copy differ only by label; both muted, borderless, h-7 |
| **No danger in row** | Correct — delete is bulk-only |
| **Bulk bar repeats mistake** | `Mark resolved` is `secondary` while Delete is `danger` — resolve should still outrank ignore/reopen |

### 2.3 Distinctness verdict

| Pair | Distinct enough? | Why |
|------|------------------|-----|
| primary vs secondary | **Yes** (if primary were used) | Solid fill vs hairline — high contrast |
| secondary vs ghost | **Barely** at toolbar size | Border is 1px; ghost hovers to near-secondary |
| secondary vs secondary | **No** | Resolve and Snooze are interchangeable |
| danger vs secondary | **Moderate** | Red text helps; still same geometry |
| signal vs primary | **Yes** | Chartreuse vs forest — but signal must stay ≤1 per view |

### 2.4 Recommended action ladder (semantic, not new variants)

| Priority | Variant | Examples | Color role |
|----------|---------|----------|------------|
| **P0 — primary action** | `primary` **or** `signal` (pick one rule) | Resolve, Create project, Save | One filled control per toolbar/view |
| **P1 — secondary action** | `secondary` | Snooze, Merge, Export, Filter open | Bordered, `text-ink` — supportive |
| **P2 — tertiary** | `ghost` | Ignore, Copy for AI, Dismiss, Back | `text-ink-muted`, no border default |
| **P3 — destructive** | `danger` | Delete, Remove webhook | Semantic danger, never filled solid (QA) |

**Recommendation:** Use **`primary` (`bg-accent`) for Resolve** in product chrome — keeps chartreuse scarce for unread + onboarding. Reserve **`signal` for marketing/setup** “one per view” moments per `components.md`. Do not make Resolve chartreuse; that competes with unread bars in the list behind the detail pane.

---

## 3. Section backgrounds — surface vs bg-subtle vs accent-muted

### 3.1 Token contrast (light mode)

| Token | Hex | Δ vs `--surface` | Perceived role today |
|-------|-----|------------------|----------------------|
| `--bg` | `#f7f6f1` | Canvas behind panels | Body only |
| `--bg-subtle` | `#eceae2` | ~8% darker than paper | Hover, selected row, hints — **correct** |
| `--surface` | `#ffffff` | baseline | Headers, rows, detail — **dominant** |
| `--surface-raised` | `#fffef9` | ~imperceptible vs surface | Bulk bar only |
| `--accent-muted` | `#e2e6d8` | Green-tinted wash | Selection — **overused** |

### 3.2 When to use each (proposal)

| Token | Use | Do not use |
|-------|-----|------------|
| **`--surface`** | Default panel fill: list, detail body, dialogs, inputs | Full-page canvas |
| **`--bg` / `bg-bg`** | App canvas visible in gutters / master-detail gaps | Card interiors |
| **`--bg-subtle`** | Hover washes, **selected list row**, stat filter active, code blocks, keyboard hints, **section header bands** | Primary CTA backgrounds |
| **`--surface-raised`** | Sticky toolbars (bulk bar, detail action strip), dropdowns — “floating one step above” | Entire detail pane |
| **`--accent-muted`** | **Active filter chips only** (query state) | Row selection, occurrence selection, checkbox column |

### 3.3 Section boundary patterns (Issues detail)

Today `IssueOverviewPanel` uses `divide-y divide-border` only — sections (title, impact, stack, metadata, timeline, occurrences) are separated by identical hairlines with no background steps.

| Section | Current | Proposed background |
|---------|---------|---------------------|
| Title + badges | `px-4 py-3` on surface | Keep surface — highest typographic hierarchy |
| Impact strip | `text-ink-muted` on surface | `bg-bg-subtle/50` band OR bump to `text-ink` (content is P1 triage) |
| Stack trace | `border-t` | `bg-surface` + mono section label (already `font-medium text-ink`) |
| Metadata `dl` | surface | Optional `bg-bg-subtle/30` — “facts block” |
| Timeline / occurrences | surface | Occurrence **selected** → `bg-bg-subtle` not `accent-muted` |
| Alert banners (snooze/regression) | `bg-bg-subtle/40` + left bar | Regression keeps danger bar; snooze drops to `border-l-border-strong` (not accent) |

### 3.4 Selection state unification

| State | Shipped | Target |
|-------|---------|--------|
| List row selected | `bg-bg-subtle` | ✓ keep |
| List row bulk | `bg-signal-muted/40` | ✓ keep — distinct from read selection |
| Occurrence selected | `bg-accent-muted/50` | → `bg-bg-subtle` or `--state-selected` |
| Stat filter active | `bg-bg-subtle` | Add `text-ink` weight or `border-b-2 border-accent` |
| Filter chip active | `bg-accent-muted text-accent` | ✓ keep — query semantics, not row semantics |

---

## 4. Semantic color map — loudness ranking

### 4.1 Target loudness scale (1 = quietest, 10 = loudest)

| Rank | Token / pattern | Allowed surfaces | Max instances per viewport |
|------|-----------------|------------------|----------------------------|
| **10** | `--signal` fill | One primary CTA **or** unread bar — never both in same focal area | 1 filled button **or** N thin bars |
| **9** | `--semantic-danger` border/text | Regression strip, fault frame, delete action | ≤2 regions |
| **8** | `Button primary` (`--accent` fill) | Resolve, auth submit | 1 per toolbar |
| **7** | `--semantic-danger` badge | Regression / “Came back” only — **not** generic unresolved | 0–1 badges |
| **6** | `--semantic-warning` badge | `level:fatal/error` | per issue |
| **5** | `--accent` text + border | Active tab, active nav, active filter chip text | nav + 1 filter state |
| **4** | `text-ink` + `font-medium` | Titles, stat values, impact numbers | many |
| **3** | `bg-accent-muted` | Active filter chips | query chips only |
| **2** | `text-ink-muted` | Meta, ghost actions, labels | many |
| **1** | `border-border`, `bg-surface` | Structure | canvas |

### 4.2 Status semantics (badge policy)

| Status | Shipped badge | Proposed |
|--------|---------------|----------|
| `unresolved` | `variant="error"` (danger) | `variant="env"` or new `variant="status"` — neutral border, `text-ink` |
| `resolved` | `variant="env"` | `variant` with `--semantic-success` text or muted check — quiet |
| `ignored` | `variant="env"` | `text-ink-muted` — quieter than resolved |
| `regression` | `error` + warning row badge | Single `warning` or dedicated `regression` — danger **strip** carries urgency |
| `level:*` | `warning` | ✓ keep |

**Rule:** `--semantic-danger` is for **“this came back / this is crashing”** — not **“this is open.”** Open is the default; it should not scream.

### 4.3 Chartreuse budget (QA: accent < ~10% pixels)

| Use | Keep? |
|-----|-------|
| Unread 2px left bar | ✓ signature |
| Bulk selection wash | ✓ transient |
| Setup CTA | ✓ |
| Resolve button | ✗ — use forest primary instead |
| Active tab | ✗ — use ink + accent border only |

---

## 5. Dark mode considerations

Dark block (`[data-theme="dark"]` in `tokens.css`):

| Token | Light | Dark | Hierarchy risk |
|-------|-------|------|----------------|
| `--accent` | `#1f3d32` forest | `#8fb89a` sage | Dark **primary buttons** are softer — less jump vs `--surface` `#212623` |
| `--accent-muted` | `#e2e6d8` | `#1e2a24` | Selection wash **nearly invisible** on `#212623` surface |
| `--signal` | `#b8e000` | `#b8e000` | **Stable anchor** — good for unread; may glare on `#121714` bg — OK at 2px |
| `--text-muted` | `#3d4a40` | `#9aa89c` | Better separation from `--text` in dark than light |
| `--bg-subtle` | `#eceae2` | `#1a1f1c` | Row selection visible but subtle |
| `--border` | `#c8c4b8` | `#343c36` | Section hairlines may disappear — use `border-strong` for section headers |

### 5.1 Dark-mode-specific rules

1. **Primary buttons:** Consider `hover:border-accent-hover-border` in dark — fill alone may not pop; test 3:1 against `--surface`.
2. **`accent-muted` selection:** Bump dark value to `#2a3530` or stop using for selection — use `--bg-subtle` only.
3. **Secondary buttons:** `border-border/80` on `#212623` is low contrast — dark secondary may need `border-strong` default.
4. **Ghost actions:** `text-ink-muted` on dark is readable — keep ghost for tertiary.
5. **Signal on dark:** Unread bar + chartreuse CTA remain brand-consistent; do not add second chartreuse fills in detail toolbar.
6. **Focus ring:** `--focus-ring` = sage accent — verify visibility on `--surface` and `--bg-subtle`.

---

## 6. Concrete token/CSS changes — ranked P0–P2

### P0 — fixes the reported pain (hierarchy broken)

| # | Change | Where | Rationale |
|---|--------|-------|-----------|
| P0-1 | **Resolve → `variant="primary"`** | `issues/index.tsx` toolbar, `bulk-actions.tsx` resolve | Single filled action — instant priority |
| P0-2 | **Snooze → `variant="ghost"` or `secondary` demoted below Resolve** | `snooze-menu.tsx` | Stop equating deferral with resolution |
| P0-3 | **Unresolved badge → neutral** (`env` or `default`) | `issue-overview-panel.tsx` | Danger is not “open” |
| P0-4 | **Occurrence selection: `bg-bg-subtle` replaces `bg-accent-muted/50`** | `issue-recent-occurrences.tsx` | Stop green “everything selected” |
| P0-5 | **Impact strip: `text-ink` not `text-ink-muted`** | `issue-impact-strip.tsx` | Triage numbers deserve body weight |

### P1 — section + state clarity

| # | Change | Where | Rationale |
|---|--------|-------|-----------|
| P1-1 | **Wire `--state-selected` / `--state-hover` in `tailwind.theme.cjs`** | theme + row/stat components | One hover/selected wash |
| P1-2 | **Add `--text-subtle`** (between muted and border) | `tokens.css` | Tertiary meta (snoozed, hints) |
| P1-3 | **Stat active: `font-medium` value + `border-b-2 border-accent`** | `stat-bar.tsx` | Filter affordance without chip green |
| P1-4 | **Detail toolbar: `bg-surface-raised` sticky band** | `issue-detail-tabs.tsx` action row | Separates actions from tab content |
| P1-5 | **Snooze banner: `border-l-border-strong`** not `border-l-accent` | `issue-overview-panel.tsx` | Accent bar reserved for nav/filters |
| P1-6 | **Tab active: `text-ink` + `border-accent`** (drop `text-accent`) | `tabs.tsx` | Tabs = location, not brand CTA |
| P1-7 | **Resolved status: `--semantic-success` text** | `badge.tsx` new variant | Positive quiet closure |

### P2 — polish + dark parity

| # | Change | Where | Rationale |
|---|--------|-------|-----------|
| P2-1 | **Dark `--accent-muted` lift** | `tokens.css` dark block | Selection visible |
| P2-2 | **Secondary dark: `border-strong` default** | `button.tsx` or dark override | Bordered actions legible |
| P2-3 | **Section header bands: `bg-bg-subtle/40` + `border-b border-border-strong`** | overview metadata, timeline headers | Scannable blocks without cards |
| P2-4 | **Bulk checkbox column: `bg-bg-subtle` when checked** | `issue-list.tsx` | Decouple bulk from accent-muted |
| P2-5 | **Design Lab: show full ladder** primary/signal/secondary/ghost/danger + section swatches | `design-lab/index.tsx` | QA reference for hierarchy |
| P2-6 | **Document “one signal fill per view”** in `components.md` | design docs | Prevent chartreuse creep |

---

## 7. Anti-patterns

### 7.1 “Everything same weight gray”

| Anti-pattern | Example in codebase | Fix direction |
|--------------|---------------------|---------------|
| All toolbar buttons bordered muted | Resolve + Snooze both `secondary` | One fill, rest ghost |
| All meta `text-ink-muted` | Impact strip equals hint copy | Promote triage context to `text-ink` |
| All sections `divide-y` only | Overview panel | Alternate subtle bands |
| All badges bordered pills | status + level + env tags same size | Reserve color badges for level/regression |

### 7.2 “Everything same weight green”

| Anti-pattern | Example | Fix |
|--------------|---------|-----|
| `accent-muted` for selection | occurrences, checkbox column, chips | Chips only |
| `text-accent` on active tab + chips + links | tabs, filter-chip, stack “→ More” | Tabs → ink; links keep accent |
| Accent left bar for info | snooze banner | Neutral strong border |

### 7.3 “Everything is an emergency”

| Anti-pattern | Example | Fix |
|--------------|---------|-----|
| Danger badge for `unresolved` | `issue-overview-panel` L102 | Neutral open state |
| Danger + warning both on regression | row `warning` badge + overview `error` | One semantic |
| Regression strip + context strip + badge | three danger cues | One strip per viewport |

### 7.4 “Primary variant exists but never ships”

`Button` default variant is `primary`, yet **zero** feature files pass `variant="primary"`. Design Lab labels the default button “Primary” while Issues ships Resolve as `secondary`. **Docs and product disagree.**

### 7.5 Opacity soup

Inline `bg-bg-subtle/30`, `/40`, `/50`, `/60`, `accent-muted/50`, `signal-muted/40` — five opacity steps with no semantic names. Consolidate to `--state-hover` and `--state-selected` tokens already in `tokens.css`.

---

## Principles

1. **One loud action per toolbar** — filled `primary` (forest) or lone `signal` (onboarding); never both in the same cluster.  
2. **Chartreuse is a signal, not a theme** — unread bar + at most one CTA per view.  
3. **Danger is exceptional** — regressions, faults, delete — not “issue is open.”  
4. **Accent is for “where” and “what filter”** — nav, tabs border, active chips — not row selection.  
5. **Surfaces step, not stack** — `bg` → `surface` → `surface-raised` → `bg-subtle` bands for sections.  
6. **Muted has floors** — `text-ink` > `text-ink-muted` > `text-subtle` (proposed); impact copy never on the floor.

---

## Anti-patterns (summary)

- Secondary-bordered Resolve next to secondary Snooze  
- `error` badge on default unresolved state  
- `accent-muted` as generic selection wash  
- Stat values and titles sharing `text-ink` without size/face differentiation  
- Active tab text in accent color (reads as CTA)  
- Section boundaries = hairline only on uniform `bg-surface`  
- `primary` variant defined but unused in product flows  

---

## Candidate patterns for Epure

| Pattern | Source | Apply |
|---------|--------|-------|
| **Single filled primary in header-right** | Sentry triage (borrow action placement, not color) | Resolve = `primary` in detail toolbar |
| **Calm stat row** | Plausible | Labels muted, values mono — but values stay loud via size not color |
| **Neutral open status** | Linear issue states | Unresolved = default chip, not red |
| **Left bar semantics** | Signal Room charter | Signal = unread; danger = regression; neutral = info |
| **Sticky raised action band** | Gmail/Linear detail | `surface-raised` behind Resolve row |

---

## Cross-references

- [ui-polish-visual-system.md](./ui-polish-visual-system.md) §3–4 — token gaps, state matrix (complementary; this doc owns **hierarchy** specifically)  
- [issue-detail-ux-research.md](./issue-detail-ux-research.md) — action placement; color ladder implements “actions where eyes land”  
- [components.md](../../../web/design/components.md) — button recipes to update after implementation  
- [error-classification-policy.md](./error-classification-policy.md) — level vs status semantics for badges  

---

## Open decisions (for spec/plan)

1. **Resolve = `primary` (forest) vs `signal` (chartreuse)?** Recommendation: **forest primary** in product; chartreuse stays unread + setup.  
2. **Impact strip promotion** — color only or also mono slash counts? Recommendation: `text-ink` + keep middot separators.  
3. **Tab active color** — `text-ink` vs `text-accent`? Recommendation: **ink text**, accent bottom border only.  

*No implementation in this pass.*
