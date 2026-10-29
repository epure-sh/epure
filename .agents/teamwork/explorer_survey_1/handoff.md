# Handoff Report: Survey Explorer 1 (Styling & Token Architecture)

**Author:** Survey Explorer 1  
**Working Directory:** `/Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/explorer_survey_1/`  
**Recipient:** Orchestrator (`29c6a32f-7318-43eb-b9bc-1ba766ff2431`) & Milestone R1 Implementers  
**Status:** Hard Handoff (Investigation & Survey Complete)  

---

## 1. Observation

### 1.1 Styling Architecture & File Inventory
A file-system survey mapped exactly 5 styling files in `web/`:
1. `/Users/amomo/Projets/kelson/apps/epure/web/design/tokens.css` (108 lines)
   - Imports `./themes/index.css` (line 3).
   - Declares typography scale (`--text-2xs` through `--text-5xl`), spacing (`--space-1` through `--space-10`), layout dimensions (`--chrome-rail-width`, `--chrome-top-height`, etc.), hairlines (`--shadow-sm: none; --shadow-md: none;`), and baseline motion (`--duration-fast: 80ms; --ease-mechanical: cubic-bezier(0.16, 1, 0.3, 1);`).
2. `/Users/amomo/Projets/kelson/apps/epure/web/design/themes/calm-ledger.css` (153 lines)
   - Defines `:root, [data-style="calm-ledger"]` (Light Mode "Paper Ledger") and `[data-theme="dark"], .dark, [data-style="calm-ledger"][data-theme="dark"]` (Dark Mode "Matte Obsidian").
   - Light canvas: `--bg: oklch(0.985 0.002 240);` (`#FAFAF9`), `--surface: #ffffff;`, `--surface-elevated: #ffffff;`, `--surface-raised: #ffffff;`.
   - Dark canvas: `--bg: oklch(0.130 0.006 250);` (`#0C0D10`), `--surface: oklch(0.185 0.010 250);`, `--surface-elevated: oklch(0.215 0.012 250);`.
   - Contrast text: `--text: oklch(0.140 0.008 240);` (Light L=14%), `--text: oklch(0.930 0.004 250);` (Dark L=93%).
   - One chroma rule: `--accent: #4f46e5;`, `--signal: var(--accent);`, `--unread-bar: var(--accent);`.
3. `/Users/amomo/Projets/kelson/apps/epure/web/design/themes/index.css` (2 lines)
   - Contains `@import "./calm-ledger.css";`.
4. `/Users/amomo/Projets/kelson/apps/epure/web/src/styles/tokens.css` (148 lines)
   - Tailwind v4 bridge with `@theme inline` block (lines 50–130).
   - Resets all Tailwind default colors: `--color-*: initial;` (line 51).
   - Bridges semantic tokens (`--color-canvas`, `--color-surface-1`, `--color-surface-2`, `--color-border-subtle`, `--color-fg-primary`, `--color-primary`, etc.).
   - Bridges legacy theme tokens (`--color-bg`, `--color-surface`, `--color-ink`, `--color-accent`, etc.).
   - Base layer OpenType tabular numbers (lines 144–146):
     ```css
     table, time, kbd, code, .tabular-nums {
       font-variant-numeric: tabular-nums;
     }
     ```
