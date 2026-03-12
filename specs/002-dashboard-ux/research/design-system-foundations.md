# Design system foundations — research report

**Status:** Research complete (2026-09-14)  
**Scope:** Foundational layer only — color, typography, spacing/density, motion, token architecture  
**Audience:** `web/design/` maintainers, kit authors, 002-dashboard-ux implementers  
**Inputs:** [web/design/tokens.css](../../../web/design/tokens.css) · [web/design/tokens.json](../../../web/design/tokens.json) · [web/design/qa.md](../../../web/design/qa.md) · [charter.md](../charter.md) · audit dossiers ([hierarchy-color-semantics.md](./hierarchy-color-semantics.md) · [hierarchy-typography-scale.md](./hierarchy-typography-scale.md) · [hierarchy-spatial-zoning.md](./hierarchy-spatial-zoning.md) · [ui-polish-visual-system.md](./ui-polish-visual-system.md) · [plausible-patterns.md](./plausible-patterns.md))  
**Constraint:** Research only — no implementation, no JSX, no token file edits in this pass

---

## Executive summary

Epure’s **Signal Room identity is the right north star**: warm instrument paper, forest structure, phosphor punctuation — emotionally aligned with Plausible’s calm efficiency for developer tools. The foundations are **conceptually sound but architecturally under-specified**: flat semantic tokens without ramps, a green family that bleeds across roles, a type scale that collapses in practice, and surfaces that don’t step.

**Foundations thesis:** A polished developer dashboard is built on **role-first tokens**, not color-first tokens. Neutrals carry 90% of the UI; accent carries structure; signal carries attention; semantics carry exception state. Everything else is metadata.

| Audit finding | Root cause | Foundations fix |
|---------------|------------|-----------------|
| **Too many greens** | `--accent`, `--accent-muted`, `--success`, `--focus-ring`, selection washes, and dark-mode accent share the same hue family (~145–155°) | Split **brand** (forest), **state** (neutral wash), and **semantic** (success) into separate ramps; never tint selection with accent-muted |
| **Flat surfaces** | `--surface` vs `--surface-raised` ΔL ≈ 0.5%; everything is `bg-surface` + hairlines | Three-tier **surface ladder** with ≥4 OKLCH lightness steps; hairlines *within* tiers, steps *between* tiers |
| **xs/sm type collapse** | `2xs`–`sm` span only 2px (11→13px); 94% of UI uses those two steps | **Role-based type map** with enforced minimum 4px jump between hierarchy levels; retire `2xs` from body/meta |
| **Chartreuse harsh at scale** | `#B8E000` at C≈0.22, L≈0.84 — fine at 2px bar, fatiguing at button fill or bulk wash | **Signal ramp** with stepped chroma: bar = full chroma, CTA fill = −15% chroma, wash = −40% chroma + neutral mix |

**Deliverable shape:** This document defines the *foundations layer* that polish/hierarchy dossiers assumed but never authored — ramps, OKLCH authoring workflow, role contracts, and token taxonomy. Implementation slices remain V1–V6 in [ui-polish-visual-system.md](./ui-polish-visual-system.md).

---

## 1. Emotional tone & design intent

### 1.1 Target feeling

| Dimension | Plausible-like target | Epure expression |
|-----------|----------------------|------------------|
| **Emotional register** | Calm confidence — “your data is here, nothing is on fire unless it is” | Warm paper studio, not cold datacenter |
| **Cognitive load** | Low — scan in 5 seconds (charter J2) | Compact rows, plain labels, no query syntax on surface |
| **Trust** | Credible, not playful | No mascots, no confetti, typographic empty states |
| **Instrumentality** | Tool, not brand billboard | Mono for inspect surfaces; sans for scan surfaces |
| **Memorability** | One signature, not a theme | Phosphor unread bar + forest primary — everything else quiet |

### 1.2 Signal Room mix (unchanged)

From `tokens.json` meta: **75% Signal Room** (warm paper, forest, phosphor) + **25% Plausible shape** (summary strip, click-to-filter, verification ritual). Foundations preserve the mix; they fix *how* tokens express it.

### 1.3 What “calm efficient” means in token terms

