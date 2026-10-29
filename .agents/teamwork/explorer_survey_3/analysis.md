# Epure UI/UX Survey Analysis — Feature Views, Mobile Responsiveness & Motion Performance

**Author**: Survey Explorer 3  
**Date**: 2026-10-28  
**Scope**: Requirements R3, R4, R5, Acceptance Criteria, Verification Suite  
**Target Codebase**: `/Users/amomo/Projets/kelson/apps/epure/web`  

---

## Executive Summary

Epure's web frontend is built on a modern stack (Vite 7, React 19, TypeScript 5.9, Tailwind CSS v4, Radix UI primitives, Motion 14, Vaul 1.1, Sonner 2.0, Shiki 4.5, Recharts 3.1). The baseline verification suite (109 unit/integration tests, TypeScript strict typecheck, ESLint, production build, playground build) is fully green.

However, detailed inspection reveals key architectural and polish gaps relative to requirements R3, R4, and R5 and Emil Kowalski / Apple Design standards:
1. **Focus and Navigation Cues (R3)**: `IssueRowShell` sets `data-focused={focused}` on DOM nodes during `j`/`k` navigation, but there are zero CSS rules styling `[data-focused="true"]`. Keyboard navigation focus cues are literally invisible.
2. **Telemetry & Sparklines (R3)**: `OccurrenceLineChart` has smooth cubic bezier paths and crosshair inspection tooltips, but `TelemetryChart` uses standard Recharts without crosshair inspection, and `Sparkline` (`src/ui/sparkline.tsx`) is implemented as simple vertical HTML `span` bars rather than an SVG bezier path.
3. **Syntax Highlighting & Stack Traces (R3)**: `CodeFrame` uses Shiki with hardcoded `theme: "vitesse-dark"` (no light theme support), while `SourceCodeBlock` and `CodeBlock` render unhighlighted plain text.
4. **Mobile Native Foundation (R4)**: `index.html` lacks `viewport-fit=cover` (causing all `env(safe-area-inset-*)` values to be `0px`) and `interactive-widget=resizes-content`. The codebase contains zero instances of `safe-area-inset`. Inputs have 12px (`text-xs`) font size, triggering aggressive layout zoom on iOS Safari. Global tap highlight removal and `touch-action: manipulation` are absent.
5. **Mobile Drawers & Vaul (R4)**: `vaul` is installed in `package.json` (`^1.1.2`), but `src/components/ui/sheet.tsx` merely wraps `@radix-ui/react-dialog` with static CSS slide transitions. No Vaul pull-to-dismiss bottom sheet or gesture tracking is integrated.
6. **Motion Discipline (R5)**: Unbounded `transition-all` declarations exist in primitives (`tabs.tsx`, `progress.tsx`), button mechanical depression is incomplete (`active:translate-y-[0.5px]` rather than `:active scale(0.97)`), popover/dropdown origins are unanchored to triggers, and `CommandDialog` (⌘K) suffers from dialog entry animations rather than instant Raycast speed.

---

## 1. Feature Views Architecture Inventory (R3)

### 1.1 Issue & Alert Feed Rows
- **Files**:
  - `src/components/kit/issue-row-shell.tsx`
  - `src/components/kit/inbox-read-cue.tsx`
  - `src/features/issues/issue-list.tsx`
  - `src/features/issues/issue-list-column-header.tsx`
  - `src/features/alerts/alert-row.tsx`
  - `src/ui/issue-feed-row.tsx`
- **Current Architecture**:
  - Grid layout locked via `ISSUE_ROW_GRID` = `grid-cols-[16px_minmax(0,1fr)_5.25rem_4.25rem_4.5rem_4rem_4rem_2rem] gap-x-3` and `ISSUE_FEED_ROW_HEIGHT_CLASS` = `h-[4.625rem] max-h-[4.625rem] min-h-[4.625rem] overflow-hidden`.
  - Zero-shift checkbox: Checkbox container is a fixed `size-4 shrink-0`.
  - Left Unread Rail: `InboxUnreadRail` renders `<span className="inbox-unread-rail pointer-events-none absolute bottom-2 left-0 top-2 w-[2px] rounded-r-sm bg-accent" />`.
  - Unread typography: `inboxPrimaryTitleClass` switches between `font-semibold text-fg-primary` (unread) and `font-normal text-fg-secondary` (read).
