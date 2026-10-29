# Comprehensive Styling & Token Architecture Survey: Epure Web

**Author:** Survey Explorer 1 (Styling & Token Architecture)  
**Date:** 2026-10-28  
**Scope:** `web/` (`web/design/`, `web/src/styles/`, `web/src/app.css`, `web/tailwind.config.ts`, `web/src/components/ui/`, `web/src/components/kit/`, `web/src/ui/`)  
**Design Foundations:** Apple Design Guidelines & Emil Kowalski Design Engineering Principles  

---

## Executive Summary

Epure's web application implements a high-precision design system known as **Calm Ledger**, characterized by a warm paper ivory light theme, a matte obsidian dark theme, and a single indigo chroma (`#4F46E5`). The CSS architecture leverages **Tailwind CSS v4** (`@tailwindcss/vite` v4.1.12) paired with CSS Custom Properties and OpenType tabular numbers. 

All 109 unit and integration tests (`npm test`), TypeScript verification (`npm run typecheck`), ESLint (`npm run lint`), and production build (`npm run build`) pass cleanly with zero errors.

However, the architecture exhibits three key areas requiring refinement for Milestone R1:
1. **Physical Depth & Specular Rim Lighting:** While `.epure-surface-specular` exists in `app.css`, light-mode elevation currently collapses (`--surface`, `--surface-elevated`, and `--surface-raised` are all `#ffffff`), and cards/popovers lack consistent specular rim lighting catching top edges.
2. **Mobile Native & Touch Ergonomics:** No mobile viewport units (`100dvh`), `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, or `viewport-fit=cover` are configured, and inputs render at 12px (`text-xs`), triggering iOS Safari auto-zoom.
3. **Motion Physics & Interaction Feedback:** Buttons currently depress by only `translateY(0.5px)` rather than the tactile `:active scale(0.97)` mechanical depression with critically damped spring recovery, and dropdowns/popovers lack trigger-anchored transform origins.

---

## 1. Styling Architecture & File Inventory

### 1.1 CSS File Map & Import Hierarchy

There are exactly 5 CSS files across the project:

```
web/
├── design/
│   ├── tokens.css              (Layer 1: Type scale, space, motion tokens, layout dimensions)
│   └── themes/
│       ├── index.css           (Single line: @import "./calm-ledger.css";)
│       └── calm-ledger.css     (Layer 2: Canonical palette in OKLCH/Hex, Light & Dark mode tokens)
└── src/
    ├── styles/
    │   └── tokens.css          (Layer 3: Tailwind v4 Bridge, @theme inline, reset --color-*: initial;)
    └── app.css                 (Layer 4: Component utilities, specular rim, scrollbars, print/containment)
```

### 1.2 Import Call Graph & Execution Order

At runtime, both `web/src/main.tsx` and `web/playground/main.tsx` execute:

```ts
// 1. Initialise theme attribute and storage before React mount
initStyleTheme(); // Sets data-style="calm-ledger", data-theme="light"|"dark", class="light"|"dark"

// 2. Typeface imports (IBM Plex)
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

// 3. Design token layer
import "@design/tokens.css";      // -> imports themes/index.css -> calm-ledger.css

// 4. Tailwind v4 Semantic Bridge
import "./styles/tokens.css";     // @theme inline, semantic aliases, color resets

// 5. Global rules & micro-utilities
import "./app.css";               // @config "../tailwind.config.ts", .epure-surface-specular, .btn-tactile
```

### 1.3 Tailwind v4 & PostCSS Configuration

- **Vite Integration:** `web/vite.config.ts` loads `@tailwindcss/vite` plugin (v4.1.12). There is no standalone `postcss.config.js`.
- **Content Scanning:** Declared in `web/src/styles/tokens.css`:
  ```css
  @source "../**/*.{js,ts,jsx,tsx}";
  @source "../../playground/**/*.{js,ts,jsx,tsx}";
  ```
- **Tailwind Config Compatibility:** `web/tailwind.config.ts` extends `web/design/tailwind.theme.cjs` and is referenced via `@config "../tailwind.config.ts"` in `src/app.css`. It provides named dimensions for chrome rails (`rail: var(--chrome-rail-width)`), control heights, and font size/leading pairings.
- **Dark Mode Variant:** Declared via `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *, .dark, .dark *));` in `src/styles/tokens.css`.

---

## 2. Token Definitions, Color Schemes & Depth System

### 2.1 Palette Specifications

#### Light Mode ("The Paper Ledger")
- **Canvas / Background:** `--bg: oklch(0.985 0.002 240);` (`#FAFAF9` warm paper ivory)
- **Container Backing:** `--bg-subtle: oklch(0.965 0.004 240);` (`#F4F4F3`)
- **Card Surfaces:** `--surface: #ffffff;`
- **Inset Wells:** `--surface-inset: oklch(0.972 0.003 240);`
- **Elevated Surfaces:** `--surface-elevated: #ffffff;` *(identical to surface)*
- **Raised Surfaces:** `--surface-raised: #ffffff;` *(identical to surface)*
- **Borders:**
  - Hairline: `--border: rgba(26, 22, 18, 0.08);`
  - Strong: `--border-strong: rgba(26, 22, 18, 0.16);`