1. **Luminance does hierarchy** — size and weight second, color third.
2. **Chroma is budgeted** — high chroma only on ≤2% of pixels (unread bar, one CTA).
3. **Green is not a default wash** — selection and hover are **neutral**, not forest-tinted.
4. **Danger is rare and real** — semantic red only for live exception state, not decorative chrome.

---

## 2. Color system

### 2.1 Why OKLCH for authoring

Current tokens are **hex-authored** in `tokens.css`. That works for shipping but makes systematic ramps painful — especially warm neutrals and perceptually uniform dark mode.

**Recommendation:** Author palettes in **OKLCH**, compile to hex (or `oklch()` with hex fallback) in `tokens.css`. Rationale:

| Property | Benefit for Epure |
|----------|-------------------|
| **Perceptual lightness** | Surface ladder steps of ΔL 0.03–0.05 read evenly in light and dark |
| **Hue consistency** | Warm paper neutrals stay on one hue angle (~95–105° yellow-green stone) |
| **Chroma control** | Tame chartreuse for fills without guessing hex |
| **Dark mode parity** | Flip L, hold hue family, reduce C — avoids “gray mud” or “neon accent” |
| **Accessibility** | Target L pairs for AA: body text ΔL ≥ 0.45 from background |

**Runtime contract unchanged:** Components consume `var(--surface)`, never `oklch(...)`. OKLCH lives in the build/authoring layer (`tokens.json` or a future `tokens.oklch.json`).

**Browser support (2026):** OKLCH is baseline in Chromium, Safari, Firefox. Epure can ship `color: oklch(...)` with hex custom-property fallback if desired; Phase 1 can stay hex-only with OKLCH as the *source of truth in JSON*.

### 2.2 Neutral ramp (warm stone / pine charcoal)

Neutrals are the **primary color system**. Brand green should never substitute for a neutral.

**Light mode — hue anchor H ≈ 100° (warm stone), C ≈ 0.01–0.02**

| Step | Role | OKLCH (authoring) | Hex (compiled) | Maps to current |
|------|------|-------------------|----------------|-----------------|
| `neutral-0` | App canvas | `oklch(97.5% 0.012 100)` | `#f7f6f1` | `--bg` ✓ |
| `neutral-1` | Hover / inset | `oklch(93.5% 0.014 100)` | `#eceae2` | `--bg-subtle` ✓ |
| `neutral-2` | Panel default | `oklch(99.5% 0.006 100)` | `#ffffff` | `--surface` ✓ |
| `neutral-3` | Raised panel | `oklch(98.8% 0.010 100)` | `#f9f8f4` | **new** — replaces imperceptible `--surface-raised` |
| `neutral-4` | Border hairline | `oklch(82% 0.018 100)` | `#c8c4b8` | `--border` ✓ |
| `neutral-5` | Border strong | `oklch(62% 0.022 100)` | `#8b8678` | `--border-strong` ✓ |
| `neutral-12` | Primary text | `oklch(18% 0.02 155)` | `#121714` | `--text` ✓ (slight pine bias) |
| `neutral-11` | Secondary text | `oklch(38% 0.025 150)` | `#3d4a40` | `--text-muted` ✓ |
| `neutral-10` | Tertiary text | `oklch(48% 0.018 145)` | `#5c665c` | **new** `--text-subtle` |
| `neutral-13` | Inverse text | `oklch(97.5% 0.012 100)` | `#f7f6f1` | `--text-inverse` ✓ |

**Dark mode — same hue family, inverted L, C × 0.6 on borders**

| Step | OKLCH | Hex | Maps to |
|------|-------|-----|---------|
| `neutral-0` | `oklch(14% 0.015 155)` | `#121714` | `--bg` |
| `neutral-1` | `oklch(17% 0.014 155)` | `#1a1f1c` | `--bg-subtle` |
| `neutral-2` | `oklch(20% 0.012 155)` | `#212623` | `--surface` |
| `neutral-3` | `oklch(23% 0.012 155)` | `#2a302c` | **raised** — visible step |
| `neutral-4` | `oklch(30% 0.014 155)` | `#343c36` | `--border` |
| `neutral-11` | `oklch(72% 0.02 145)` | `#9aa89c` | `--text-muted` |

**Key fix — surface ladder:** Light `neutral-3` must be **darker than** `neutral-2` (inset/raised card on white), OR use **shadowless elevation via background**: canvas `neutral-0` → panel `neutral-2` → inset well `neutral-1`. Epure’s hairline-only policy favors:

