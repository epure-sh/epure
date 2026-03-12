# UI polish — visual system research

**Status:** Research complete (2026-09-13)  
**Scope:** Visual layer only — typography, color, states, motion, density  
**Inputs:** [charter.md](../charter.md) · [design/VERDICT.md](../../../../design/VERDICT.md) · [design/SYSTEM.md](../../../../design/SYSTEM.md) · [web/design/tokens.css](../../../web/design/tokens.css) · [web/design/qa.md](../../../web/design/qa.md) · audited `ui/` + `shell/` primitives  
**Constraint:** Token names only in deliverables — no hex in JSX; no stock shadcn zinc theme

---

## Executive summary

Epure’s **Signal Room identity is real and defensible**: warm paper surfaces, resin-forest structure, phosphor chartreuse as a sparing signal. The palette already separates Epure from generic SaaS purple-zinc dashboards.

What keeps it from feeling **super polished** today is not missing color ideas — it is **implementation drift**: two token sources, two typography stacks, two focus systems, and shadcn defaults leaking through geometry and shadows. The product reads as “correct kit, uneven finish” rather than “sharp instrument.”

**Polish thesis:** Restrain boldness to **one signature** (phosphor unread bar + tabular counts). Everything else gets quieter, tighter, and more consistent. Beauty = restraint per [VERDICT.md](../../../../design/VERDICT.md) and [metrics-layout-verdict.md](./metrics-layout-verdict.md).

---

## 1. Current visual identity assessment

### What works

| Strength | Evidence |
|----------|----------|
| Distinct palette | `--bg` warm paper, `--accent` resin forest, `--signal` phosphor chartreuse — not interchangeable with shadcn zinc |
| Instrument metaphor | Mono for stacks, DSN, counts; slashed-zero on stat bar |
| Calm chrome | Rail + top strip + master-detail; accent stays under ~10% on issue list |
| Empty states | Typographic (`0 UNRESOLVED EXCEPTIONS`) — no mascot |
| Motion baseline | `duration-fast` + `transition-colors` on rows, nav, chips |

### What feels unfinished (honest)

| Gap | Symptom | Severity |
|-----|---------|----------|
| **Token fork** | Repo `design/tokens.css` (IBM Plex, 2/4/6px radius, 2px outline focus) vs app `web/design/tokens.css` (Manrope, `--radius: 0.5rem`, box-shadow focus). `@design` alias resolves to **app-local** copy — canonical docs and runtime disagree | **P0** |
| **Typography identity split** | `tokens.json` meta says IBM Plex Sans; runtime `--font-sans` is Manrope; Design Lab labels Manrope explicitly | **P0** |
| **COMPONENTS.md vs shipped row** | Recipe: issue title `--font-mono` `--text-sm`; shipped `IssueRow` uses sans `font-medium`. Unread: recipe 2px `--signal`; shipped 3px `--accent` left bar | **P1** |
| **shadcn geometry creep** | Buttons/cards use `rounded-md` tied to 8px `--radius`; QA + VERDICT cap at 4–6px. Controls feel slightly “SaaS default” vs “instrument” | **P1** |
| **Dual focus systems** | `.focus-ring` (tokens.css box-shadow) vs `focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]` on Button/Input/Select. Visual weight differs per control | **P1** |
| **Shadow policy drift** | `web/design/qa.md`: no shadow on cards/popovers/dialogs. `Card`, `Dialog`, `Input`, `Button` primary, `Toast` use `shadow-sm`/`shadow-md` | **P1** |
| **Tailwind scale gap** | `tailwind.config.ts` extends `fontSize` only through `2xl`; `StatBar` uses `text-3xl` — falls back to Tailwind default, not `--text-3xl` token pair | **P2** |
| **Toast as inline block** | Each feature mounts `<Toast>` locally; no enter/exit, no fixed anchor, no auto-dismiss contract | **P2** |
| **Skeleton fidelity** | `IssueRowSkeleton` uses two generic bars; doesn’t mirror title/meta/lastSeen layout or row height rhythm | **P2** |
| **Ad-hoc type sizes** | `text-[10px]`, `text-[9px]` in rail nav badges — outside token scale | **P2** |
| **Semantic color underuse** | `--success` rarely surfaces in UI chrome (status dot spec in COMPONENTS not wired consistently); `--surface-raised`, `--accent-hover-border` defined but idle | **P3** |