- **Typography:**
  - Primary text: `--text: oklch(0.140 0.008 240);` (L=14%, deep charcoal ink)
  - Muted secondary: `--text-muted: oklch(0.440 0.012 240);` (L=44%)
  - Subtle meta: `--text-subtle: oklch(0.600 0.010 240);` (L=60%)
- **Chroma & Accents:**
  - Single indigo accent: `--accent: #4f46e5;`
  - Accent wash: `--accent-muted: #eceafd;`
  - Signal: `--signal: var(--accent);` *(enforces 1 chroma rule)*
- **Semantic Signals:**
  - Success: `--success: #0d7a62;`
  - Warning: `--warning: #b45309;`
  - Danger: `--danger: #be4444;`
  - Info: `--info: #4f6b8a;`

#### Dark Mode ("Matte Obsidian Cockpit")
- **Canvas / Background:** `--bg: oklch(0.130 0.006 250);` (`#0C0D10` matte obsidian)
- **Container Backing:** `--bg-subtle: oklch(0.160 0.008 250);` (`#141519`)
- **Card Surfaces:** `--surface: oklch(0.185 0.010 250);` (`#1B1C22`)
- **Inset Wells:** `--surface-inset: oklch(0.145 0.007 250);`
- **Elevated Surfaces:** `--surface-elevated: oklch(0.215 0.012 250);`
- **Raised Surfaces:** `--surface-raised: var(--surface-elevated);`
- **Borders:**
  - Hairline: `--border: rgba(236, 232, 255, 0.08);`
  - Strong: `--border-strong: rgba(236, 232, 255, 0.16);`
- **Typography:**
  - Primary text: `--text: oklch(0.930 0.004 250);` (soft anti-irradiation white)
  - Muted secondary: `--text-muted: oklch(0.700 0.008 250);`
  - Subtle meta: `--text-subtle: oklch(0.520 0.008 250);`
- **Chroma & Accents:**
  - Elevated indigo accent: `--accent: oklch(0.720 0.160 265);` (`#8B85F5`)
  - Accent wash: `--accent-muted: oklch(0.240 0.040 265);`
  - Accent contrast: `--accent-contrast: #0c0d10;`
- **Semantic Signals:**
  - Success: `--success: #3db89a;`
  - Warning: `--warning: #d4a054;`
  - Danger: `--danger: #e07a7a;`
  - Info: `--info: #7c9ec4;`

### 2.2 APCA Contrast Compliance Analysis

- **Light Mode Contrast:**
  - `--text` (L=14%) on `--bg` (L=98.5%): APCA Lc ≈ 104 (Exceeds APCA Level 4 minimum Lc 75 for body text).
  - `--text-muted` (L=44%) on `--surface` (L=100%): APCA Lc ≈ 72 (Solid contrast for secondary descriptions).
  - `--text-subtle` (L=60%) on `--surface`: APCA Lc ≈ 52 (Reserved for timestamps, counters, non-critical meta).
- **Dark Mode Contrast:**
  - `--text` (L=93%) on `--bg` (L=13%): APCA Lc ≈ -96 (High clarity, softened from 100% white to eliminate halation / visual irradiation).
  - `--text-muted` (L=70%) on `--surface` (L=18.5%): APCA Lc ≈ -68.
  - `--accent` (L=72%, C=0.160) on `--bg` (L=13%): APCA Lc ≈ -70 (High legibility for primary links and badges).

### 2.3 Physical Depth & Specular Rim Lighting

Apple Design guidelines emphasize material depth via specular top rim highlights:
> *"border-top: 1px solid rgba(255, 255, 255, 0.4); bright top edge = light catching the material"*