5. `/Users/amomo/Projets/kelson/apps/epure/web/src/app.css` (448 lines)
   - Imports `@import "tailwindcss";`, `@import "sonner/dist/styles.css";`, and `@config "../tailwind.config.ts";`.
   - Fixed Sonner overlay rules: `[data-sonner-toaster] { position: fixed !important; z-index: 999999 !important; pointer-events: none !important; }`.
   - Containment for 120fps virtualization: `.epure-feed-row { content-visibility: auto; contain-intrinsic-size: auto 74px; contain: layout style paint; }`.
   - Specular rim definition (lines 80–98):
     ```css
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
   - Tactile button class: `.btn-tactile:active { transform: scale(0.98) translateY(0.5px); }`.

### 1.2 Arbitrary Tailwind Class Audit
- Ripgrep regex search across `src/` for `(bg|text|border)-(slate|gray|zinc|neutral|stone|red|blue|green|yellow|indigo|purple|emerald|amber|violet|sky)-[0-9]+` returned **0 matches**.
- Ripgrep regex search for `(bg|text|border|fill|stroke)-[#[0-9a-fA-F]+]` returned **exactly 2 lines**:
  - `src/features/org/channels.tsx:283`: `text-[#E01E5A]` (Slack icon)
  - `src/features/org/channels.tsx:284`: `text-[#5865F2]` (Discord icon)
- No other arbitrary color classes exist.

### 1.3 Zero Layout Shift Grid & Tabular Verification
- In `src/components/kit/issue-row-shell.tsx:20-25`:
  ```ts
  export const ISSUE_ROW_GRID =
    "grid-cols-[16px_minmax(0,1fr)_5.25rem_4.25rem_4.5rem_4rem_4rem_2rem] gap-x-3";
  export const ISSUE_FEED_ROW_HEIGHT_CLASS =
    "h-[4.625rem] max-h-[4.625rem] min-h-[4.625rem] overflow-hidden";
  ```
- In `src/features/issues/issue-list-column-header.tsx:30-36`:
  Shares `ISSUE_ROW_GRID`. Checkbox slot is strictly locked to `16px` (`size-4`). When checkbox transitions from opacity 0 to opacity 100 on hover/selection, title and data columns shift 0.00px.

### 1.4 Test Suite & Build Verification
Executed commands directly in `web/`:
- `npm test`: 109 tests passed, 20 test suites, 0 failed, duration 1618ms.
- `npm run typecheck`: clean exit 0.
- `npm run lint`: clean exit 0.
- `npm run build`: built `dist/` in 2.93s, generated `dist/assets/index-DYx8d2kk.css` (241.12 kB) and `dist/assets/index-DEFacNDy.js` (1668.67 kB).

---

## 2. Logic Chain

1. **Premise 1:** Tailwind v4 defines `--color-*: initial;` in `src/styles/tokens.css:51`, which strips all default utility colors from the compilation pipeline.
   - **Inference 1:** Any attempt to introduce ad-hoc utility colors like `bg-slate-200` fails silently at build time (produces no CSS). All colors must route through the semantic token bridge.
2. **Premise 2:** In `calm-ledger.css`, light-mode `--surface`, `--surface-elevated`, and `--surface-raised` are all set to identical `#ffffff`, while dark-mode values are layered (`oklch(0.185 ...)` vs `oklch(0.215 ...)`).
   - **Inference 2:** Light mode lacks physical depth hierarchy between base cards and elevated popovers/dialogs. Elevated elements rely solely on hairlines without specular highlights.
3. **Premise 3:** `.epure-surface-specular` exists in `app.css` with specular rim highlights (`inset 0 1px 0 0 ...`), but is not wired into `Card`, `SectionCard`, `DialogContent`, `PopoverContent`, or `DropdownMenuContent`.
   - **Inference 3:** Elevating visual polish across the app requires promoting specular rim lighting from an orphaned class into a core token utility (`--shadow-specular` / `shadow-specular`).
4. **Premise 4:** `button.tsx:13` uses `active:translate-y-[0.5px]`, while `.btn-tactile` in `app.css:109` uses `scale(0.98)`. Both fall short of Emil Kowalski and Apple WWDC 2018 guidelines prescribing immediate pointer-down `:active scale(0.97)` mechanical depression with critically damped spring recovery (`damping: 1.0`, `response: 0.35s`).
   - **Inference 4:** Primitives feel slightly dead or delayed on touch. Unifying `Button` and clickable controls to `:active scale(0.97)` with custom ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`) will directly satisfy R2.
5. **Premise 5:** `input.tsx:71` specifies `text-xs` (12px), and `index.html:5` lacks `viewport-fit=cover`.
   - **Inference 5:** On iOS Safari, focusing any input < 16px causes automatic browser page zoom, breaking desktop parity and causing jarring viewport shifts on touch devices. Upgrading mobile font-size to 16px (`max-sm:text-base` or `text-base sm:text-xs`) and adding `viewport-fit=cover` resolves mobile touch bugs.

---

## 3. Caveats

- **Dual Token Naming Schema:** The project contains both `text-fg-*` / `bg-surface-1` and `text-ink` / `bg-surface`. While both resolve to identical CSS variables, a full rename of `text-ink` across 50+ files in `src/ui/` is out of scope for R1 and would risk churn. The dual bridge must remain in place during R1–R5.
- **Safari `backdrop-filter` Performance:** Apple Design translucent layers (`backdrop-filter: blur(20px)`) are GPU-heavy if overused in scrolling lists. They must remain scoped to fixed chrome (top strip, dialog overlay, sticky headers).

---

## 4. Conclusion

The styling foundation is rock-solid (Tailwind v4, OpenType tabular numbers, zero layout shift grid, clean test suite), but lacks modern physical depth and mobile responsiveness tokens. 

Milestone R1 requires a focused, non-destructive token refactoring across 6 files:
1. `web/design/tokens.css` (add easing curves, spring constants, mobile safe areas)
2. `web/design/themes/calm-ledger.css` (refine elevation, specular rim token, brand tokens)
3. `web/src/styles/tokens.css` (bridge specular rim, brand tokens, mobile tap highlight/touch-action)
4. `web/src/app.css` (upgrade button tactile feedback, integrate specular surface)
5. `web/index.html` (add `viewport-fit=cover`)
6. `web/src/features/org/channels.tsx` (replace raw Slack/Discord hex with semantic tokens)

---

## 5. Verification Method

To independently verify all findings and test future refactorings:

1. **Run Full Test Suite:**
   ```bash
   cd /Users/amomo/Projets/kelson/apps/epure/web
   npm test
   ```
   *Expected:* All 109 tests in 20 suites pass cleanly with 0 failures.
2. **Typecheck and Lint:**
   ```bash
   cd /Users/amomo/Projets/kelson/apps/epure/web
   npm run typecheck && npm run lint
   ```
   *Expected:* 0 errors, 0 warnings.
3. **Production Build:**
   ```bash
   cd /Users/amomo/Projets/kelson/apps/epure/web
   npm run build
   ```
   *Expected:* Vite client build completes in under 3.5s with clean CSS bundle.
4. **Design Kit Registry Integrity Test:**
   ```bash
   node --import tsx --test 'src/pages/dev/design-kit/design-kit-registry.test.ts'
   ```
   *Expected:* Confirms exact 1:1 synchronization between disk components and catalog registry.
5. **Arbitrary Color Verification Command:**
   ```bash
   npx ripgrep -g '!node_modules/**' -g '!dist/**' '(bg|text|border)-\[#[0-9a-fA-F]+\]' src/
   ```
   *Expected:* Only `channels.tsx` lines 283/284 match prior to R1; 0 matches after R1.

---

## 6. Proposed Milestone R1 Implementation Contract

### Exact Code Proposals for Implementer

#### Contract A: `web/design/tokens.css`
Append modern easing and mobile safe area tokens to `:root`:
```css
  /* Apple & Emil Motion Physics */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --spring-damping: 1.0;
  --spring-response: 0.35s;

  /* Mobile Safe Areas */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
```

#### Contract B: `web/design/themes/calm-ledger.css`
In `:root, [data-style="calm-ledger"]`:
```css
  /* Specular Rim & Card Depth */
  --shadow-specular: 0 0 0 1px var(--border),
                     inset 0 1px 0 0 oklch(1 0 0 / 0.12),
                     0 1px 2px -0.5px rgba(0, 0, 0, 0.04),
                     0 4px 12px -2px rgba(0, 0, 0, 0.06);

  /* Brand Integrations */
  --channel-slack: #E01E5A;
  --channel-discord: #5865F2;
```
In `[data-theme="dark"] ...`:
```css
  --shadow-specular: 0 0 0 1px var(--border),
                     inset 0 1px 0 0 oklch(1 0 0 / 0.16),
                     0 1px 2px -0.5px rgba(0, 0, 0, 0.25),
                     0 4px 12px -2px rgba(0, 0, 0, 0.35);

  --channel-slack: #E01E5A;
  --channel-discord: #5865F2;
```

#### Contract C: `web/src/styles/tokens.css`
In `@theme inline`:
```css
  --shadow-specular: var(--shadow-specular);
  --color-channel-slack: var(--channel-slack);
  --color-channel-discord: var(--channel-discord);
```
In `@layer base`:
```css
  html,
  body {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    background-color: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
```

#### Contract D: `web/src/app.css`
Update button depression:
```css
.btn-tactile {
  transition: transform 100ms cubic-bezier(0.23, 1, 0.32, 1),
              background-color 150ms ease,
              border-color 150ms ease;
  will-change: transform;
}

.btn-tactile:active {
  transform: scale(0.97);
}
```

#### Contract E: `web/index.html`
Update line 5:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

#### Contract F: `web/src/features/org/channels.tsx`
Replace lines 283–284:
```tsx
{isSlack && <Hash className="size-4 text-channel-slack" />}
{isDiscord && <Radio className="size-4 text-channel-discord" />}
```