```
bg (neutral-0) → surface panel (neutral-2) → inset well (neutral-1) → raised sticky bar (neutral-3)
```

This inverts the current naming where `surface-raised` is lighter than `surface` — foundations recommend **renaming for clarity**:

| Token | Meaning |
|-------|---------|
| `--bg` | Canvas behind panels |
| `--surface` | Primary panel (list, detail, header) |
| `--surface-inset` | Code blocks, breadcrumb wells, filter chip hover |
| `--surface-elevated` | Sticky bulk bar, popover (still no shadow — one step lighter/darker) |

### 2.3 Brand ramp — resin forest (structure only)

Forest green is **brand structure**, not success, not selection, not focus-by-default.

**Hue anchor H ≈ 155° (pine/resin)**

| Step | Role | OKLCH (light) | Hex | Usage budget |
|------|------|---------------|-----|--------------|
| `brand-9` | Primary fill | `oklch(32% 0.06 155)` | `#1f3d32` | `--accent` — primary buttons, active tab underline |
| `brand-8` | Hover border | `oklch(26% 0.055 155)` | `#163028` | `--accent-hover-border` |
| `brand-2` | **Do not use for selection** | `oklch(92% 0.03 155)` | `#e2e6d8` | Retire as row wash — badge bg only |
| `brand-3` | Dark mode accent text | `oklch(72% 0.06 155)` | `#8fb89a` | Dark `--accent` for links/tabs — not fills |

**Anti-green-wash rule:** `--accent-muted` must **not** appear on:

- Selected list rows
- Active filter chips (use `--state-selected` neutral)
- Checkbox fills (use `--accent` solid only)

Dark mode: prefer **desaturated sage text** (`brand-3`) for links/tabs; **keep primary button fill** as `brand-9` darkened, not sage — sage-on-charcoal reads “disabled.”

### 2.4 Signal ramp — phosphor chartreuse (attention only)

Chartreuse is the **highest chroma token**. It must scale down by surface area.

| Step | Role | OKLCH | Hex | Max area |
|------|------|-------|-----|----------|
| `signal-9` | Bar / dot | `oklch(84% 0.22 123)` | `#b8e000` | ≤2px width, ≤8px diameter |
| `signal-8` | CTA fill | `oklch(80% 0.18 123)` | `#a8cc00` | One button per view |
| `signal-3` | Muted wash | `oklch(94% 0.08 123)` | `#e8f0c8` | Bulk row bg at ≤40% opacity |
| `signal-2` | Dark wash | `oklch(22% 0.06 123)` | `#2c3a18` | Dark bulk bg |

**Chartreuse at scale — rules:**

1. **Never** `bg-signal` on areas > 2% of viewport (button max).
2. **Never** full-opacity `signal-muted` on full row — use `signal-3` at 25–40% over `surface`.
3. **Unread bar** uses `signal-9` only; selected row uses **neutral** `--state-selected`, not signal.
4. **Dark mode:** keep bar at `signal-9`; CTA fill uses `signal-8` (slightly dimmer) for less glow bleed on charcoal.

**Contrast pairs (light):**

| Pair | Ratio | Verdict |
|------|-------|---------|
| `signal-9` on `neutral-0` | ~12:1 (hue) | ✓ bar/dot |
| `signal-9` on `neutral-2` | High | ✓ unread on row |
| `signal-contrast` (`neutral-12`) on `signal-8` | ~8:1 | ✓ CTA label |
| `signal-9` large text on `neutral-0` | Fatiguing | ✗ — chroma noise |

### 2.5 Semantic colors (exception vocabulary)

Semantics are **state**, not brand. They should not share hue with forest green.

| Token | OKLCH (light) | Hex | Role | Usage gate |
|-------|---------------|-----|------|------------|
| `--success` | `oklch(42% 0.08 145)` | `#2e5c3e` | Resolved, healthy, live dot | Status dot, resolved badge — **not** buttons |
| `--warning` | `oklch(52% 0.12 65)` | `#96601b` | Regression risk, level warn | Badge, left border — not toolbar |
| `--danger` | `oklch(48% 0.14 25)` | `#a63228` | Unresolved live exception | Badge, fault line — **QA: not decorative** |
| `--info` | `oklch(52% 0.06 230)` | `#3d5a7a` | **new** — snooze, neutral notice | Banners — replaces accent left bar for non-urgent |