Currently, `src/app.css` defines `.epure-surface-specular`:
```css
/* Specular Rim Lighting & Card Depth */
.epure-surface-specular {
  background-color: var(--surface);
  box-shadow:
    0 0 0 1px var(--border),
    inset 0 1px 0 0 oklch(1 0 0 / 0.08),
    0 1px 2px -0.5px rgba(0, 0, 0, 0.04),
    0 4px 12px -2px rgba(0, 0, 0, 0.06);
}

[data-theme="dark"] .epure-surface-specular,
.dark .epure-surface-specular {
  background-color: var(--surface);
  box-shadow:
    0 0 0 1px var(--border),
    inset 0 1px 0 0 oklch(1 0 0 / 0.12),
    0 1px 2px -0.5px rgba(0, 0, 0, 0.25),
    0 4px 12px -2px rgba(0, 0, 0, 0.35);
}
```
**Observation:** `.epure-surface-specular` is only consumed in `src/pages/dev/design-kit/sections/tokens-section.tsx`. Production UI primitives (`Card`, `SectionCard`, `DialogContent`, `PopoverContent`, `DropdownMenuContent`) use `--shadow-tactile` (`--shadow-bevel`) or `--shadow-float` (`--shadow-popover`), missing the unified specular rim lighting.

---

## 3. Semantic Token Bridge & Arbitrary Class Audit

### 3.1 The `--color-*: initial;` Guardrail

In `src/styles/tokens.css`, Tailwind v4's theme block declares:
```css
@theme inline {
  --color-*: initial;
  ...
```
This resets all standard Tailwind CSS default palettes (`gray-*`, `slate-*`, `zinc-*`, `red-*`, `indigo-*`, etc.). Consequently:
- Any utility like `bg-slate-100` or `text-zinc-500` will produce **zero CSS** in the final build.
- Only tokens explicitly bridged in `@theme inline` resolve.

### 3.2 Dual Semantic Naming Schemes

The codebase currently bridges two generations of tokens:

| Role | Semantic Scheme (`@/components/ui`, `@/components/kit`) | Legacy Scheme (`src/ui`, `src/features`) | Target CSS Variable |
|---|---|---|---|
| Primary Text | `text-fg-primary` (115+ files) | `text-ink` (50+ files) | `var(--text)` |
| Secondary Text | `text-fg-secondary` | `text-ink-muted` | `var(--text-muted)` |
| Subtle/Meta Text | `text-fg-muted` | `text-ink-subtle` | `var(--text-subtle)` |
| Base Canvas | `bg-canvas` | `bg-bg` | `var(--bg)` |
| Card Surface | `bg-surface-1` | `bg-surface` | `var(--surface)` |
| Container Backing | `bg-surface-2` | `bg-bg-subtle` | `var(--bg-subtle)` |
| Recessed Well | `bg-surface-3` | `bg-surface-inset` | `var(--state-pressed)` / `var(--surface-inset)` |
| Hairline Border | `border-border-subtle` | `border-border` | `var(--border)` |
| Strong Border | `border-border-strong` | `border-border-strong` | `var(--border-strong)` |
| Primary Action | `bg-primary`, `text-primary-fg` | `bg-accent`, `text-accent-contrast` | `var(--accent)`, `var(--accent-contrast)` |

Both schemes resolve to identical underlying values in `calm-ledger.css`, preserving complete visual consistency across both old and new views.

### 3.3 Undeclared Arbitrary Hex Search

A full regex search across `src/` for `(bg|text|border|fill|stroke)-[#[0-9a-fA-F]+]` revealed **only two occurrences**:
- `src/features/org/channels.tsx:283` — `text-[#E01E5A]` (Slack brand mark)
- `src/features/org/channels.tsx:284` — `text-[#5865F2]` (Discord brand mark)

No other arbitrary hex values exist in `src/`. For Milestone R1, these should be tokenized into dedicated brand variables:
- `--channel-slack: #E01E5A;`
- `--channel-discord: #5865F2;`

---

## 4. Typography & Layout Stability Analysis

### 4.1 Typography Stack & Metrics

