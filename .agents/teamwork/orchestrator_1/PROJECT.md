# Project: Epure UI/UX Refactor & Animation Polish

## Architecture
- **Design Foundation**: 5-tier styling architecture:
  1. `tokens.css`: Core dimensions, typographic scale, hairlines, and physics constants.
  2. `calm-ledger.css`: OKLCH light ("Paper Ledger") and dark ("Matte Obsidian") color themes, APCA contrast, elevation levels, and specular rim lighting.
  3. `tailwind.theme.cjs`: Shared semantic theme definitions.
  4. `src/styles/tokens.css`: Tailwind v4 bridge (`@theme inline`) with `--color-*: initial;` guardrail ensuring 100% semantic token compliance.
  5. `src/app.css`: Runtime component utilities, hardware-accelerated CSS containment, fixed overlays, and safe-area utilities.
- **UI Primitives Layer**: `@/components/ui/*` Radix UI primitives, mechanical press depression (`:active scale(0.97)`), trigger-anchored transforms (`--radix-popper-transform-origin`), sliding indicators, and fixed portal Sonner notifications.
- **Feature Layer**: `@/components/kit/*`, `src/ui/*`, and `src/features/*` feed row shells (`ISSUE_ROW_GRID`), zero-shift checkboxes, keyboard focus states (`[data-focused="true"]`), SVG cubic bezier charts/sparklines, syntax highlighting, and mobile bottom sheet drawers (Vaul).
- **Mobile & Touch**: Dynamic viewport units (`100dvh`), `viewport-fit=cover`, safe area insets (`env(safe-area-inset-*)`), `touch-action: manipulation`, iOS 16px input minimum to prevent auto-zoom.
- **Motion Budget**: Strict composite-only properties (`transform`, `opacity`), critically damped spring recovery, `@media (prefers-reduced-motion: reduce)` kill switch.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | APCA Contrast & Depth Model | Layered surface elevations, refined light/dark palettes, and specular rim lighting tokens | R1 | ORIGINAL_REQUEST §R1 |
| 2 | Specular Rim Highlights | Promotion of `.epure-surface-specular` to `--shadow-specular` for cards, dialogs, and popovers | R1 | Survey Explorer 1 |
| 3 | Brand Token Integration | Tokenize Slack (`#E01E5A`) and Discord (`#5865F2`) in `calm-ledger.css` to eliminate arbitrary hexes | R1 | Survey Explorer 1 |
| 4 | Safe Area & Easing Tokens | Add `--safe-*` and `--ease-*` / `--spring-*` constants to `tokens.css` | R1 | Survey Explorer 1 |
| 5 | Viewport & Touch Reset | Add `viewport-fit=cover` in `index.html` and `touch-action: manipulation` reset in `tokens.css` | R1 | Survey Explorer 1 & 3 |
| 6 | Mechanical Depression Feedback | Uniform `:active scale(0.97)` depression on buttons, chips, checkboxes, and tabs with critically damped spring recovery | R2 | ORIGINAL_REQUEST §R2 |
| 7 | Floating Origin Alignment | Anchor popover, dropdown, select, and tooltip transforms to `var(--radix-popper-transform-origin, center)` | R2 | ORIGINAL_REQUEST §R2 |
| 8 | Sliding Tab & Segment Indicators | Layout-stable animated indicators for tabs (`pill` and `line`) and `ToggleGroup` | R2 | ORIGINAL_REQUEST §R2 |
| 9 | Raycast Speed Principle | 0ms instantaneous opening/closing for `CommandDialog` (⌘K) | R2 | ORIGINAL_REQUEST §R2 |
| 10 | Rich Sonner Toast Overlay | Enhance Toaster with `richColors`, Phosphor icons, close button, safe-area offsets, and full `useToast` proxy | R2 | ORIGINAL_REQUEST §R2 |
| 11 | Feed Row Focus Navigation | High-visibility keyboard focus cue (`[data-focused="true"]`) for `IssueRowShell` and alert rows with zero shift | R3 | ORIGINAL_REQUEST §R3 |
| 12 | Fluid Telemetry & Sparkline Curves | Add crosshair inspection to `TelemetryChart` and SVG cubic bezier path rendering to `Sparkline` | R3 | ORIGINAL_REQUEST §R3 |
| 13 | High-Contrast Code & Stack Traces | Dynamic light/dark theme adaptation in `CodeFrame` and one-click copy feedback | R3 | ORIGINAL_REQUEST §R3 |
| 14 | Copilot & Triage Polish | Accessible focus cues and clean state indicators on triage cards and filter bars | R3 | ORIGINAL_REQUEST §R3 |
| 15 | Native Touch Configuration | Gated hover states (`@media (hover: hover)`), tap highlight removal, and 300ms tap delay elimination | R4 | ORIGINAL_REQUEST §R4 |
| 16 | Mobile Input Zoom Protection | 16px minimum font size for inputs on coarse pointer devices | R4 | ORIGINAL_REQUEST §R4 |
| 17 | Viewport & Safe-Area Padding | Apply dynamic `100dvh` and safe-area padding to headers, overlays, toasts, and toolbars | R4 | ORIGINAL_REQUEST §R4 |
| 18 | Vaul Bottom Sheet Drawer | Integrate Vaul drawer for detail inspection on mobile screens (< 768px) with pull-to-dismiss physics | R4 | ORIGINAL_REQUEST §R4 |
| 19 | Composite-Only Motion | Eliminate `transition-all` in tabs, progress, and cards in favor of `transform` and `opacity` | R5 | ORIGINAL_REQUEST §R5 |
| 20 | Reduced Motion Guardrail | Global `@media (prefers-reduced-motion: reduce)` kill switch across all animated utilities | R5 | ORIGINAL_REQUEST §R5 |
| 21 | Velocity-Aware Interruption | Ensure drawer and gesture interactions remain velocity-aware and interruptible | R5 | ORIGINAL_REQUEST §R5 |
| 22 | Full Test & Build Suite Pass | All 109 unit tests, `typecheck`, `lint`, and both Vite builds pass cleanly | Final | ORIGINAL_REQUEST Acceptance |
| 23 | Design Kit Registry Parity | Verify `src/pages/dev/design-kit/registry.ts` and `feature-ui-registry.ts` match disk components 1:1 | Final | ORIGINAL_REQUEST Acceptance |
| 24 | Semantic Token Bridge Audit | Verify 0 undeclared arbitrary Tailwind color classes outside semantic tokens | Final | ORIGINAL_REQUEST Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| R1 | Design Token & Depth System Foundation | Foundational CSS tokens, elevation, specular rim, brand tokens, zero-shift verification | none | DONE |
| R2 | Primitives Tactility & Micro-Interactions | Button depression, Radix trigger origins, sliding tab indicators, Raycast 0ms ⌘K, Sonner | R1 | IN_PROGRESS |
| R3 | Feed, Triage & Detail View Architecture | Feed row focus styling, telemetry crosshairs, SVG sparkline beziers, code themes | R2 | PLANNED |
| R4 | Mobile Responsiveness & Native Touch Polish | Input 16px minimum, safe areas, 100dvh, Vaul mobile bottom drawer | R3 | PLANNED |
| R5 | Motion Budget & Performance Guardrails | Composite-only transitions, elimination of `transition-all`, reduced-motion kill switch | R4 | PLANNED |
| Final | Full Verification & Adversarial Hardening | 109 tests, typecheck, lint, build, registry 1:1 parity test, token scan, auditor veto | R5 | PLANNED |