**De-conflict from brand green:**

| Old collision | Fix |
|---------------|-----|
| `--success` ≈ `--accent` hue | Shift success **slightly yellower** (H 145→140) or **use neutral “resolved”** (muted ink + check icon) for calmer Plausible tone |
| Unresolved `error` badge + regression `warning` + danger strip | **Unresolved** = `danger` badge only; regression = `warning` border-l; no danger on open-issue default |
| Snooze banner `border-l-accent` | → `border-l-info` or neutral `border-l-border-strong` |

**Recommended calm path (Plausible-aligned):** Prefer **ink + icon** over color for resolved/snoozed; reserve chroma for **unresolved** and **regression** only.

### 2.6 Interactive state colors (neutral, not brand)

| Token | Light | Dark | Replaces |
|-------|-------|------|----------|
| `--state-hover` | `neutral-1` | `neutral-1` | ad-hoc `bg-subtle/40` |
| `--state-selected` | `oklch(91% 0.012 100)` `#e4e2d8` | `oklch(25% 0.012 155)` `#2a3530` | `accent-muted/70`, `bg-subtle` selection |
| `--state-pressed` | `oklch(89% 0.014 100)` | `oklch(22% 0.012 155)` | new — active press |
| `--focus-ring` | `brand-9` | `oklch(78% 0.08 155)` | 1px outline — **not** glow |

**Critical:** `--state-selected` must be **hue-neutral** (stone/pine gray), not `brand-2` green tint. This alone fixes much of the “too many greens” audit.

### 2.7 Dark mode strategy

| Principle | Implementation |
|-----------|------------------|
| **Not pure black** | Canvas `oklch(14% …)` — current `#121714` ✓ |
| **Reduced chroma on borders** | C × 0.7 vs light |
| **Phosphor unchanged on bar** | Brand continuity for unread |
| **Accent role split** | Links/tabs = sage text; buttons = deep forest fill |
| **Semantic shift** | Danger/warning +5% L for AA on charcoal |
| **No second chartreuse** | No extra signal fills in dark toolbars |

**Verification checklist:**

- [ ] `text-muted` on `surface-inset` ≥ 4.5:1
- [ ] `focus-ring` on `surface` ≥ 3:1 (non-text)
- [ ] `danger` badge on `surface` ≥ 4.5:1
- [ ] Selected row `state-selected` distinguishable from hover at arm’s length

### 2.8 Example palette — side-by-side

**Light — role sample**

```
Canvas     ████  #f7f6f1  bg
Panel      ████  #ffffff  surface
Inset      ████  #eceae2  surface-inset
Border     ████  #c8c4b8  border
Text       ████  #121714  text
Muted      ████  #3d4a40  text-muted
Subtle     ████  #5c665c  text-subtle (new)
Forest     ████  #1f3d32  accent (primary btn)
Chartreuse ████  #b8e000  signal (2px bar only)
Danger     ████  #a63228  danger (badge)
```

**Dark — role sample**

```
Canvas     ████  #121714  bg
Panel      ████  #212623  surface
Inset      ████  #1a1f1c  surface-inset
Raised     ████  #2a302c  surface-elevated
Sage link  ████  #8fb89a  accent (text/tabs)
Chartreuse ████  #b8e000  signal (bar)
```

---

## 3. Typography

### 3.1 Font stack (canonical)

| Role | Family | Rationale |
|------|--------|-----------|
| **UI sans** | IBM Plex Sans | Instrument credibility; matches `tokens.css` + `tokens.json`; distinct from Inter/Geist |
| **Data mono** | IBM Plex Mono | DSN, stack, counts, section micro-labels |
| **Docs serif** | IBM Plex Serif | Markdown export, long-form settings copy only |

**Decision:** IBM Plex is the **only** sans. No Manrope drift. Weights **400** (body) and **500** (emphasis) only in product UI; **600** reserved for marketing if ever split.

### 3.2 Scale architecture — fix xs/sm collapse

**Problem:** `2xs` (11px) · `xs` (12px) · `sm` (13px) are **1px apart** — below human foveal discrimination at dashboard density. Meanwhile `md` (14px) is unused in components.