### Identity read (one sentence)

> Warm paper + forest structure reads **calm and credible**; phosphor signal reads **sharp** when used — but Manrope-at-8px-radius + mixed shadows make it feel **80% bespoke, 20% shadcn template**, which blocks “super polished.”

---

## 2. Typography scale recommendations

### Roles (assign once, use everywhere)

| Role | Token / class | Face | Weight | Use |
|------|---------------|------|--------|-----|
| **Page title** | `--text-2xl` / `text-2xl` | sans (display) | medium | Settings, Releases, Setup page headers |
| **Section title** | `--text-sm` + mono | mono | medium | Panel headings (`Stack`, `Members`, Design Lab sections) |
| **Body** | `--text-md` (base on `body`) | sans | regular | Default UI copy |
| **Control label** | `--text-sm` | sans | medium | Buttons, tabs, nav items |
| **Meta / secondary** | `--text-xs` | sans | regular | Last seen, hints, descriptions |
| **Micro label** | `--text-xs` uppercase tracking-wide | mono | medium | Rail section labels (`PROJECT`) — replace `text-[10px]` with token |
| **Data / count** | `--text-3xl` + `font-mono-slash` | mono | medium | Stat bar values |
| **Code / DSN / version** | `--text-xs` or `--text-sm` | mono | regular | DSN keys, release version, stack frames, fingerprints |
| **Issue list title** | `--text-sm` | **sans** medium *(recommended)* | Scan speed for P1; mono reserved for detail header per COMPONENTS | Row primary line |
| **Issue detail title** | `--text-xl` | mono | medium | Detail header — matches COMPONENTS “instrument” moment |

**Decision:** Keep **sans on list rows** (Plausible scan speed) but enforce **mono on detail title** — resolves COMPONENTS vs shipped conflict without sacrificing J2 “five-second scan.”

### Scale fixes (token layer)

1. **Pick one sans stack** — recommend **IBM Plex Sans** (canonical `design/tokens.css`, VERDICT IBM Plex specimen) OR commit to Manrope and update repo docs + `tokens.json` meta. Do not ship both.
2. **Extend Tailwind `fontSize`** through `3xl`–`5xl` mapped to `--text-*` / `--leading-*` (stat bar, marketing-adjacent empty states).
3. **Add `--text-2xs`** (0.6875rem / 11px) for rail micro-labels instead of arbitrary `[10px]`.
4. **Enforce `tracking-ui`** on explicit sans headings (`PageHeader`, stat labels) — already on some, missing on others.
5. **Mono scope QA gate:** DSN, stack, hash, version, counts, keyboard hints — mono only; never mono for paragraph prose.

### Version / release mono pattern

```
Release row:  font-mono text-sm     → v1.4.2
Meta strip:   font-mono-slash text-xs → 1,024 events · 3 users
Stat bar:     font-mono-slash text-3xl → 42
```

---

## 3. Color & contrast (semantic token usage gaps)

### Palette roles (correct usage)

| Token | Intended role | Current gaps |
|-------|---------------|--------------|
| `--bg` / `--bg-subtle` | App canvas / hover wash | Good; hover opacities inconsistent (`/40`, `/60`, `/70`) |
| `--surface` / `--surface-raised` | Cards, panels | `surface-raised` unused — detail panels could step up one surface level |
| `--accent` | Structure: primary buttons, active tab, rail marker | Good restraint; unread bar uses accent instead of signal |
| `--signal` | **Unread**, primary CTA (marketing), bulk-select wash | Underused for unread; bulk select correctly uses `signal-muted` |
| `--accent-muted` | Selected issue row | Works but heavy vs `--bg-subtle` in COMPONENTS |
| `--semantic-*` | Live exception semantics only | Badges good; `--success` not wired to env-live dot |
| `--focus-ring` | Keyboard focus | Same as accent — OK light mode; verify 3:1 against `--surface` dark mode |

### Recommended token additions (names only)

| Token | Purpose |
|-------|---------|
| `--text-subtle` | Tertiary meta (snoozed suffix, disabled hints) — between muted and border |
| `--state-hover` | Single hover wash (`--bg-subtle` at fixed opacity) — replace five inline `/40` variants |
| `--state-selected` | List selection background — unify row + stat chip |
| `--unread-bar` | Alias to `--signal` — makes unread semantics explicit in JSX |

### Contrast audit notes

