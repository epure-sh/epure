# Independent Quality & Adversarial Review: Milestone R1

**Reviewer:** Reviewer 2 (`reviewer_r1_2`)  
**Target Milestone:** R1 (Design Token & Depth System Foundation)  
**Target Codebase:** `/Users/amomo/Projets/kelson/apps/epure/web`  
**Date:** 2026-10-28  

---

## 1. Review Summary

**Verdict**: **APPROVE**  
**Adversarial Risk Assessment**: **LOW**  
**Integrity Assessment**: **100% CLEAN** (Zero integrity violations, no hardcoded results, no facade logic, no bypassed tasks).

Worker R1 has rigorously executed the foundational token, depth system, and mobile touch resets per the specifications of Milestone R1:
- Canonical OKLCH/RGB tokens established in `calm-ledger.css` with a physical 4-layer depth model (`--shadow-specular`).
- Specular rim lighting properly resolves top-light glints in light (`oklch(1 0 0 / 0.12)`) and dark (`oklch(1 0 0 / 0.16)`) modes.
- Elimination of redundant theme selector blocks in `app.css` by delegating directly to `var(--shadow-specular)`.
- Button mechanical tactile depression upgraded to `.btn-tactile:active { transform: scale(0.97); }` with snappy 100ms ease-out transitions (`cubic-bezier(0.23, 1, 0.32, 1)`).
- Full mobile touch responsiveness unlocked with `viewport-fit=cover`, safe area environment fallbacks, and `touch-action: manipulation; -webkit-tap-highlight-color: transparent;`.
- Elimination of all arbitrary hex literals in `channels.tsx` in favor of semantic brand tokens (`text-channel-slack`, `text-channel-discord`).
- Independent execution confirms all 109 tests, typechecking, linting, production build, and registry sync pass without errors or warnings.

---

## 2. Emil Kowalski Design Engineering Table

| Before | After | Why |
|---|---|---|
| `.epure-surface-specular` duplicated across 24 lines in `app.css` with hardcoded shadows | `.epure-surface-specular` binds to `var(--shadow-specular)` defined canonically in `calm-ledger.css` | Consolidates depth model into token architecture; allows automatic dark/light mode specular highlight shifts |
| No specular rim highlight token in `calm-ledger.css` | `--shadow-specular` multi-layer shadow with hairline border and inset `oklch(1 0 0 / 0.12)` (light) / `oklch(1 0 0 / 0.16)` (dark) | Mimics physical top-light refraction on chamfered card edges per Apple & Emil Kowalski depth principles |
| `.btn-tactile:active { transform: scale(0.98) translateY(0.5px); }` (120ms) | `.btn-tactile:active { transform: scale(0.97); }` (100ms `cubic-bezier(0.23, 1, 0.32, 1)`) | Removes asymmetric subpixel vertical translation; achieves uniform mechanical travel on z-axis with immediate response |
| Arbitrary color literals `text-[#E01E5A]` and `text-[#5865F2]` in `channels.tsx` | Semantic tokens `text-channel-slack` and `text-channel-discord` bridged through `@theme inline` | Eliminates hardcoded hex classes and adheres to 100% semantic token compliance |
| `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` | `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` | Enables edge-to-edge layout utilization and unlocks non-zero `env(safe-area-inset-*)` values on notched mobile screens |
| Default touch behavior without tap delay reset | `touch-action: manipulation; -webkit-tap-highlight-color: transparent;` on `html, body` | Eliminates 300ms double-tap delay and removes annoying gray tap flash boxes on iOS/Android touch interactions |
| Absence of spring and drawer motion constants in `tokens.css` | `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--spring-damping: 1.0`, `--spring-response: 0.35s`, `--safe-*` added | Pre-configures critically damped spring parameters and safe area insets for Milestones R2–R5 |

---

## 3. Findings

### [Minor] Finding 1: Button depression coexistence in `buttonVariants` (Advisory for R2)
- **What**: In `src/components/ui/button.tsx`, `buttonVariants` currently specifies `active:translate-y-[0.5px]`, whereas `.btn-tactile:active` uses `transform: scale(0.97)`.
- **Where**: `web/src/components/ui/button.tsx:13`
- **Why**: When a `<Button>` also receives `.btn-tactile`, the two active transform styles collide. While Worker R1 appropriately refrained from editing `button.tsx` (as `@/components/ui/*` is assigned to Milestone R2), downstream Worker R2 must replace `active:translate-y-[0.5px]` with `active:scale-[0.97]` or consolidate with `.btn-tactile`.
- **Suggestion**: Ensure Milestone R2 worker explicitly replaces `active:translate-y-[0.5px]` with `active:scale-[0.97]` in `buttonVariants`.