- **Defects & Gaps**:
  - **Missing Keyboard Focus Indicator**: In `IssueRowShell` (`issue-row-shell.tsx:112`), `data-focused={focused}` is set on the container element. However, there is no CSS rule anywhere in `app.css`, `tokens.css`, or component files targeting `[data-focused="true"]` or `[data-focused]`. As a result, pressing `j`/`k` updates `focusedId` in React state, but provides zero visual cue to the user.
  - **Proposed Fix**: Add an explicit, high-visibility focus cue:
    ```css
    .epure-feed-row[data-focused="true"] {
      background-color: var(--state-selected);
      box-shadow: inset 2px 0 0 0 var(--accent), inset 0 0 0 1px var(--border-strong);
      outline: none;
    }
    ```

### 1.2 Telemetry Charts & Sparklines
- **Files**:
  - `src/components/kit/telemetry-chart.tsx`
  - `src/ui/occurrence-line-chart.tsx`
  - `src/ui/occurrence-line-chart-path.ts`
  - `src/ui/sparkline.tsx`
- **Current Architecture**:
  - `OccurrenceLineChart` uses cubic bezier path construction (`smoothLinePath` and `areaPath` in `occurrence-line-chart-path.ts`). It includes a vertical crosshair dashed line (`strokeDasharray="2 2"`), hit areas with `cursor-crosshair`, and a floating tooltip. Verified by unit tests in `occurrence-line-chart-path.test.ts`.
  - `TelemetryChart` wraps Recharts `<AreaChart>` with `type="monotone"`. It defines a linear gradient def and a custom `<Tooltip>`, but lacks crosshair cursor rendering (`cursor={{ stroke: "var(--border-strong)", strokeDasharray: "2 2" }}`) and fluid tooltip physics.
  - `Sparkline` (`src/ui/sparkline.tsx:38-51`) renders a flex row of vertical `<span>` bars (`w-[3px] min-h-[2px] rounded-[1px]`), scaling height with inline CSS percentages. It is not an SVG bezier line chart.
- **Defects & Gaps**:
  - Inconsistency between `OccurrenceLineChart` (custom SVG cubic bezier) and `TelemetryChart` (Recharts without crosshair) and `Sparkline` (HTML bar divs).
  - Telemetry tooltips lack smooth crosshair tracking.

### 1.3 Code Syntax Inspection & Stack Trace Explorers
- **Files**:
  - `src/components/kit/code-frame.tsx`
  - `src/ui/code-block.tsx`
  - `src/ui/source-code-block.tsx`
  - `src/ui/stack-trace-panel.tsx`
  - `src/ui/copy-button.tsx`
- **Current Architecture**:
  - `StackTracePanel` (`src/ui/stack-trace-panel.tsx`) is comprehensive: deduplicates frames (`dedupeStackFrames`), identifies vendor code (`isVendorFrame`), groups vendor frames into collapsible runs (`vendor-run`), detects culprit frame, and provides copy buttons.
  - `CodeFrame` uses Shiki `codeToHtml` with `theme: "vitesse-dark"` asynchronously.
- **Defects & Gaps**:
  - `CodeFrame` hardcodes `vitesse-dark`, ignoring light mode.
  - `SourceCodeBlock` (`src/ui/source-code-block.tsx:149-162`) renders plain text inside `<pre>`, without any token syntax highlighting.
  - `CodeBlock` (`src/ui/code-block.tsx`) also renders unhighlighted text.
  - Copy actions switch icons to `Check` for 2000ms, but lack toast confirmation or tactile haptic/pointer feedback.

### 1.4 AI Copilot Triage Card, Filter Bars & Toolbars
- **Files**:
  - `src/components/kit/ask-agent-card.tsx`
  - `src/ui/issue-ai-copilot-card.tsx`
  - `src/components/kit/filter-bar.tsx`
  - `src/components/kit/command-bar.tsx`
  - `src/features/issues/bulk-actions.tsx`
