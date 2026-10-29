# Survey Explorer 3: Feature Views, Mobile Responsiveness & Motion Budget Handoff Report

## 1. Observation

Direct observations from tool inspection and test executions:

### 1.1 Verification Suite Baseline
- Command: `npm test` in `web/`
  Result: 109 tests passed, 20 test suites, 0 failures, duration 1.85s.
- Command: `npm run typecheck && npm run lint && npm run build`
  Result: Exit code 0. TypeScript zero errors, ESLint zero warnings, production bundle built cleanly in 2.98s.
- Command: `npm run build:playground`
  Result: Exit code 0, built in 3.85s.
- Test `src/pages/dev/design-kit/design-kit-registry.test.ts` (lines 37-92) directly asserts:
  1. `DESIGN_KIT_UI_MODULES` matches `readdirSync("src/components/ui")`
  2. `DESIGN_KIT_KIT_MODULES` matches `readdirSync("src/components/kit")` (excluding `use-epure-shortcut`)
  3. Every file in `src/ui/*.tsx` must be present in `DESIGN_KIT_FEATURE_UI_MODULES` (sorted A→Z per group) or `DESIGN_KIT_FEATURE_UI_FACADES`
  4. Every cataloged module has a matching `.preview.tsx` file in `previews/ui/` or `previews/kit/`.

### 1.2 Feature Views Observations (R3)
- **Issue Feed Rows (`src/components/kit/issue-row-shell.tsx:112`)**:
  `data-focused={focused}` is assigned to the root `<div>`.
  Searched codebase for `data-focused` via `grep_search`: Exactly one match (in `issue-row-shell.tsx`). Zero CSS rules exist for `[data-focused="true"]`.
  When `j`/`k` keyboard shortcuts trigger `onMoveSelection` in `src/features/issues/issue-list.tsx:155-165`, the focused row receives no visible focus cue.
- **Alert Feed Rows (`src/features/alerts/alert-row.tsx:64-85`)**:
  Uses `ALERT_FEED_ROW_HEIGHT_CLASS` and `InboxUnreadRail`. Has no `data-focused` attribute or keyboard focus cue.
- **Telemetry Charts (`src/components/kit/telemetry-chart.tsx:72-84`)**:
  Uses Recharts `<Tooltip>` without crosshair cursor configuration (`cursor={{ stroke: "...", strokeDasharray: "..." }}`).
- **Sparklines (`src/ui/sparkline.tsx:38-51`)**:
  Renders flex `<span>` bars (`w-[3px] min-h-[2px] rounded-[1px]`) with height percentages. Does not generate an SVG bezier path.
  In contrast, `OccurrenceLineChart` (`src/ui/occurrence-line-chart.tsx`) uses `smoothLinePath` and `areaPath` (`src/ui/occurrence-line-chart-path.ts`) with cubic bezier segments (`M ... C ...`).
- **Code Syntax & Stack Traces (`src/components/kit/code-frame.tsx:30`)**:
  `CodeFrame` calls `codeToHtml(code, { theme: "vitesse-dark" })`, which is hardcoded dark theme with no light mode variant.
  `src/ui/source-code-block.tsx:149-162` and `src/ui/code-block.tsx:34` render plain text `<pre>` blocks with no syntax token highlighting.
- **Command Palette (`src/components/kit/command-bar.tsx:74-76`, `src/components/ui/command.tsx:30-40`)**:
  Wraps `DialogContent` from `src/components/ui/dialog.tsx:41`, which applies `data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150` animations. Opening via ⌘K has full modal animation lag.

### 1.3 Mobile Responsiveness Observations (R4)
- **Viewport Meta (`index.html:5`)**:
  `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`.
  Does NOT include `viewport-fit=cover` or `interactive-widget=resizes-content`.
- **Safe Area Insets (`grep_search` query: `safe-area-inset`)**:
  Zero occurrences in the entire `web/` codebase.
- **Input Font Sizes (`src/components/ui/input.tsx:71`)**:
  `className="w-full bg-transparent text-xs text-fg-primary ..."` (12px font size).
- **Global Reset (`src/app.css:16-20`, `src/styles/tokens.css:137-147`)**:
  No `-webkit-tap-highlight-color: transparent`.
  No `overscroll-behavior: none` on `html, body`.
  No `touch-action: manipulation` or `user-select: none` on `button, a, [role="button"]`.
- **Sheet Primitive (`src/components/ui/sheet.tsx:1-131`)**:
  Uses `@radix-ui/react-dialog`. Does NOT import or use `vaul`. Has no gesture handlers, drag handle, or pull-to-dismiss behavior.