### [Minor] Finding 2: Reduced motion tokenization in `.btn-tactile` (Advisory for R5)
- **What**: `.btn-tactile` specifies a fixed `100ms` transition duration rather than `var(--duration-fast)` (which collapses to `0ms` under `prefers-reduced-motion: reduce`).
- **Where**: `web/src/app.css:88`
- **Why**: When a user enables reduced motion in their OS, `.btn-tactile` will still animate over 100ms unless covered by a global kill switch.
- **Suggestion**: In Milestone R5 (Motion Budget & Performance Guardrails), bind transition duration to `var(--duration-fast)` or add `@media (prefers-reduced-motion: reduce) { .btn-tactile { transition: none; } }`.

---

## 4. Adversarial Challenge & Stress-Testing

### Challenge 1: Touch Action Manipulation Blast Radius
- **Assumption Challenged**: Does setting `touch-action: manipulation` globally on `html, body` break scrolling or pinch-zooming on data-dense telemetry charts or logs?
- **Attack Scenario**: User attempts to pinch-zoom or pan horizontally across the activity telemetry charts.
- **Result**: **PASS**. Per W3C spec, `manipulation` is an alias for `pan-x pan-y pinch-zoom`. It only disables double-tap-to-zoom (the source of the 300ms tap delay). All normal multi-touch scrolling, panning, and zooming continue to function without restriction.

### Challenge 2: Safe-Area Environment Variable Fallbacks
- **Assumption Challenged**: Does `env(safe-area-inset-*, 0px)` break or produce invalid CSS values on browsers that lack `env()` support?
- **Attack Scenario**: User loads Epure on an older desktop browser or embedded webview without notch safe areas.
- **Result**: **PASS**. The two-argument syntax `env(..., 0px)` guarantees a fallback of `0px` in standard-compliant browsers, and CSS variables evaluate cleanly.

### Challenge 3: Specular Rim Contrast in Light vs Dark Mode
- **Assumption Challenged**: Does a 1px white inset highlight create an unwanted white halo or glare on dark cockpit cards?
- **Attack Scenario**: Inspect dark surface `oklch(0.185 0.010 250)` with `inset 0 1px 0 0 oklch(1 0 0 / 0.16)`.
- **Result**: **PASS**. At 16% opacity against a dark matte slate background, the specular line is subtle (simulating a chamfered top edge reflecting an overhead diffuse light source). In light mode, 12% opacity provides a delicate glint without over-brightening pure white cards.

### Challenge 4: Integrity & Non-Fabrication Verification
- **Assumption Challenged**: Did Worker R1 hardcode test assertions or stub out requirements?
- **Attack Scenario**: Audit git diff, test files, and package scripts for fabricated mock outputs or dummy stubs.
- **Result**: **PASS**. Zero test files were modified. All tests run against live components and disk files. The design kit registry test verifies 1:1 disk parity dynamically.

---

## 5. Verified Claims

| Claim | Verification Command / Method | Result |
|---|---|---|
| All 109 unit & integration tests pass | `npm test` | **PASS** (109 passed, 0 failed, 20 suites) |
| TypeScript compiles cleanly | `npm run typecheck` | **PASS** (exit code 0, 0 errors) |
| ESLint passes with zero warnings | `npm run lint` | **PASS** (exit code 0, 0 warnings/errors) |
| Production build succeeds | `npm run build` | **PASS** (built in 3.12s, index.html + chunks) |
| Design kit registry 1:1 parity | `node --import tsx --test 'src/pages/dev/design-kit/design-kit-registry.test.ts'` | **PASS** (4 passed, 0 failed) |
| Zero arbitrary hex classes in `src/` | Grep `(bg\|text\|border\|fill\|stroke)-\[#[0-9a-fA-F]+\]` | **PASS** (0 matches) |
| Specular rim token declared in light & dark modes | Inspected `web/design/themes/calm-ledger.css` | **PASS** (lines 92–95, 160–163) |
| Safe areas declared with fallbacks | Inspected `web/design/tokens.css` | **PASS** (lines 89–93) |
| Touch action & tap highlight reset | Inspected `web/src/styles/tokens.css` | **PASS** (lines 142–143) |
| Viewport fit set to cover | Inspected `web/index.html` | **PASS** (line 5) |

---

## 6. Coverage Gaps & Unverified Items

- **Coverage Gaps**: None for Milestone R1 scope. The scope boundaries between R1 (tokens/depth) and R2 (primitives) were respected.
- **Unverified Items**: None. All code, configuration, and build outputs were verified directly in the runtime environment.