- **Current Architecture**:
  - `IssueAiCopilotCard` contains deterministic error analysis (`generateAiDiagnosis`) and unified "Copy for AI" export (`copyIssueExport`).
  - `FilterBar` supports segmented pills, environment dropdown, status toggles, and search input.
  - `CommandBar` connects ⌘K / Ctrl+K via `react-hotkeys-hook` and renders `CommandDialog` (wrapping Radix Dialog and `cmdk`).
- **Defects & Gaps**:
  - `CommandDialog` uses `DialogContent` with default zoom/fade animations (`zoom-in-95 data-[state=closed]:zoom-out-95 duration-150`). This adds perceptual lag to keyboard-driven palette invocation (violates Raycast speed principle).

---

## 2. Mobile Responsiveness & Native Touch Audit (R4)

### 2.1 Viewport Configuration (`index.html`)
- **Current**:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ```
- **Violations**:
  1. Missing `viewport-fit=cover`. Without this, Safari letterboxes content and all `env(safe-area-inset-*)` values resolve to `0px`.
  2. Missing `interactive-widget=resizes-content`. Android Chrome software keyboard will obscure bottom-docked inputs rather than resize the viewport.
  3. Missing theme colors per color scheme (`<meta name="theme-color" media="(prefers-color-scheme: light)" content="#..." />`).

### 2.2 Touch Action & Highlight
- **Current**:
  `src/app.css` does not define `-webkit-tap-highlight-color: transparent`.
  Buttons and interactive controls do not declare `touch-action: manipulation` or `user-select: none`.
- **Consequence**:
  - Tapping interactive elements on iOS/Android displays the default translucent blue/gray highlight box.
  - Rapid taps may incur a 300ms double-tap delay.
  - Long presses on buttons or list rows trigger text selection callouts.

### 2.3 Input Font Sizes (< 16px)
- **Current**:
  `src/components/ui/input.tsx:71` specifies `text-xs` (12px):
  ```tsx
  className="w-full bg-transparent text-xs text-fg-primary placeholder:text-fg-muted focus:outline-none tabular-nums"
  ```
- **Consequence**:
  On iOS Safari, focusing any input element with `font-size < 16px` forces the browser to zoom the viewport in, distorting the workspace layout until the user manually pinches to zoom out.
- **Fix**:
  Ensure all inputs have `text-base md:text-xs` or define a global rule:
  ```css
  @media (pointer: coarse) {
    input, textarea, select {
      font-size: 16px !important;
    }
  }
  ```

### 2.4 Viewport Height & Safe Areas
- **Current**:
  `src/app.css:16-20`:
  ```css
  html, body, #root {
    height: 100%;
  }
  ```
  Zero occurrences of `safe-area-inset` in the entire codebase.
- **Consequence**:
  On mobile devices with Home Indicator bar or notch/Dynamic Island, fixed overlays (drawers, sheets, toolbars, bottom toasts) collide with hardware chrome.
- **Fix**:
  Use `100dvh` for application shells and drawers, and apply safe area insets:
  ```css
  .app-shell {
    min-height: 100dvh;
  }
  .app-header {
    padding-top: env(safe-area-inset-top, 0px);
  }
  .bottom-toolbar, [data-sonner-toaster] {
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
  }
  ```

### 2.5 Mobile Sheet Drawers & Vaul
- **Current**:
  `package.json` contains `"vaul": "^1.1.2"`.
  However, `src/components/ui/sheet.tsx` only imports `@radix-ui/react-dialog`. It is a desktop slide-over sidebar with static CSS transitions (`slide-in-from-right`), not a touch-draggable bottom drawer.
  `src/ui/issue-detail-overlay.tsx` uses a fixed right-side `<aside>` on all screen sizes.
- **Required**:
  Implement a Vaul-powered bottom drawer for mobile viewports (`< 768px` or coarse pointer) with:
  - Pull-to-dismiss gesture handling with boundary damping
  - Hardware-accelerated transform tracking
  - Visual drag handle (`touch-action: pan-x`)
  - Safe area bottom padding (`calc(1rem + env(safe-area-inset-bottom))`)

---

## 3. Motion Budget & Performance Guardrails (R5)

### 3.1 Composite-Only Property Violations
In `animation-performance` guidelines, animations must strictly stick to composite-only properties (`transform`, `opacity`). The audit identified multiple violations:

| File | Line | Current Code | Issue | Fix |
|---|---|---|---|---|
| `src/components/ui/tabs.tsx` | 78 | `transition-all` on `TabsTrigger` | Animates padding, border, and font styles across re-renders | Restrict to `transition-colors` or layout-stable transform |
| `src/components/ui/progress.tsx` | 30, 67 | `transition-all duration-300` | Animates `width` directly triggering layout re-calculation | Switch to `transform: scaleX(...)` with `transform-origin: left` |
| `src/features/org/project-list.tsx` | 188 | `transition-all duration-100` | Animates border, shadow, and layout | Specify `transition-[border-color,box-shadow,transform]` |
| `src/features/auth/login.tsx` | 300, 319 | `transition-all active:scale-[0.99]` | `transition-all` on interactive button | Change to `btn-tactile` or `transition-[transform,background-color]` |
| `src/components/ui/button.tsx` | 13 | `active:translate-y-[0.5px]` | Missing Emil Kowalski depression feedback | Standardize to `active:scale-[0.97]` with `duration-100 ease-out` |

### 3.2 Popover & Dropdown Trigger Origin Alignment
- **Files**: `src/components/ui/popover.tsx:24`, `src/components/ui/dropdown-menu.tsx:69`
- **Current**:
  `data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95` without origin specification.
- **Issue**:
  Transforms scale from `center`, appearing disconnected from the triggering button.
- **Fix**:
  Anchor to trigger origin using Radix CSS variable:
  ```css
  transform-origin: var(--radix-popper-transform-origin, center);
  ```

### 3.3 Prefers-Reduced-Motion Audit
- **Current**:
  `web/design/tokens.css:101-107` sets:
  ```css
  @media (prefers-reduced-motion: reduce) {
    :root {
      --duration-fast: 0ms;
      --duration-base: 0ms;
      --duration-panel: 0ms;
    }
  }
  ```
  However, utility animations from `tw-animate-css` (`animate-in`, `zoom-in-95`, `slide-in-from-*`) use hardcoded durations in Tailwind utility classes (`duration-150`, `duration-200`) and are not tied to `--duration-*`.
- **Fix**:
  Add global motion reset for reduced motion:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```

