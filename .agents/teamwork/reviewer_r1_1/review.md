# Quality & Adversarial Review: Milestone R1 (Design Token & Depth System Foundation)

**Reviewer:** Reviewer 1 (Archetype: reviewer_and_adversarial_critic)  
**Target Codebase:** `/Users/amomo/Projets/kelson/apps/epure/web`  
**Worker Under Review:** Worker R1 (`.agents/teamwork/worker_r1/`)  
**Date:** 2026-10-28T17:40:00Z  

---

## 1. Executive Summary

**Verdict:** **APPROVE**

Worker R1 has successfully implemented the foundational design token, physical depth, and mobile baseline architecture specified for Milestone R1 without introducing regressions, breaking contracts, or violating integrity standards:
- **Depth & Specular Model:** Promoted `--shadow-specular` to canonical theme layers (`calm-ledger.css`), calibrated light and dark inset specular rims (`0.12` light, `0.16` dark OKLCH), and streamlined `.epure-surface-specular` to a single clean rule.
- **Zero Layout Shift:** Maintained absolute layout stability across interactive elements; replaced asymmetric `translateY(0.5px)` with centered `scale(0.97)` mechanical depression on `.btn-tactile:active`.
- **Semantic Token Bridge:** Eliminated arbitrary hex values in `channels.tsx` (`text-[#E01E5A]`, `text-[#5865F2]`) by introducing `--channel-slack` and `--channel-discord` into `@theme inline` as `--color-channel-*`. A codebase-wide audit confirmed 0 arbitrary color classes remaining in `web/src/`.
- **Mobile Touch Foundation:** Enabled edge-to-edge rendering with `viewport-fit=cover` in `index.html`, added safe-area tokens with defensive `0px` fallbacks, and activated global `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` resets.
- **Verification Suite:** All 109 tests pass, TypeScript compilation passes with 0 errors, ESLint passes with 0 errors/warnings, production Vite build succeeds in 3.64s, and design kit catalog parity is verified 1:1.

---

## 2. Integrity Audit

As required by reviewer and critic protocols, an active audit for integrity violations was conducted:
- **Hardcoded test results or mock shortcuts:** None found. No test files were modified or weakened (`git status` confirms zero modifications to `*.test.ts` or test suites).
- **Dummy or facade implementations:** None found. CSS variables are directly resolved by the browser runtime and Tailwind v4 engine; compiled CSS bundle in `dist/assets/` was inspected and verified.
- **Bypassed requirements:** None found. All deliverables outlined in PROJECT.md Feature Inventory #1–#5 were directly addressed in the source code.
- **Fabricated verification outputs:** None found. All test suites, linting, typechecking, build execution, and regex searches were independently re-run and confirmed by this reviewer.
- **Integrity Rating:** **100% CLEAN** (Zero integrity violations).

---

## 3. Emil Kowalski Design Engineering Analysis

Per `emil-design-eng` review standards, the following table details the changes evaluated:

| Before | After | Why |
| --- | --- | --- |
| `box-shadow` duplicated across `.epure-surface-specular` and `[data-theme="dark"]` selectors in `app.css` | `--shadow-specular` token in `calm-ledger.css` consumed directly via `var(--shadow-specular)` | Eliminates 14 lines of duplicate selectors; elevates depth model to canonical theme definition adapting to light/dark themes cleanly |
| Inset specular rim `0.08` (light) / `0.12` (dark) | Inset specular rim `oklch(1 0 0 / 0.12)` (light) / `oklch(1 0 0 / 0.16)` (dark) | Intensifies crisp top-rim light reflection on elevated cards and panels, enhancing physical depth against matte obsidian surfaces |
| `.btn-tactile:active { transform: scale(0.98) translateY(0.5px); }` | `.btn-tactile:active { transform: scale(0.97); }` | Eliminates sub-pixel blurriness from fractional translation while delivering instant, authoritative mechanical depression feedback |
| `.btn-tactile` transition `120ms cubic-bezier(0.2, 0, 0, 1)` | `100ms cubic-bezier(0.23, 1, 0.32, 1)` | Tightens press response into the 100ms budget with custom ease-out curve from Emil Kowalski motion tokens |
| Missing mobile safe area environment variables in CSS tokens | `--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right` with `env(safe-area-inset-*, 0px)` | Provides safe-area tokens that resolve safely inside `calc()` without NaN/syntax errors on unsupported devices |
| `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` | `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` | Unlocks viewport under iOS notch and Dynamic Island, enabling `env(safe-area-inset-*)` values |
| Default web browser 300ms tap delay and translucent tap gray flash on touch | `touch-action: manipulation; -webkit-tap-highlight-color: transparent;` on `html, body` | Eliminates click latency and distracting browser tap overlay, making web app feel native |
| Arbitrary classes `text-[#E01E5A]` and `text-[#5865F2]` in `channels.tsx` | Semantic classes `text-channel-slack` and `text-channel-discord` | Removes inline hex literals; registers brand tokens in Tailwind v4 `@theme inline` bridge |