- **Sans:** IBM Plex Sans (`"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif`)
- **Mono:** IBM Plex Mono (`"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`)
- **Tracking:** `--tracking-ui: -0.007em;`
- **Scale:**
  * 2xs: `0.6875rem` (11px) / leading `0.875rem` (14px)
  * xs: `0.75rem` (12px) / leading `1.125rem` (18px)
  * sm: `0.875rem` (14px) / leading `1.375rem` (22px)
  * md / base: `0.9375rem` (15px) / leading `1.5rem` (24px)
  * lg: `1.0625rem` (17px) / leading `1.625rem` (26px)
  * xl: `1.25rem` (20px) / leading `1.75rem` (28px)

### 4.2 Tabular Numbers (`tabular-nums`) Coverage

Tabular numbers ensure digits occupy identical horizontal widths, preventing layout jitter as live counts update.
In `src/styles/tokens.css`:
```css
@layer base {
  table, time, kbd, code, .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
}
```
In `src/app.css`:
```css
.font-tabular {
  font-variant-numeric: tabular-nums lining-nums slashed-zero;
}
.epure-stat-value, .epure-stat-value-compact {
  font-variant-numeric: slashed-zero tabular-nums;
}
```
Every stat card, nav pastille, table cell, timestamp, and button hotkey correctly includes `tabular-nums`.

### 4.3 CSS Grid Track Stability (Zero Layout Shift)

The core telemetry feed rows use a locked grid template:
In `src/components/kit/issue-row-shell.tsx`:
```ts
export const ISSUE_ROW_GRID =
  "grid-cols-[16px_minmax(0,1fr)_5.25rem_4.25rem_4.5rem_4rem_4rem_2rem] gap-x-3";

export const ISSUE_FEED_ROW_HEIGHT_CLASS =
  "h-[4.625rem] max-h-[4.625rem] min-h-[4.625rem] overflow-hidden";
```
In `src/features/issues/issue-list-column-header.tsx`:
```tsx
<div
  className={cn(
    "group sticky top-0 z-10 grid h-8 w-full items-center border-b border-border-subtle bg-surface-2/90 px-3 text-[11px] font-medium text-fg-muted backdrop-blur-xs select-none",
    ISSUE_ROW_GRID,
    className,
  )}
>
  <div className="flex size-4 shrink-0 items-center justify-center">
    <Checkbox ... />
  </div>
  ...
```

**Layout Shift Verification:**
1. **Track 1 (`16px`):** Exactly equals the checkbox container `size-4` (`16px`). When checkboxes appear on row hover or disappear on mouse leave, Track 1 does not expand or collapse. Title text shifts **0.00 pixels**.
2. **Track 2 (`minmax(0,1fr)`):** Flexes to absorb remaining container width, with `truncate` on title and subtitle.
3. **Tracks 3–8 (`5.25rem`, `4.25rem`, `4.5rem`, `4rem`, `4rem`, `2rem`):** Fixed rem dimensions matching header column titles (`Last seen`, `Age`, `Events`, `Users`, `Priority`, `Actions`).
4. **Row Containment:** `.epure-feed-row` in `app.css` defines:
   ```css
   content-visibility: auto;
   contain-intrinsic-size: auto 74px;
   contain: layout style paint;
   ```
   This restricts browser layout recalculation strictly to individual rows during high-frequency telemetry streaming.

---

## 5. Emil Kowalski & Apple Design Principles Review Table

| Before | After | Why |
|---|---|---|
| `active:translate-y-[0.5px]` on `button.tsx` | `active:scale-[0.97]` with critically damped spring recovery | Mechanical press depression confirms the interface acknowledged the user on pointer-down (Apple WWDC 2018 / Emil §Component Building) |
| `.btn-tactile` uses `scale(0.98)` in `app.css` | `.btn-tactile` unified to `scale(0.97)` with `100ms ease-out` | Eliminates mismatch between button variants and utility classes |
| `data-[state=open]:zoom-in-95` on `popover.tsx` & `dropdown-menu.tsx` | `transform-origin: var(--radix-popper-transform-origin, center)` + `scale(0.96) -> 1.0` | Anchors entrance animation to trigger location; elements must emerge from where they were summoned (Emil §Make popovers origin-aware) |
| Command palette dialog enters with 150ms zoom animation | Instant display (0ms duration) for keyboard-triggered ⌘K palette | Keyboard-initiated commands must execute immediately without artificial latency (Raycast speed principle) |
| Missing `touch-action` on interactive controls | `touch-action: manipulation;` in `src/styles/tokens.css` base layer | Disables double-tap-to-zoom delay on mobile, ensuring instant touch response |
| Missing `-webkit-tap-highlight-color` | `-webkit-tap-highlight-color: transparent;` on `html, body` | Eliminates unsightly grey tap rectangle flash on mobile Safari |
| `input.tsx` uses `text-xs` (12px) | `text-base sm:text-xs` (16px on mobile viewports) | Prevents iOS Safari from auto-zooming the viewport on input focus |
| `min-h-screen` in auth/monitoring views | `min-h-dvh` (dynamic viewport height) | Avoids the iOS Safari 100vh bug where navigation bars push content below the fold |
| Viewport meta lacks `viewport-fit=cover` | `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` | Enables CSS `env(safe-area-inset-*)` support on notched displays |
| Light mode `--surface-elevated` is identical to `--surface` | Light mode elevated surfaces incorporate subtle specular rim highlight (`inset 0 1px 0 0 rgba(255,255,255,0.8)`) | Creates visual layer separation between base canvas, cards, and floating dialogs |
| Raw `#E01E5A` and `#5865F2` in `channels.tsx` | Semantic tokens `--channel-slack` and `--channel-discord` | Upholds strict zero-arbitrary-color rule across the entire product tree |