### 1.4 Motion & Performance Budget Observations (R5)
- **Unbounded Transitions (`transition-all`)**:
  - `src/components/ui/tabs.tsx:78`: `inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-all ...`
  - `src/components/ui/progress.tsx:30,67`: `transition-all duration-300`, `transition-all duration-500`
  - `src/features/org/project-list.tsx:188`: `transition-all duration-100`
  - `src/features/auth/login.tsx:300,319`: `transition-all`
- **Button Depression**:
  - `src/components/ui/button.tsx:13`: `active:translate-y-[0.5px]`. Missing `scale(0.97)` mechanical depression.
- **Trigger Origin**:
  - `src/components/ui/popover.tsx:24` and `src/components/ui/dropdown-menu.tsx:69`:
    Scale transforms use default `zoom-in-95` without `transform-origin: var(--radix-popper-transform-origin, center)`.

---

## 2. Logic Chain

1. **R3 Focus Navigation Gap**:
   - `IssueList` intercepts `j`/`k` key events and updates `focusedId`.
   - `IssueRowShell` sets `data-focused={focused}` on the row container.
   - However, since there is no selector in CSS for `[data-focused="true"]`, the focused row does not change its visual appearance.
   - *Inference*: Adding `.epure-feed-row[data-focused="true"]` with an accent left border inset and highlighted background is necessary and sufficient to restore visible keyboard navigation cues without shifting layout.

2. **R3 Chart & Sparkline Disparity**:
   - `OccurrenceLineChart` renders cubic bezier paths via SVG math in `occurrence-line-chart-path.ts` and crosshair inspection tooltips.
   - `Sparkline` renders simple HTML flex bars.
   - `TelemetryChart` uses Recharts `monotone` curves without crosshairs.
   - *Inference*: Harmonizing sparklines to use SVG cubic bezier paths (reusing `smoothLinePath` logic) and equipping `TelemetryChart` with a crosshair dashed stroke cursor and tooltip ensures visual and interactive cohesion across monitoring views.

3. **R4 Mobile Ingress Failure**:
   - When an iOS device renders a page without `viewport-fit=cover`, CSS `env(safe-area-inset-*)` evaluates to `0px`.
   - When an iOS user taps an `<input>` with font size < 16px (such as `text-xs` = 12px), Mobile Safari forcefully zooms the page viewport and crops edges.
   - When a user taps interactive elements, Safari and Chrome render a translucent gray tap highlight box unless `-webkit-tap-highlight-color: transparent` is declared.
   - *Inference*: Setting `viewport-fit=cover, interactive-widget=resizes-content` in `index.html`, adding global `-webkit-tap-highlight-color: transparent`, gating input font size to 16px minimum on coarse pointers (`@media (pointer: coarse) { input { font-size: 16px; } }`), and introducing `safe-area-inset` padding to headers, overlays, and bottom toolbars is required.

4. **R4 Vaul Bottom Drawer Gap**:
   - `vaul` is already an installed dependency (`^1.1.2`), but `src/components/ui/sheet.tsx` only wraps Radix Dialog.
   - On mobile screens, the issue detail panel (`IssueDetailOverlay`) renders as a full-width desktop drawer with a resize handle.
   - *Inference*: Providing a Vaul-powered `Drawer` variant in `sheet.tsx` (or an adaptive `ResponsiveSheet`) allows mobile viewports to open an interruptible pull-to-dismiss bottom sheet with drag handle and velocity awareness.

5. **R5 Performance & Reduced Motion Violation**:
   - `transition-all` triggers expensive paint and layout calculations for un-animated properties during state changes.
   - The Emil Kowalski and Apple design guidelines require restricting animations to composite-only properties (`transform`, `opacity`).
   - `tw-animate-css` classes bypass the `--duration-*` CSS variables and lack reduced-motion overrides.
   - *Inference*: Replacing `transition-all` with explicit composite properties, adding `@media (prefers-reduced-motion: reduce)` resets across utility animations, anchoring popovers to trigger origins, and removing animations from `CommandDialog` fulfills R5.

---

## 3. Caveats

1. **Hardware Verification**:
   - While CSS declarations, meta tags, and touch-action rules can be verified via code review and static unit tests, touch feel (e.g. 300ms tap delay, iOS rubber-band overscroll behavior, safe-area rendering under the Dynamic Island) ultimately requires validation on physical mobile hardware per the `mobile-native` skill guideline.
2. **Registry Synchronicity Constraint**:
   - `src/pages/dev/design-kit/design-kit-registry.test.ts` will break if any file in `src/components/ui/`, `src/components/kit/`, or `src/ui/` is added, removed, or renamed without updating `registry.ts` and `feature-ui-registry.ts` and providing preview files.
