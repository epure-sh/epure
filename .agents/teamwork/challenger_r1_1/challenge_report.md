# Empirical Challenge Report: Milestone R1 (Design Token & Depth System Foundation)

**Author:** Challenger R1 (critic, specialist)  
**Target Codebase:** `/Users/amomo/Projets/kelson/apps/epure/web`  
**Timestamp:** 2026-10-28T17:43:00Z  

---

## Challenge Summary

**Overall risk assessment**: **LOW** (Verified Robust)

All token modifications, depth system enhancements, brand color bridges, tabular numeric enforcement, and layout invariants implemented by Worker R1 were empirically tested using a headless Chromium (Playwright) runtime harness and a programmatic Tailwind v4 AST compiler.

No regressions, layout shifts, circular variable references, or CSS purge failures were detected.

---

## Challenges & Empirical Results

### Challenge 1: Runtime Token Resolution of `--shadow-specular` in Light and Dark Modes
- **Assumption challenged:** That `--shadow-specular` declared in `calm-ledger.css` and mapped in Tailwind v4 `@theme inline` resolves properly without circular reference (`--shadow-specular: var(--shadow-specular)`) or theme desynchronization.
- **Attack scenario:** Under light mode, dark mode, or nested theme scopes (`[data-theme="dark"]` inside `.light`), computed styles might collapse to `none` or fail to evaluate due to CSS cascade layering (`@layer theme`).
- **Empirical test method:** Launched Playwright Chromium, injected compiled production CSS (`dist/assets/index-DPoO7RCv.css`), and measured `getComputedStyle(doc).getPropertyValue('--shadow-specular')` and `getComputedStyle(el).boxShadow` across light mode, dark mode, and nested scopes.
- **Results:**
  - **Light Mode:**
    - `--shadow-specular`: `0 0 0 1px rgba(26, 22, 18, .08), inset 0 1px 0 0 oklch(1 0 0 / .12), 0 1px 2px -.5px rgba(0, 0, 0, .04), 0 4px 12px -2px rgba(0, 0, 0, .06)`
    - Card `box-shadow`: `rgba(26, 22, 18, 0.08) 0px 0px 0px 1px, oklch(1 0 0 / 0.12) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.04) 0px 1px 2px -0.5px, rgba(0, 0, 0, 0.06) 0px 4px 12px -2px`
    - Background: `rgb(255, 255, 255)`
  - **Dark Mode:**
    - `--shadow-specular`: `0 0 0 1px rgba(236, 232, 255, .08), inset 0 1px 0 0 oklch(1 0 0 / .16), 0 1px 2px -.5px rgba(0, 0, 0, .25), 0 4px 12px -2px rgba(0, 0, 0, .35)`
    - Card `box-shadow`: `rgba(236, 232, 255, 0.08) 0px 0px 0px 1px, oklch(1 0 0 / 0.16) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.25) 0px 1px 2px -0.5px, rgba(0, 0, 0, 0.35) 0px 4px 12px -2px`
    - Background: `oklch(0.185 0.01 250)`
  - **Nested Scopes:** Light container with nested `.dark[data-theme="dark"]` child correctly evaluated both light and dark specular box shadows simultaneously (`isLightDifferentFromDark: true`).
- **Verdict:** **PASS**. Multi-layer depth and specular rim highlight resolve accurately with zero circular reference issues.

---

### Challenge 2: Brand Color Tokens (`channel-slack` and `channel-discord`) & Tailwind v4 Compilation
- **Assumption challenged:** That `--color-channel-slack` and `--color-channel-discord` generate valid CSS without being stripped or corrupted by Tailwind v4's compiler.
- **Attack scenario:** Tailwind v4 uses `@theme inline` with `--color-*: initial;`. If token bridges are improperly formatted, utility classes like `text-channel-slack` and `text-channel-discord` would be stripped during compilation, causing broken icons in `channels.tsx`.
- **Empirical test method:**
  1. Ran `@tailwindcss/node` compile harness on `src/styles/tokens.css` with candidate utility classes.
  2. Measured computed styles in Playwright Chromium for `.text-channel-slack` and `.text-channel-discord`.
- **Results:**
  - `text-channel-slack`: Generated `.text-channel-slack { color: var(--channel-slack); }`. Computed color: `rgb(224, 30, 90)` (`#E01E5A`).
  - `text-channel-discord`: Generated `.text-channel-discord { color: var(--channel-discord); }`. Computed color: `rgb(88, 101, 242)` (`#5865F2`).
  - `bg-channel-slack` & `bg-channel-discord`: Generated `.bg-channel-slack` and `.bg-channel-discord` with proper background-color rules.
- **Verdict:** **PASS**.

---

### Challenge 3: Strict Purging of Undeclared Arbitrary Tailwind Colors
- **Assumption challenged:** That Tailwind v4 `--color-*: initial;` guardrail strictly prevents undeclared arbitrary Tailwind color utilities from leaking into the stylesheet.
- **Attack scenario:** If `--color-*: initial;` failed, accidental usages of `text-red-500`, `bg-blue-600`, or `text-slate-800` would generate arbitrary non-token colors, violating the Calm Ledger semantic contract.
- **Empirical test method:**
  1. Programmatically passed default Tailwind color classes (`text-red-500`, `bg-blue-600`, `text-slate-800`, `border-zinc-200`) through `@tailwindcss/node` compiler with `tokens.css`.
  2. Scanned entire `src/` codebase for arbitrary color classes via regex `(bg|text|border|ring|fill|stroke)-[#[0-9a-fA-F]+]`.