## Interface Contracts

### Tokens (`calm-ledger.css` & `src/styles/tokens.css`) ↔ Primitives (`@/components/ui/*`)
- `--shadow-specular`: Multi-layer box shadow with specular inset highlight.
- `--ease-mechanical`: `cubic-bezier(0.16, 1, 0.3, 1)`.
- `--ease-out`: `cubic-bezier(0.23, 1, 0.32, 1)`.
- `--ease-drawer`: `cubic-bezier(0.32, 0.72, 0, 1)`.
- `--color-channel-slack`: Semantic brand token for Slack `#E01E5A`.
- `--color-channel-discord`: Semantic brand token for Discord `#5865F2`.

### Radix UI Popper ↔ Floating Primitives
- Transform Origin: `[transform-origin:var(--radix-popper-transform-origin,center)]` on `PopoverContent`, `DropdownMenuContent`, `DropdownMenuSubContent`, `SelectContent`.
- Transform Origin: `[transform-origin:var(--radix-tooltip-content-transform-origin,center)]` on `TooltipContent`.

### Feed Row Shell ↔ Feed Navigation
- CSS Selector: `.epure-feed-row[data-focused="true"]` must apply high-contrast focus indicator (`box-shadow: inset 2px 0 0 0 var(--accent)` or similar) with ZERO width or height layout shift.

### Mobile Sheet ↔ Detail Overlay
- Desktop (`md:`): Side drawer or split panel.
- Mobile (`max-md:`): Vaul bottom sheet drawer (`Drawer.Root`, `Drawer.Content`, `Drawer.Handle`) with pull-to-dismiss gesture and safe area bottom padding.

## Code Layout
- `web/design/tokens.css`: Base geometry, typography, and motion variables.
- `web/design/themes/calm-ledger.css`: Canonical color tokens, elevations, shadows.
- `web/src/styles/tokens.css`: Tailwind v4 theme bridge and base resets.
- `web/src/app.css`: Utilities, specular classes, fixed overlays, and virtualization containment.
- `web/src/components/ui/*`: Foundational primitives (Button, Dialog, Popover, Dropdown, Tabs, Command, Sonner, Sheet, Input).
- `web/src/components/kit/*`: Feed and workflow domain components (IssueRowShell, TelemetryChart, CodeFrame, CommandBar).
- `web/src/ui/*`: Visual blocks and feature helpers (Sparkline, FilterChip, SourceCodeBlock, IssueDetailOverlay, ToastProvider).
- `web/src/pages/dev/design-kit/*`: Component playground catalog and registry test suite.