- **Phosphor on warm paper** (`--signal` on `--bg`): fine for bars/badges; avoid large signal fills (chartreuse fatigue).
- **`--text-muted` on `--bg-subtle`** (selected rows): re-check WCAG AA for meta lines; may need `--text-muted` darkened 5% in light mode only.
- **Dark mode accent** (`#8FB89A` sage): softer than light forest — intentional; keep phosphor signal unchanged for continuity.
- **Danger** stays exception-only — stack fault lines and error badges already comply; do not use for destructive button fill (outline pattern is correct).

---

## 4. Interactive states — consistency audit

### State matrix (target)

| Surface | Default | Hover | Focus | Selected / active | Disabled |
|---------|---------|-------|-------|-------------------|----------|
| **Button primary** | `bg-accent` | `bg-accent/90` or border darken | unified `.focus-ring` | n/a | `opacity-50` |
| **Button secondary** | border + transparent | `bg-bg-subtle/40` | unified | n/a | `opacity-50` |
| **Issue row** | `bg-surface` | `bg-bg-subtle` | `.focus-ring` | `bg-state-selected` | n/a |
| **Issue row unread** | + 2px `border-l-unread-bar` | same hover | same | selected overrides bar | n/a |
| **Issue row bulk** | `bg-signal-muted/40` | `/55` | `.focus-ring` | n/a | n/a |
| **Stat bar chip** | transparent | `bg-bg-subtle` | `.focus-ring` | `bg-state-selected` | default cursor |
| **Nav rail item** | muted text | `bg-bg-subtle/60` | `.focus-ring` | `bg-bg-subtle` + accent rail tick | n/a |
| **Tabs** | muted | `text-ink` | `.focus-ring` | `border-accent` + `text-accent` | n/a |
| **Filter chip** | border surface | `bg-bg-subtle` | ring *(merge to focus-ring)* | filled border-strong | n/a |
| **Input / Select** | surface + border | subtle bg *(select only)* | **same as button** | n/a | `opacity-50` |

### Inconsistencies found

1. **Focus:** Button/Input use Tailwind ring; rows/nav use `.focus-ring` class — pick **one** (recommend 2px outline from canonical `design/tokens.css` — matches QA “1px accent border, no glow”).
2. **Selected row:** `accent-muted/70` vs COMPONENTS `--bg-subtle` — selected should feel **lifted**, not **green-tinted** (tint competes with unread signal).
3. **Unread indicator:** 3px accent bar → **2px signal bar** per COMPONENTS + charter Signal Room.
4. **Hover opacity soup:** consolidate to `--state-hover` token.
5. **Top strip avatar:** `rounded-full` — acceptable for user avatar only; keep forbidden on primary actions per VERDICT.
6. **Active stat bar:** only background change — add subtle `text-ink` weight bump or bottom hairline for clearer filter affordance.

---

## 5. Micro-interactions (transitions, toasts, skeleton quality)

### Motion tokens (align durations)

| Token | Canonical | App copy today | Recommend |
|-------|-----------|----------------|-----------|
| `--duration-fast` | 80ms | 100ms | **80ms** — snappier triage |
| `--duration-base` | 120ms | 150ms | **120ms** |
| `--duration-panel` | 160ms | 200ms | **160ms** |
| `--ease-mechanical` | shared | shared | Keep — good for panel slide |
| `--ease-out-soft` | shared | shared | Keep — toasts, fades |

Add `@media (prefers-reduced-motion: reduce)` — set durations to `0ms`, disable `animate-pulse` shimmer alternatives.

### What to add (minimal, purposeful)

| Interaction | Spec | Rationale |
|-------------|------|-----------|
| **Toast enter/exit** | Fixed bottom-center; `translateY(8px)→0` + opacity; 160ms mechanical; auto-dismiss 4s | Copy actions need closure; inline toasts feel broken |
| **Toast stack** | Max 1 visible; queue or replace | Avoid feature-local clutter |
| **Row press** | Optional `active:bg-bg-subtle` 80ms | Triage feels tactile without bounce |
| **Panel swap** | Issue detail tab content: opacity 0→1, 120ms | Orientation without carousel drama |
| **Command palette** | Already modal — add overlay fade 80ms | Matches dialog |
| **Skeleton** | Shape-matched `IssueRowSkeleton` (title 60% width, meta 40%, lastSeen block right) | Reduces layout shift |
| **Skeleton motion** | Replace pure pulse with subtle **opacity oscillation** on `--bg-subtle`→`--border` | Less “generic shadcn skeleton” |
| **Copy feedback** | CopyButton → brief signal flash or check icon 120ms | Plausible copy milestone |