**Foundations scale — 4px rhythm, minimum 1px step at small end, 2px from sm upward**

| Token | Size | Leading | px | Role |
|-------|------|---------|-----|------|
| `2xs` | 0.6875rem | 1rem | 11 | **Micro only** — rail section labels, prod badge |
| `xs` | 0.75rem | 1.125rem | 12 | Meta, timestamps, badge text, toolbar buttons |
| `sm` | 0.875rem | 1.375rem | 14 | **Default UI** — body, controls, row titles, tabs |
| `md` | 0.9375rem | 1.5rem | 15 | Secondary body, descriptions |
| `lg` | 1.0625rem | 1.625rem | 17 | List context title, dialog titles |
| `xl` | 1.25rem | 1.75rem | 20 | Issue detail title |
| `2xl` | 1.5rem | 2rem | 24 | Page title |
| `3xl` | 2rem | 2.375rem | 32 | Stat values |
| `4xl` | 2.75rem | 3rem | 44 | Marketing only |
| `5xl` | 3.5rem | 3.75rem | 56 | Marketing only |

**Key change:** Bump **`sm` to 14px** (was 13px) and **`xs` leading to 1.125** — restores clear gap between meta (12px) and body (14px). Retire using `sm` and `xs` interchangeably.

### 3.3 Type roles (enforced)

| Role | Token | Weight | Face | Tracking | Example |
|------|-------|--------|------|----------|---------|
| `display` | `2xl` | 500 | sans | `tracking-ui` | Settings, Releases page h1 |
| `title` | `xl` | 500 | mono | `tracking-ui` | Issue detail headline |
| `title-compact` | `lg` | 500 | sans | `tracking-ui` | “Unresolved” list header |
| `body` | `sm` | 400 | sans | normal | Default copy, form labels |
| `body-strong` | `sm` | 500 | sans | normal | Row titles, tab labels |
| `section` | `xs` | 500 | mono | `wide` (0.04em) | `STACK TRACE`, `MEMBERS` |
| `meta` | `xs` | 400 | sans | normal | Last seen, hints |
| `meta-mono` | `xs` | 400 | mono + slashed-zero | normal | Counts inline, versions |
| `data` | `3xl` | 500 | mono + slashed-zero | tight | Stat bar values |
| `micro` | `2xs` | 500 | mono | `wide` | Rail `PROJECT` label |

**Hierarchy rule — two jumps minimum:**

```
display (24px) → title-compact (17px) → body (14px) → meta (12px)
                      ↓
               title (20px mono) in detail only
```

Never place **same size + same weight** on page title, tab, and row title (current failure mode).

### 3.4 Sans vs mono contract

| Mono required | Sans required |
|---------------|---------------|
| DSN, API keys | Issue list row titles |
| Stack frames, paths | Body paragraphs |
| Versions, release tags | Buttons, tabs |
| Stat bar values | Page titles |
| Section micro-labels (uppercase) | Descriptions |
| Fingerprints, hashes | Banner sentences |

### 3.5 Typography anti-patterns

- `text-[9px]` / `text-[10px]` — use `2xs`
- `text-sm` for both row title and section heading — section uses `section` role
- `font-semibold` (600) in product chrome — use 500 only
- Mono paragraph prose in overview panels

---

## 4. Spacing & density

### 4.1 Spatial philosophy

Plausible’s calm comes from **predictable vertical bands** and **consistent gutters**, not generous whitespace. Epure is **compact-first** (Sentry row density × Plausible emotional calm).

### 4.2 Space scale (unchanged values, clarified roles)

| Token | Value | Role |
|-------|-------|------|
| `--space-1` | 4px | Icon gap, chip internal |
| `--space-2` | 8px | Row vertical padding, inline clusters |
| `--space-3` | 12px | Row horizontal padding, form field gap |
| `--space-4` | 16px | Card padding (`p-4`), section gutter |
| `--space-5` | 20px | Section gap (between blocks) |
| `--space-6` | 24px | Panel header band |
| `--space-7` | 32px | Page section separation |
| `--space-8` | 48px | Empty state breathing |
| `--space-9` | 64px | Marketing only |

**Rule:** Issues triage uses **1–4 only**. 5+ is settings/marketing.