---

## 4. Verification Suite & Registry Synchronization

### 4.1 Test Runner & Suite Health
- **Runner**: Node.js native test runner via `node --import tsx --test 'src/**/*.test.ts' 'playground/**/*.test.ts'`.
- **Test Count**: 109 tests across 20 suites.
- **Status**: 109 passing, 0 failing, duration ~1.8s.
- **Typecheck**: `tsc -b tsconfig.app.json` → 0 errors.
- **Lint**: `eslint .` → 0 errors.
- **Build**: `vite build` → Completed in ~3.0s.
- **Playground Build**: `tsc -b tsconfig.playground.json && vite build --config vite.playground.config.ts` → Completed in ~3.8s.

### 4.2 Design Kit Registry Contracts
The test file `src/pages/dev/design-kit/design-kit-registry.test.ts` enforces strict 1:1 disk parity:
1. `DESIGN_KIT_UI_MODULES` in `src/pages/dev/design-kit/registry.ts` must match all `.tsx` files in `src/components/ui/`.
2. `DESIGN_KIT_KIT_MODULES` in `registry.ts` must match all `.tsx` files in `src/components/kit/` (excluding `use-epure-shortcut.ts`).
3. `DESIGN_KIT_FEATURE_UI_MODULES` and `DESIGN_KIT_FEATURE_UI_FACADES` in `src/pages/dev/design-kit/feature-ui-registry.ts` must match all `.tsx` files in `src/ui/`. Every group module list must be strictly sorted A→Z.
4. Every module in `DESIGN_KIT_UI_MODULES` must have a matching `previews/ui/<name>.preview.tsx`.
5. Every module in `DESIGN_KIT_KIT_MODULES` must have a matching `previews/kit/<name>.preview.tsx`.

⚠️ **Crucial Rule for Implementation Agents**:
Never create or rename components in `src/components/ui/`, `src/components/kit/`, or `src/ui/` without updating `registry.ts`, `feature-ui-registry.ts`, and creating corresponding preview files, otherwise `npm test` will immediately fail.