### What to refuse

- Staggered list load animations
- Chart draw-ins on home
- Confetti / success celebrations
- Parallax, blur-backdrop glass overlays
- Elastic/spring physics on buttons

---

## 6. Density modes — compact / comfortable?

### Current effective density

Already **compact-first**:

- `--row-height: 2.25rem` (36px)
- Controls `h-8` (32px) default
- Issue row `py-2`, master-detail list `30rem` width in app tokens
- Stat bar inline mode for header band

This matches charter: **Sentry row density × Plausible calm** — correct default for P1 triage and P3 keyboard flow.

### Recommendation

| Phase | Verdict |
|-------|---------|
| **Phase 1** | **No user-facing density toggle.** Ship one tuned compact mode via tokens (`--row-height`, `--space-*`, control heights). |
| **Phase 1b** | **Token preset only:** `[data-density="comfortable"]` raising row to `2.75rem`, `h-9` controls — for account/settings prose screens if needed. Not exposed in UI yet. |
| **Phase 2+** | Optional account preference if enterprise asks — never on first-run path. |

**Why not two modes now:** Density toggle doubles QA surface (J5 token QA), risks breaking keyboard triage proofs, and Plausible never exposed it — simplicity is the brand.

---

## 7. Polish slice plan V1–V6

Incremental slices — each ends with `web/design/qa.md` + design lab `/__design` check.

### V1 — Token reconciliation (foundation)

**Goal:** One source of truth; no doc/runtime drift.

- Collapse `web/design/tokens.css` ↔ repo `design/tokens.css` (per SYSTEM.md import path decision)
- Sync `tokens.json` meta fonts with CSS
- Resolve radius: **4px controls, 6px cards max** (VERDICT)
- Unify motion durations to canonical 80/120/160ms
- Add `--text-2xs`, `--state-hover`, `--state-selected`, `--unread-bar`

**Proof:** Design Lab swatches + typography section match canonical docs; zero diff in color values between copies.

### V2 — Typography roles

**Goal:** Predictable type hierarchy.

- Extend Tailwind `fontSize` through `5xl`
- Publish type role table in `web/design/components.md` (reference only)
- Replace arbitrary `text-[10px]` / `text-[9px]` with `--text-2xs`
- Apply mono/sans rules to `IssueRow`, detail header, `PageHeader`, stat labels

**Proof:** J2 — new user identifies issue title vs meta vs count without squinting.

### V3 — State harmonization

**Goal:** One hover, one focus, one selected.

- Single `.focus-ring` implementation across Button, Input, Select, FilterChip
- Row selected → `--state-selected`; unread → 2px `--unread-bar`
- Stat bar active state visible without relying on background alone
- Remove shadow from Card, Dialog, Input per QA *(or update QA if shadow kept only on floating toast)*

**Proof:** Tab through Issues home — focus ring visually identical on row, button, filter chip.

### V4 — Component reskin

**Goal:** Kit reads as Epure, not shadcn.

- **Button:** secondary uses `--border-strong`; primary flat (no shadow); signal variant for primary CTAs on setup
- **Card:** hairline only, `rounded-lg` = `--radius-lg`
- **Badge:** `--radius-sm`; mono xs for env/error
- **IssueRow:** align padding to `--space-2` `--space-3`; title sans sm; meta xs
- **StatBar:** tokenized `text-3xl`; clickable affordance polish
- **Empty:** dashed border-strong; mono sm title
- **CodeBlock / stack:** fault line matches COMPONENTS rgba fill spec via semantic tokens

**Proof:** Design Lab side-by-side screenshot; accent pixel budget still <10% on issue list.

### V5 — Motion layer

**Goal:** Micro-interactions feel intentional, not noisy.

- Toast portal + enter/exit + auto-dismiss contract in `ui/toast.tsx`
- Shape-faithful skeletons for row, stat, detail overview
- Tab panel cross-fade 120ms
- `prefers-reduced-motion` respected globally

**Proof:** Copy DSN → toast slides in, dismisses; loading issues shows row-shaped skeletons without jump.

### V6 — Dark mode + QA hardening