---

## 6. Build, Testing & Script Integrity

### 6.1 Test Suite Verification
Executing `npm test` runs 109 tests across 20 test suites using Node's native runner:
- `style-theme & light/dark theme mode` (6 tests)
- `design kit registry matches ui/ and kit/ on disk`
- `feature-ui groups are sorted and unique`
- `feature-ui registry covers every src/ui module (or documented façade)`
- `every cataloged module has a playground preview file`
- `use-issue-triage-machine semantics`
- `occurrence-line-chart-path`
- All 109 tests passed with 0 failures in 1.62s.

### 6.2 TypeScript Compilation & Linting
Executing `npm run typecheck && npm run lint` passes with 0 errors and 0 warnings.
- `tsconfig.app.json` enforces strict TypeScript with composite builds.
- ESLint configuration (`eslint.config.js`) enforces:
  - No raw `<button>`, `<input>`, or `<select>` in pages/features/kit.
  - No inline `style={{}}` in pages/features/kit.
  - No direct imports of `radix-ui`, `cmdk`, `@phosphor-icons/react`, `sonner`, or `vaul` (must use `@/components/ui/*`).

### 6.3 Production Build
Executing `npm run build` succeeds in 2.93s, generating:
- `dist/assets/index-DYx8d2kk.css` (241.12 kB / 39.49 kB gzip)
- `dist/assets/index-DEFacNDy.js` (1,668.67 kB / 482.63 kB gzip)

---

## 7. Actionable Refactoring Plan for Milestone R1

To achieve full compliance with Requirement R1 and prepare the foundation for R2–R5:

### Step 1: Foundational Tokens (`web/design/tokens.css` & `calm-ledger.css`)
- **Add Spring & Easing Tokens in `tokens.css`:**
  ```css
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --spring-duration: 0.35s;
  --spring-bounce: 0;
  ```
- **Add Mobile Safe Area Tokens in `tokens.css`:**
  ```css
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  ```
- **Refine Light Mode Elevation & Specular Rim in `calm-ledger.css`:**
  ```css
  --shadow-specular: 0 0 0 1px var(--border), inset 0 1px 0 0 oklch(1 0 0 / 0.1), 0 1px 2px -0.5px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.06);
  --channel-slack: #E01E5A;
  --channel-discord: #5865F2;
  ```

### Step 2: Semantic Bridge & Base Layer (`web/src/styles/tokens.css`)
- **Extend `@theme inline`:**
  * Add `--shadow-specular: var(--shadow-specular);`
  * Add `--color-channel-slack: var(--channel-slack);`
  * Add `--color-channel-discord: var(--channel-discord);`
- **Add Mobile Baseline in `@layer base`:**
  ```css
  html, body {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  ```

### Step 3: Application CSS Layer (`web/src/app.css`)
- Update `.btn-tactile` to `:active { transform: scale(0.97); }`.
- Ensure `#root` fills `min-height: 100dvh;`.

### Step 4: Index HTML Viewport Configuration (`web/index.html`)
- Update `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`.

### Step 5: Replace Raw Hex in Channels (`src/features/org/channels.tsx`)
- Replace `text-[#E01E5A]` with `text-channel-slack`.
- Replace `text-[#5865F2]` with `text-channel-discord`.