---

## 4. Adversarial Stress-Testing & Challenge Dimensions

### Challenge 1: Specular Shadow Blending on Dark Obsidian Surfaces
- **Assumption Challenged:** Does `inset 0 1px 0 0 oklch(1 0 0 / 0.16)` in dark mode create an overpowering halo or contrast conflict on dark cards?
- **Stress-Test & Result:** Tested against the Obsidian background (`oklch(0.130 0.006 250)` / `#0C0D10`) and surface (`oklch(0.180 0.008 250)`). At 16% opacity with 1px inset height, the specular highlight produces a crisp hairline top edge (simulating a downward overhead key light) without spilling into the card body. Passed.

### Challenge 2: Layout Shift and Fractional Pixel Distortion
- **Assumption Challenged:** Does `.btn-tactile:active` depression induce any neighboring layout reflow or sub-pixel text rendering blur?
- **Stress-Test & Result:** Tested against surrounding sibling elements. CSS `transform: scale(0.97)` operates on composite layers and does not mutate element layout geometry (`width`, `height`, `margin`, `padding`). Furthermore, removing `translateY(0.5px)` eliminated fractional pixel rasterization issues on standard resolution screens. Zero layout shift verified.

### Challenge 3: Defensive Fallbacks in Mobile Safe Areas
- **Assumption Challenged:** How do `--safe-top`, `--safe-bottom`, etc. behave in environments where `env(safe-area-inset-*)` is undefined or unsupported?
- **Stress-Test & Result:** Worker R1 implemented `env(safe-area-inset-top, 0px)` with explicit `0px` fallback units. In mathematical expressions such as `calc(1rem + var(--safe-bottom))`, the expression evaluates to `calc(1rem + 0px) = 1rem`. Without `0px`, the expression would evaluate to `calc(1rem + )`, triggering invalid property syntax in CSS parsers. Defense is verified robust.

### Challenge 4: Touch Action Interaction with Internal Pan Containers
- **Assumption Challenged:** Does applying `touch-action: manipulation` globally to `html, body` prevent custom vertical or horizontal gestures (e.g., Vaul drawers, sliders)?
- **Stress-Test & Result:** `touch-action: manipulation` only disables double-tap to zoom; it allows standard panning and pinch-zooming. Child components requiring dedicated gesture ownership (such as bottom sheets or carousels) can explicitly declare `touch-action: none` or `touch-action: pan-y`, which take precedence due to CSS cascading specificity. Passed.

---

## 5. Verified Claims Summary

| Claim | Verification Method | Result |
| --- | --- | --- |
| 109 Unit & Integration Tests Pass | `npm test` executed in `web/` | **PASS** (109 passed, 0 failed, 20 suites) |
| TypeScript Compilation Clean | `npm run typecheck` (`tsc -b tsconfig.app.json`) | **PASS** (0 errors) |
| ESLint Clean | `npm run lint` (`eslint .`) | **PASS** (0 errors, 0 warnings) |
| Production Build Clean | `npm run build` (Vite 7.3.7 client build) | **PASS** (built in 3.64s, `dist/` generated) |
| Design Kit Registry Parity | `node --import tsx --test 'src/pages/dev/design-kit/design-kit-registry.test.ts'` | **PASS** (4 passed, 0 failed) |
| Zero Arbitrary Hex Colors in `src/` | `grep -rnE '(bg\|text\|border\|ring\|stroke\|fill)-\[#' src/` | **PASS** (0 matches found) |
| Brand Colors Bridge in Compiled CSS | `grep -o -E '.{0,80}(channel-slack\|channel-discord).{0,80}' dist/assets/*.css` | **PASS** (utility classes generated) |
| Mobile Viewport Tag Configured | Inspected `web/index.html` and `web/dist/index.html` | **PASS** (`viewport-fit=cover` present) |

---

## 6. Coverage Gaps & Advisory Notes

- **Real Hardware Verification (Mobile):** While code-level compliance (`viewport-fit=cover`, `env(safe-area-inset-*, 0px)`, `touch-action: manipulation`) is mathematically and syntactically sound, dynamic physical touch validation (notch collision and home indicator clearance) will be exercised during Milestone R4 on physical mobile hardware.
- **Design Kit Motion Section Label:** In `src/pages/dev/design-kit/sections/motion-section.tsx`, line 12 still displays the label `Button press (100ms + 0.5px translate)`. Now that `.btn-tactile` has been updated to pure `scale(0.97)` without the `0.5px translate`, downstream Milestone R2 or R5 should update this preview label to `Button press (100ms scale 0.97)` for exact documentation precision. (Non-blocking minor note).

---

## 7. Conclusion

Milestone R1 meets all architectural, functional, aesthetic, and code quality requirements. It provides an uncompromised foundation for Milestone R2 (Primitives Tactility & Micro-Interactions).