**Goal:** Ship-quality both themes.

- Audit contrast pairs in dark (`muted on subtle`, focus ring)
- Env live dot `--success` wired in top strip
- Run full `design/QA.md` + `web/design/qa.md` on Issues, Setup, Detail, Settings
- J5 token QA gate

**Proof:** Toggle `data-theme="dark"` — no pure black, phosphor signal preserved, no hex in JSX grep clean.

---

## 8. Anti-slop — what NOT to do

Hard refuses aligned with [VERDICT.md](../../../../design/VERDICT.md), [charter.md](../charter.md), [qa.md](../../../web/design/qa.md):

| Do not | Why |
|--------|-----|
| **Stock shadcn zinc/slate theme** | Violates constitution; erases Signal Room |
| **Hex in JSX** (`bg-[#…]`, inline styles for brand) | Drift machine; fails J5 |
| **Purple/indigo gradients, neon glow, glassmorphism** | Generic SaaS slop; VERDICT refuse |
| **Warm cream + terracotta + serif display** | AI default aesthetic; wrong instrument |
| **Manrope + Inter fallback “because startup”** | Pick Plex or commit to one sans — not both |
| **Capsule pills / radius > 6px on controls** | Consumer SaaS; breaks instrument thesis |
| **Danger red as brand wash** | Exception semantics only |
| **Mascot empty states, confetti, “All clear!” celebration** | Charter refuse |
| **Chart hero on Issues home** | [metrics-layout-verdict.md](./metrics-layout-verdict.md) — zero chart pixels |
| **Sparklines in rows** | Vanity; competes with list scan |
| **Floating blur modals / backdrop-filter** | Glass slop; use `--ink/20` overlay only |
| **Skeleton shimmer gradients** | shadcn trope; use token pulse |
| **Multiple shadow layers on cards** | QA refuse; Epure elevation = hairlines |
| **Default shadcn `ring-offset`, glowing focus** | Use accent outline only |
| **Density toggle in v1** | Doubles QA; Plausible didn’t need it |
| **Rebrand via feature CSS** | Extend `ui/` + tokens — never one-off screen hacks |

### The one aesthetic risk worth taking

**Phosphor chartreuse as unread + primary setup CTA only** — high chroma on warm paper is the memorable signature. Keep everything else quiet so the signal stays legible, not decorative.

---

## Principles

1. **One token source, one focus ring, one hover wash** — polish is consistency, not more variables.
2. **Sans scan, mono inspect** — list speed for P1; mono depth on detail, DSN, stack, counts.
3. **Signal sparingly** — phosphor marks unread and decisive actions; forest green structures.
4. **Hairlines over shadows** — elevation from surface steps and borders.
5. **Motion proves state change** — toast, tab, skeleton; never decorates idle chrome.

## Candidate patterns for Epure

| Pattern | Source | Adopt |
|---------|--------|-------|
| Tabular slashed-zero counts | Signal Room / IBM Plex | ✅ Stat bar, meta |
| 2px left unread bar | COMPONENTS + Sentry borrow | ✅ Fix width + signal token |
| Graphite toast block | COMPONENTS | ✅ Add motion + portal |
| Rail accent tick | Linear | ✅ Already in `rail-nav` |
| Plain stat bar, no charts | Plausible | ✅ Hold |
| Shape-matched skeleton | Linear/Plausible loading | ✅ V5 |
| Copy-toast milestone | Plausible setup | ✅ Setup + DSN flows |

## Anti-patterns

- Fixing polish by adding gradients or shadows “for depth”
- Per-screen `hover:bg-*` inventing new opacities
- Third sans font for “personality”
- shadcn CLI refresh overwriting CVA variants without token review

---

## References

- [design/VERDICT.md](../../../../design/VERDICT.md) — Signal Room 75% / Coastal Machine 25%
- [design/SYSTEM.md](../../../../design/SYSTEM.md) — layer cake + class rules
- [design/COMPONENTS.md](../../../../design/COMPONENTS.md) — component recipes (row, toast, buttons)
- [design/QA.md](../../../../design/QA.md) — ship gate
- [web/design/tokens.css](../../../web/design/tokens.css) — runtime tokens (today)
- [web/design/qa.md](../../../web/design/qa.md) — app QA extensions
- [metrics-layout-verdict.md](./metrics-layout-verdict.md) — restraint = beauty on home