3. **Radix vs Vaul Context**:
   - Vaul uses its own internal Portal and dialog primitives. Care must be taken when wrapping Vaul inside `src/components/ui/sheet.tsx` so existing Radix `Sheet` consumers on desktop (such as side drawers) remain backwards-compatible while mobile consumers gain pull-to-dismiss capability.

---

## 4. Conclusion & Proposed Refactoring Plan

### Phase A: Foundation & Mobile Platform Baseline (R4)
1. **`web/index.html`**:
   - Update viewport meta: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content" />`
   - Add theme-color meta tags for light and dark modes.
2. **`web/src/app.css` & `web/src/styles/tokens.css`**:
   - Add `-webkit-tap-highlight-color: transparent` to `html`.
   - Add `overscroll-behavior: none` to `html, body`.
   - Add `touch-action: manipulation; user-select: none; -webkit-user-select: none;` to `button, a, [role="button"]`.
   - Add mobile 16px input font size floor:
     ```css
     @media (pointer: coarse) {
       input, textarea, select {
         font-size: 16px !important;
       }
     }
     ```
   - Add safe area utility variables and padding classes:
     ```css
     :root {
       --sat: env(safe-area-inset-top, 0px);
       --sab: env(safe-area-inset-bottom, 0px);
       --sal: env(safe-area-inset-left, 0px);
       --sar: env(safe-area-inset-right, 0px);
     }
     ```

### Phase B: Feature Views & Micro-Interactions (R3)
1. **`src/components/kit/issue-row-shell.tsx` & `src/app.css`**:
   - Add high-contrast keyboard navigation focus style:
     ```css
     .epure-feed-row[data-focused="true"] {
       background-color: var(--state-selected);
       box-shadow: inset 2px 0 0 0 var(--accent), inset 0 0 0 1px var(--border-strong);
     }
     ```
2. **`src/components/kit/telemetry-chart.tsx` & `src/ui/sparkline.tsx`**:
   - Configure Recharts crosshair cursor on `TelemetryChart` (`cursor={{ stroke: "var(--border-strong)", strokeDasharray: "2 2" }}`).
   - Refactor `Sparkline` to render an SVG cubic bezier path with smooth gradients.
3. **`src/components/kit/code-frame.tsx` & `src/ui/source-code-block.tsx`**:
   - Support dynamic light/dark theme adaptation in `CodeFrame`.
   - Introduce token highlighting and one-click copy confirmation toast for code blocks.
4. **`src/components/kit/command-bar.tsx` & `src/components/ui/command.tsx`**:
   - Bypass entry/exit animations on `CommandDialog` (0ms duration) to meet the Raycast speed principle.

### Phase C: Mobile Sheet Drawers & Vaul Integration (R4)
1. **`src/components/ui/sheet.tsx`**:
   - Integrate `vaul` (`Drawer.Root`, `Drawer.Content`, `Drawer.Handle`, `Drawer.Overlay`) for bottom drawer presentations.
   - Provide pull-to-dismiss gesture tracking with momentum calculation and boundary friction.
2. **`src/ui/issue-detail-overlay.tsx`**:
   - Adapt layout: on mobile screens (`< 768px` / touch), render detail inspection inside the Vaul bottom sheet drawer with safe area bottom padding.

### Phase D: Motion Budget & Performance Guardrails (R5)
1. **Primitives**:
   - Replace `transition-all` in `src/components/ui/tabs.tsx` with layout-stable transitions and add sliding active indicator.
   - Replace `transition-all` in `src/components/ui/progress.tsx` with `scaleX` transforms.
   - Add `:active scale(0.97)` mechanical depression to `src/components/ui/button.tsx`.
   - Anchor `src/components/ui/popover.tsx` and `src/components/ui/dropdown-menu.tsx` to `transform-origin: var(--radix-popper-transform-origin, center)`.
2. **`src/app.css`**:
   - Add global reduced motion kill switch:
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

## 5. Verification Method

1. **Unit & Integration Suite**:
   ```bash
   cd /Users/amomo/Projets/kelson/apps/epure/web
   npm test
   ```
   *Expected*: All 109 tests pass cleanly. `design-kit-registry.test.ts` passes with exact 1:1 disk registry match.

2. **Static Typing & Linter**:
   ```bash
   npm run typecheck
   npm run lint
   ```
   *Expected*: Zero errors, zero warnings.

3. **Production Builds**:
   ```bash
   npm run build
   npm run build:playground
   ```
   *Expected*: Both client builds succeed without error.

4. **Component Registry Invalidation Check**:
   If any component is added to `src/components/ui/`, `src/components/kit/`, or `src/ui/`:
   - Inspect `src/pages/dev/design-kit/registry.ts` and `feature-ui-registry.ts`.
   - Run `npm test` to ensure `design-kit-registry.test.ts` passes.
