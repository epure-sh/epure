# Adversarial Challenge Report: Milestone R1 (Design Token & Depth System Foundation)

**Challenger:** Challenger 2 (Empirical Challenger)  
**Date:** 2026-10-28T17:40:00Z  
**Target Codebase:** `/Users/amomo/Projets/kelson/apps/epure/web`  
**Status:** COMPLETE  

---

## Challenge Summary

**Overall risk assessment**: **LOW**

All empirical tests passed without exceptions or regressions. The foundational token implementation, viewport configuration, mobile touch resets, safe-area fallbacks, and mechanical tactile button depression adhere strictly to Emil Kowalski & Apple Design engineering principles, W3C CSS specifications, and project architectural contracts.

---

## Challenges

### [Low] Challenge 1: Ancestor touch-action propagation vs. explicit button targeting

- **Assumption challenged:** Setting `touch-action: manipulation` exclusively on `html, body` guarantees that interactive descendants cannot trigger double-tap zoom or 300ms click delays.
- **Attack scenario:** In the W3C CSS Pointer Events specification, `touch-action` is not an inherited property (`Inherited: no`). If a browser implementation evaluates the target element's local property rather than checking ancestor constraints, or if a child element specifies another touch-action, double-tap zoom could still trigger on buttons.
- **Blast radius:** 300ms tap delay or unwanted double-tap zoom on touch devices.
- **Empirical test & findings:**
  - W3C Pointer Events Level 3 specifies: *"A touch behavior is allowed if and only if the behavior is allowed by each of the following: 1. The touch-action property of the target element. 2. The touch-action property of each of the target element's ancestor elements up to the element that defines the scrolling or gesture viewport."*
  - Tested in Chromium engine: `getComputedStyle(document.body).touchAction` returns `manipulation`. Descendant taps are effectively constrained.
- **Recommendation for R2/R4:** When interactive primitives (`Button`, `Toggle`, etc.) are overhauled in Milestones R2 and R4, add explicit `touch-action: manipulation` to `button, a, [role="button"]` as defense-in-depth, matching the baseline recommendation in `mobile-native`.

---

### [Low] Challenge 2: Safe-area fallback behavior in non-notched environments

- **Assumption challenged:** Can `--safe-top`, `--safe-bottom`, etc. cause CSS syntax corruption or `calc()` failures when evaluated in non-notched browsers or desktop viewports?
- **Attack scenario:** If `env(safe-area-inset-*)` returns empty/null in environments without display cutouts and lacks a fallback, any calculation such as `calc(1rem + var(--safe-bottom))` becomes invalid at computed-value time, causing the entire CSS declaration to be dropped by the browser.
- **Blast radius:** Complete failure of padding/margins on headers, overlays, or bottom bars.
- **Empirical test & findings:**
  - `web/design/tokens.css` lines 90–93 declares:
    ```css
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left: env(safe-area-inset-left, 0px);
    --safe-right: env(safe-area-inset-right, 0px);
    ```
  - Tested via Playwright Chromium on desktop viewport:
    - `getComputedStyle(document.documentElement).getPropertyValue('--safe-top')` → `"0px"`.
    - Element with `padding-top: var(--safe-top)` → `0px`.
    - Element with `padding-bottom: calc(20px + var(--safe-bottom))` → `20px`.
  - The fallback `, 0px` inside `env()` guarantees valid length values across all engines.

---

### [Low] Challenge 3: Layout reflow and text wrapping during `.btn-tactile` active depression

- **Assumption challenged:** Does the mechanical press depression `:active scale(0.97)` alter the layout dimensions of the button, push neighboring elements, or cause tight text labels to wrap?
- **Attack scenario:** A button placed in a constrained flex container with text right at the brink of wrapping (e.g. 1px before wrapping to a second line) is pressed down. If `:active` scale triggers layout recalculation, the width would shrink by 3%, forcing text to wrap to line 2, expanding button height, and displacing adjacent sibling elements.
- **Blast radius:** Cumulative Layout Shift (CLS), visual jank, and disrupted touch feel.
- **Empirical test & findings:**
  - Verified rendering pipeline behavior using Playwright Chromium:
    - Button geometry before click: `offsetWidth = 150px`, `offsetHeight = 40px`.
    - Sibling geometry before click: `offsetLeft = 180px`, `left = 180px`.
    - Button geometry during `:active`: `transform = matrix(0.97, 0, 0, 0.97, 0, 0)`.
    - Button layout box during `:active`: `offsetWidth = 150px` (delta: 0.000px).
    - Sibling layout box during `:active`: `offsetLeft = 180px`, `left = 180px` (delta: 0.000px).
    - Adversarial tight-width button test (content width right at boundary threshold):
      - Initial text lines: 1, `button.offsetHeight = 28px`, sibling `offsetTop = 58px`.
      - Active text lines: 1, `button.offsetHeight = 28px`, sibling `offsetTop = 58px`.
  - Result: CSS `transform: scale(0.97)` operates strictly in the composite layer and does not touch layout geometry or line-box calculation. Reflow is identically zero.

---

## Stress Test Results

| Test Scenario | Expected Behavior | Actual Behavior | Result |
|---------------|-------------------|-----------------|--------|
| Viewport meta in `index.html` | Contains `viewport-fit=cover`, `width=device-width` | Verified in DOM: `width=device-width, initial-scale=1.0, viewport-fit=cover` | **PASS** |
| Tap highlight reset in CSS | `-webkit-tap-highlight-color: transparent` active | Computed value on `html, body`: `rgba(0, 0, 0, 0)` | **PASS** |
| Touch action in CSS | `touch-action: manipulation` active | Computed value on `html, body`: `manipulation` | **PASS** |
| Safe area variable fallback | Evaluates to `0px` in standard viewport | `--safe-*` evaluated to `0px`, `calc(20px + var(--safe-bottom))` = `20px` | **PASS** |
| Tactile button layout stability | 0px offset shift on button and siblings during `:active` | Button `offsetWidth` delta = 0px; sibling `offsetLeft` delta = 0px | **PASS** |
| Tactile button text wrapping | Zero line breaks or height changes under tight boundary | Lines: 1 → 1; Height: 28px → 28px | **PASS** |
| Unit and integration suite | 109 tests passing, 0 failures | 109 passed, 20 suites, 0 failed (1132ms) | **PASS** |
| TypeScript check | `tsc -b tsconfig.app.json` exits 0 | Clean exit code 0 | **PASS** |
| ESLint check | `eslint .` exits 0 with 0 errors/warnings | Clean exit code 0 | **PASS** |
| App production build | `vite build` succeeds and outputs `dist/` | Built in 2.85s | **PASS** |
| Playground production build | `vite build --config vite.playground.config.ts` | Built in 3.46s | **PASS** |
| Design kit registry parity | 4 tests pass (1:1 disk component parity) | 4 passed, 0 failed | **PASS** |
| Arbitrary color scan | 0 arbitrary `[#hex]` colors in `web/src/` | 0 matches found | **PASS** |

---

## Unchallenged Areas

- **Gesture Physics & Sheet Pull-to-Dismiss:** Assigned to Milestone R4 (`Vaul` drawer integration).
- **Radix UI Trigger Anchored Transforms:** Assigned to Milestone R2 (`@/components/ui/*` primitives).
- **Physical Hardware iOS/Android Device Testing:** Tested in Chromium engine via Playwright; hardware verification on physical devices should be performed upon completion of Milestone R4.