### 4.3 Density tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--row-height` | 36px (2.25rem) | Issue list row |
| `--chrome-top-height` | 40px | Top strip |
| `--chrome-page-header-height` | 48px | Page header band |
| `--chrome-filter-height` | 40px | Filter row |
| Control height | 32px (`h-8`) | Button, input, select |
| Toolbar control | 28px (`h-7`) | Detail toolbar |

**Phase 1:** Single density — no user toggle. Optional `[data-density="comfortable"]` preset (row 44px, controls 36px) for settings prose — token-only, not exposed.

### 4.4 Spatial zoning (surface + padding)

From [hierarchy-spatial-zoning.md](./hierarchy-spatial-zoning.md) — foundations endorsement:

```
┌─ surface-elevated ─ header band (space-4 padding) ─────────┐
├─ surface ─ list | detail ────────────────────────────────────┤
│   ├─ section: space-4 padding, section label (xs mono)      │
│   ├─ surface-inset: code, breadcrumbs (space-3)             │
│   └─ hairline divide within section only                    │
└─ bg ─ canvas visible in gutters ─────────────────────────────┘
```

**Between** major zones: change **surface step** OR **space-5** gap — not both hairline + same surface.

### 4.5 Geometry

| Token | Value | Rule |
|-------|-------|------|
| `--radius-sm` | 2px | Badges |
| `--radius-md` | 4px | Buttons, inputs |
| `--radius-lg` | 6px | Cards — **max** |
| `--border-width` | 1px | Hairlines only |

No pills on primary controls. `rounded-full` — avatar only.

---

## 5. Motion & polish

### 5.1 Motion principles

| # | Principle | Epure expression |
|---|-----------|------------------|
| 1 | **State change only** | Motion confirms action, never decorates idle UI |
| 2 | **Mechanical, not playful** | `ease-mechanical` for panels; no spring/bounce |
| 3 | **Sub-200ms** | Triage must feel instant |
| 4 | **Reduced motion = off** | `prefers-reduced-motion` zeroes durations ✓ |
| 5 | **No stagger** | List items appear together |

### 5.2 Duration & easing tokens

| Token | Value | Use |
|-------|-------|-----|
| `--duration-fast` | 80ms | Hover, press, focus |
| `--duration-base` | 120ms | Tab swap, chip toggle |
| `--duration-panel` | 160ms | Toast, dialog overlay |
| `--ease-mechanical` | `cubic-bezier(0.16, 1, 0.3, 1)` | Slide, expand |
| `--ease-out-soft` | `cubic-bezier(0, 0, 0.2, 1)` | Fade |

### 5.3 Approved micro-interactions

| Interaction | Spec |
|-------------|------|
| Row hover | `background-color` 80ms |
| Row press | `state-pressed` 80ms |
| Tab content | opacity 0→1, 120ms |
| Toast | translateY(8px)+opacity, 160ms, auto-dismiss 4s |
| Copy button | icon swap 120ms |
| Skeleton | opacity oscillation on neutral-1↔neutral-4, no shimmer gradient |
| Dialog overlay | opacity 80ms, no blur |

### 5.4 Refused motion

Staggered list load, chart draw-in, confetti, parallax, `backdrop-filter` blur, elastic buttons, skeleton shimmer gradients.

### 5.5 Polish without motion

- **Shape-matched skeletons** (row layout fidelity)
- **Optimistic resolve** (state before refetch)
- **Copy toast closure** (Plausible verification rhythm)
- **Consistent focus ring** (1px, no glow)

---

## 6. Token architecture

### 6.1 Current state

```
tokens.css          → runtime CSS variables (hex)
tokens.json         → partial mirror + meta (drift on xl size, weights)
tailwind.theme.cjs  → Tailwind mapping
```

**Problems:** No ramps, semantic aliases mixed with primitives, `tokens.json` ↔ `tokens.css` drift, state tokens not in Tailwind theme.

### 6.2 Recommended taxonomy (three layers)

```
Layer 0 — Primitives (authoring, OKLCH ramps)
  neutral.0–12, brand.1–9, signal.1–9, semantic.{success,warning,danger,info}
  light/dark overrides

Layer 1 — Semantic aliases (runtime CSS vars — components reference ONLY these)
  --bg, --surface, --text, --accent, --signal, --danger, --state-hover, …

Layer 2 — Component recipes (documentation + CVA)
  button.primary → bg-accent
  issue-row.selected → bg-state-selected
```