- **Results:**
  - `text-red-500`: **PURGED / BLOCKED** (0 bytes generated).
  - `bg-blue-600`: **PURGED / BLOCKED** (0 bytes generated).
  - `text-slate-800`: **PURGED / BLOCKED** (0 bytes generated).
  - `border-zinc-200`: **PURGED / BLOCKED** (0 bytes generated).
  - Arbitrary hex regex match across `src/`: **0 occurrences**.
- **Verdict:** **PASS**. Enforcement of semantic design tokens is complete.

---

### Challenge 4: Tabular Numbers Enforcement & Monospace Alignment
- **Assumption challenged:** That `table, time, kbd, code, .tabular-nums` in `tokens.css` locks digit widths and eliminates numeric jitter.
- **Attack scenario:** In variable-width fonts (such as IBM Plex Sans), digit `1` is narrower than digit `8`. If `tabular-nums` is not active on these tags, updating numbers (e.g., event counts, timestamps, hotkeys) produces horizontal layout shifts.
- **Empirical test method:**
  1. Rendered strings with all `1`s versus all `8`s in `<table><td>`, `<time>`, `<kbd>`, `<code>`, and a control `<span>` without tabular numbers in Chromium.
  2. Measured bounding client rect widths using subpixel precision (`getBoundingClientRect().width`).
- **Results:**
  - Table Cell (`<td>1111111111` vs `<td>8888888888`): **85.703125px vs 85.703125px (Difference: 0.0000px)**.
  - `<time>` (`11:11:11` vs `88:88:88`): **59.250000px vs 59.250000px (Difference: 0.0000px)**.
  - `<kbd>` (`11111` vs `88888`): **41.656250px vs 41.656250px (Difference: 0.0000px)**.
  - `<code>` (`111111` vs `888888`): **49.984375px vs 49.984375px (Difference: 0.0000px)**.
  - *Control `<span>` (no tabular nums):* 62.468750px vs 86.937500px (Difference: **24.468750px** shift).
- **Verdict:** **PASS**. Layout shift due to numeric glyph width disparity is zero.

---

### Challenge 5: Layout Invariance on `ISSUE_ROW_GRID` and `ISSUE_FEED_ROW_HEIGHT_CLASS`
- **Assumption challenged:** That `ISSUE_ROW_GRID` (`grid-cols-[16px_minmax(0,1fr)_5.25rem_4.25rem_4.5rem_4rem_4rem_2rem] gap-x-3`) and `ISSUE_FEED_ROW_HEIGHT_CLASS` (`h-[4.625rem] max-h-[4.625rem] min-h-[4.625rem] overflow-hidden`) remain rock-solid and unaffected by token changes.
- **Attack scenario:** Modifying base styles or font tokens could shift row height or displace grid track columns across interactive states (checkbox checked, focused, selected).
- **Empirical test method:** Rendered feed row shell and column header in Chromium, measuring all 8 column positions and row heights under:
  - Default state
  - Focused state (`[data-focused="true"]`)
  - Selected state (`[data-selected="true"]`)
  - Checkbox checked state
- **Results:**
  - Default row height: **74.0000px** (`4.625rem * 16px`).
  - Focused row height: **74.0000px** (Shift: **0.0000px**).
  - Selected row height: **74.0000px** (Shift: **0.0000px**).
  - Checked row height: **74.0000px** (Shift: **0.0000px**).
  - Header-to-row alignment error across all 8 columns: **0.0000px**.
  - Maximum column horizontal shift across all state changes: **0.0000px**.
- **Verdict:** **PASS**. Feed row height and column geometry are completely invariant.

---

### Challenge 6: Tactile Press Depression Dynamics (`.btn-tactile`)
- **Assumption challenged:** That `.btn-tactile:active` produces physical depression (`scale(0.97)`) with critically damped recovery without causing layout shift.
- **Attack scenario:** If button depression used margin, padding, or top displacement, neighboring elements would reflow. If transition curves were uncalibrated, the click would feel laggy.
- **Empirical test method:** Dispatched synthetic pointer down and pointer up events in Playwright Chromium, measuring computed `transform` during active press and after release.
- **Results:**
  - Resting state: `transform: none`.
  - Active press state (at 150ms): `transform: matrix(0.97, 0, 0, 0.97, 0, 0)` (exact `scale(0.97)`).
  - Release state: returns to `transform: none`.
  - Since transform is composite-only, parent and neighboring sibling dimensions remained identical (0px layout shift).
- **Verdict:** **PASS**.

---

### Challenge 7: Build and Test Suites Regression Test
- **Assumption challenged:** Zero regressions in existing test suites, TypeScript types, linting, or production builds.
- **Empirical results:**
  - `npm test`: **109 passed, 0 failed in 20 suites** (1572ms).
  - `npm run typecheck`: **Clean exit 0** (0 errors).
  - `npm run lint`: **Clean exit 0** (0 errors, 0 warnings).
  - `npm run build`: **Built client environment in 2.67s** (dist/ created cleanly).
  - `npm run build:playground`: **Built playground in 3.39s**.
  - `npm run test:playground-smoke`: **3 passed in 4.3s**.
  - `node --import tsx --test 'src/pages/dev/design-kit/design-kit-registry.test.ts'`: **4 passed in 0.67ms** (1:1 disk catalog parity).
- **Verdict:** **PASS**.

---

## Unchallenged Areas

- **Primitives Tactility & Micro-Interactions (`@/components/ui/*`)**: Scheduled for Milestone R2.
- **Feed Row Focus Cue Details & Telemetry Curves**: Scheduled for Milestone R3.
- **Vaul Drawer Bottom Sheet & Touch Gestures**: Scheduled for Milestone R4.
- **Global Reduced-Motion Kill Switch**: Scheduled for Milestone R5.

---

## Overall Assessment

Milestone R1 meets all architectural, design token, visual depth, and layout stability criteria with zero regressions and zero layout shift.
