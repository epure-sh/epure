# Changes Summary: Milestone R1 (Design Token & Depth System Foundation)

**Author:** Worker R1  
**Target Project Directory:** `/Users/amomo/Projets/kelson/apps/epure/web`  
**Date:** 2026-10-28

---

## 1. Overview
Implemented foundational styling token, depth system, and mobile touch reset changes per Milestone R1 requirements. All arbitrary color literals were eliminated in favor of semantic tokens, Apple & Emil Kowalski motion constants were established, and base tactile and mobile viewport configurations were activated.

---

## 2. Modified Files and Change Details

### `web/design/tokens.css`
- **Location:** Line 77–93
- **Changes:**
  - Added modern easing curves:
    - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);`
    - `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);`
    - `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);`
  - Added spring constants:
    - `--spring-damping: 1.0;` (critically damped for non-oscillatory settle)
    - `--spring-response: 0.35s;`
  - Added mobile safe area environment variables:
    - `--safe-top: env(safe-area-inset-top, 0px);`
    - `--safe-bottom: env(safe-area-inset-bottom, 0px);`
    - `--safe-left: env(safe-area-inset-left, 0px);`
    - `--safe-right: env(safe-area-inset-right, 0px);`

### `web/design/themes/calm-ledger.css`
- **Location:** Light Mode (lines 89–99) & Dark Mode (lines 157–167)
- **Changes:**
  - Defined multi-layer specular rim highlight token `--shadow-specular`:
    - Light mode: includes hairline border, subtle top inset specular rim (`oklch(1 0 0 / 0.12)`), and multi-layer elevation drops.
    - Dark mode: includes hairline border, intensified top inset rim (`oklch(1 0 0 / 0.16)`), and obsidian shadow drops.
  - Defined canonical brand tokens for external integrations:
    - `--channel-slack: #E01E5A;`
    - `--channel-discord: #5865F2;`

### `web/src/styles/tokens.css`
- **Location:** Lines 118, 127, 142
- **Changes:**
  - Exposed brand colors in `@theme inline`:
    - `--color-channel-slack: var(--channel-slack);`
    - `--color-channel-discord: var(--channel-discord);`
  - Exposed specular rim shadow in `@theme inline`:
    - `--shadow-specular: var(--shadow-specular);`
  - Added base layer resets to `html, body` for mobile touch responsiveness:
    - `touch-action: manipulation;` (removes 300ms double-tap delay)
    - `-webkit-tap-highlight-color: transparent;` (eliminates gray flash on tap)

### `web/src/app.css`
- **Location:** Lines 80–110
- **Changes:**
  - Refactored `.epure-surface-specular` to directly consume `box-shadow: var(--shadow-specular);`, automatically adapting between light and dark themes without redundant rules.
  - Upgraded button tactile depression feedback:
    - Transition duration refined to `100ms cubic-bezier(0.23, 1, 0.32, 1)` (snappy ease-out curve).
    - Depression transform set to `.btn-tactile:active { transform: scale(0.97); }` complying with Apple & Emil Kowalski tactile standards.

### `web/index.html`
- **Location:** Line 5
- **Changes:**
  - Updated viewport meta tag:
    - `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`
    - Enables edge-to-edge layout utilization with `env(safe-area-inset-*)`.

### `web/src/features/org/channels.tsx`
- **Location:** Lines 283–284
- **Changes:**
  - Replaced arbitrary hex Tailwind utility classes with semantic tokens:
    - Slack icon: `text-[#E01E5A]` → `text-channel-slack`
    - Discord icon: `text-[#5865F2]` → `text-channel-discord`

---

## 3. Verification Commands & Results

1. **Unit & Integration Tests:**
   - Command: `npm test`
   - Result: 109 passed, 0 failed, 20 suites, duration 1748ms.
2. **TypeScript Compilation:**
   - Command: `npm run typecheck`
   - Result: Clean exit 0, 0 errors.
3. **ESLint:**
   - Command: `npm run lint`
   - Result: Clean exit 0, 0 errors, 0 warnings.
4. **Vite Production Build:**
   - Command: `npm run build`
   - Result: Built in 3.10s with zero errors.
5. **Design Kit Registry Parity:**
   - Command: `node --import tsx --test 'src/pages/dev/design-kit/design-kit-registry.test.ts'`
   - Result: 4 tests passed, 0 failed (1:1 catalog sync verified).
6. **Arbitrary Color Verification:**
   - Command: `ripgrep '(bg|text|border)-\[#[0-9a-fA-F]+\]' src/`
   - Result: 0 matches found across `src/`.