### 6.3 File structure recommendation

| File | Purpose |
|------|---------|
| `tokens/primitives.oklch.json` | Ramps, light/dark, single source of truth |
| `tokens/semantic.json` | Maps primitive steps → `--bg`, `--surface`, etc. |
| `tokens.css` | **Generated** or hand-synced hex output |
| `tokens.json` | Meta + tooling (Figma, design lab) |
| `tailwind.theme.cjs` | Unchanged pattern — maps to Layer 1 |

**Phase 1 pragmatic path:** Keep hand-edited `tokens.css` but add `primitives` section in `tokens.json` with OKLCH values + compiled hex comments. Script can come later.

### 6.4 Naming conventions

| Pattern | Example | Rule |
|---------|---------|------|
| Surface | `--surface`, `--surface-inset` | Noun, no color hue in name |
| Text | `--text`, `--text-muted`, `--text-subtle` | Ink hierarchy |
| Brand | `--accent`, `--accent-contrast` | Not `--green-*` |
| Signal | `--signal`, `--unread-bar` | `--unread-bar` aliases `--signal` |
| State | `--state-hover`, `--state-selected` | Interactive, neutral hue |
| Semantic | `--danger`, `--warning`, `--success` | Exception vocabulary |
| Layout | `--row-height`, `--chrome-*` | Chrome-specific |

**Forbidden in components:** `--brand-5`, `--neutral-3`, `--green-500`, Tailwind default palette.

### 6.5 Tailwind theme gaps to close

Add to `tailwind.theme.cjs`:

```js
// Proposed — research only
ink: { subtle: "var(--text-subtle)" },
surface: { inset: "var(--surface-inset)", elevated: "var(--surface-elevated)" },
semantic: { info: "var(--info)" },
```

Extend `fontSize` through `5xl` mapped to `--text-*` / `--leading-*`.

### 6.6 Governance

| Change type | Gate |
|-------------|------|
| Primitive ramp step | Design review + contrast check |
| New semantic alias | Requires use case in ≥2 components |
| Component one-off color | **Forbidden** — extend Layer 1 |
| shadcn CLI refresh | Re-verify CVA variants against tokens |

**QA:** [web/design/qa.md](../../../web/design/qa.md) + charter J5.

---

## 7. Cross-cutting fixes (audit → foundation mapping)

| Audit finding | Foundation section | Priority |
|---------------|-------------------|----------|
| Too many greens | §2.3 brand budget, §2.6 neutral states, §2.5 semantic de-conflict | P0 |
| Flat surfaces | §2.2 surface ladder, §4.4 zoning | P0 |
| xs/sm collapse | §3.2 scale bump, §3.3 roles | P0 |
| Chartreuse harsh | §2.4 signal ramp chroma steps | P1 |
| `accent-muted` on selection | §2.6 `--state-selected` | P0 |
| `surface-raised` imperceptible | §2.2 rename + OKLCH step | P1 |
| `tokens.json` drift | §6.2–6.3 architecture | P1 |
| Missing `--text-subtle` | §2.2 neutral-10 | P1 |

---

## 8. Implementation slices (foundations → polish)

Foundations inform existing V1–V6 plan:

| Slice | Foundations dependency |
|-------|------------------------|
| **V1 Token reconciliation** | §6 primitives in JSON, §2 OKLCH ramps compiled to hex |
| **V2 Typography roles** | §3 scale + role table → `components.md` |
| **V3 State harmonization** | §2.6 state tokens, §2.4 signal budget |
| **V4 Component reskin** | §2 surface ladder, §4 spacing |
| **V5 Motion** | §5 duration/easing |
| **V6 Dark mode** | §2.7 checklist |

**New foundation gate (proposed F1):** Design Lab swatch page shows neutral ramp, surface ladder, signal chroma steps, and type role specimens before V4 ships.

---

## 9. Principles

1. **Neutrals are the system** — brand and signal are accents on stone, not the default wash.
2. **OKLCH authors, hex ships** — perceptual ramps without runtime complexity.
3. **Roles before values** — `section` / `meta` / `data` tokens, not “use `text-sm`.”
4. **Two size jumps** — hierarchy requires ≥4px between adjacent levels.
5. **Chroma is area-budgeted** — chartreuse shrinks as fill area grows.
6. **Hairlines within, steps between** — surface ladder carries zones; borders carry rows.
7. **Motion proves state** — 80–160ms mechanical; nothing else.

## 10. Anti-patterns

| Anti-pattern | Why |
|--------------|-----|
| Green tint for selection | Reads “active brand” on every row — green fatigue |
| `signal` CTA + unread bar in same band | Two chartreuse anchors compete |
| 11/12/13px trio for body/meta/title | Indistinguishable at scan distance |
| `surface` + `divide-y` only | Flat UI — no spatial memory |
| Hex literals in features | Drift from ramps |
| Stock shadcn zinc theme | Destroys Signal Room |
| Glow focus rings | Violates instrument tone |
| Success green on Resolve button | Conflicts with brand + semantic |

---

## 11. References

### Epure canonical

- [web/design/tokens.css](../../../web/design/tokens.css) — runtime tokens
- [web/design/tokens.json](../../../web/design/tokens.json) — meta + scale
- [web/design/README.md](../../../web/design/README.md) — layer cake
- [web/design/qa.md](../../../web/design/qa.md) — ship gate
- [web/design/components.md](../../../web/design/components.md) — recipes
- [charter.md](../charter.md) — Plausible emotional north star

### Epure research (building blocks)

- [hierarchy-color-semantics.md](./hierarchy-color-semantics.md) — green fatigue, action ladder
- [hierarchy-typography-scale.md](./hierarchy-typography-scale.md) — xs/sm collapse data
- [hierarchy-spatial-zoning.md](./hierarchy-spatial-zoning.md) — surface ladder
- [ui-polish-visual-system.md](./ui-polish-visual-system.md) — V1–V6 slices
- [plausible-patterns.md](./plausible-patterns.md) — calm pacing
- [ui-polish-peer-patterns.md](./ui-polish-peer-patterns.md) — density/feedback

### External — color & OKLCH

- [OKLCH in CSS (Lea Verou)](https://lea.verou.me/blog/2021/10/css-color-spaces-and-levels/) — perceptual ramps
- [oklch.com](https://oklch.com) — palette authoring
- [APCA contrast](https://apcacontrast.com/) — modern contrast (supplement WCAG)
- [Radix Colors](https://www.radix-ui.com/colors) — reference for stepped ramps + dark mode (adapt structure, not palette)
- [Tailwind CSS v4 OKLCH defaults](https://tailwindcss.com/docs/colors) — industry direction

### External — typography

- [IBM Plex type specimen](https://www.ibm.com/plex/) — canonical Epure stack
- [Butterick’s Practical Typography](https://practicaltypography.com/) — hierarchy fundamentals
- [Linear design refresh (2024)](https://linear.app/now/behind-the-latest-design-refresh) — compact hierarchy reference

### External — motion

- [IBM Carbon motion guidelines](https://carbondesignsystem.com/guidelines/motion/overview/) — duration buckets for enterprise tools
- [Material motion – easing](https://m3.material.io/styles/motion/easing-and-duration) — mechanical vs emphasized (refuse emphasized)
- [prefers-reduced-motion (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

### External — peer tone

- [Plausible guided tour](https://plausible.io/docs/guided-tour) — calm dashboard IA
- [Plausible 2025 UI polish (changelog)](https://plausible.io/blog) — spacing/shadow reduction reference

---

## 12. Open decisions (for ratification)

| ID | Question | Recommendation |
|----|----------|----------------|
| D-F1 | Keep `--success` green or neutral resolved state? | **Neutral resolved** for Plausible calm; keep `--success` for live dot only |
| D-F2 | Bump `sm` to 14px (breaking)? | **Yes** — one-time row height QA |
| D-F3 | Rename `surface-raised` → `surface-elevated` + add `surface-inset`? | **Yes** — clarifies ladder |
| D-F4 | OKLCH in CSS runtime or JSON-only authoring? | **JSON authoring, hex runtime** for Phase 1 |
| D-F5 | Add `--info` semantic for snooze banners? | **Yes** — removes accent-bar overuse |

---

*Research only. No files were modified outside this dossier.*
