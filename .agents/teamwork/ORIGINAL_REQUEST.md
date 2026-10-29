# Original User Request

## 2026-10-28T17:11:20Z

Comprehensive UI/UX refactor and animation enhancement of the Epure application to achieve a native-feeling, tactile, ultra-fluid, and breathable error-tracking workspace adhering to Emil Kowalski & Apple Design engineering principles.

Working directory: /Users/amomo/Projets/kelson/apps/epure/web
Integrity mode: development

## Requirements

### R1. Design Token & Depth System Foundation
Refactor the foundational styling tokens (`calm-ledger.css`, `tokens.css`, `app.css`) to elevate visual hierarchy and tactile polish:
- Establish a refined physical depth model using APCA-compliant contrast, subtle specular rim lighting, and elevated surfaces for light and dark modes.
- Balance dense, scan-friendly telemetry rows with generous, breathable page headers and card padding.
- Maintain absolute zero layout shift across all states, locking dimensions with `tabular-nums` and stable CSS Grid tracks.

### R2. Primitives Tactility & Micro-Interactions (`@/components/ui/*`)
Overhaul all foundational UI primitives with physical responsiveness:
- Implement immediate pointer-down mechanical depression feedback (`:active scale(0.97)`) on all clickable elements with critically damped spring recovery (`damping: 1.0`, `response: 0.35s`).
- Anchor popover and dropdown entry transforms to their trigger origin (`transform-origin: var(--radix-popper-transform-origin, center)` with `scale(0.96) -> 1.0` and `opacity: 0 -> 1`).
- Provide sliding active indicators for tab groups and segment controls using layout-stable transitions.
- Eliminate opening/closing animation delays for keyboard-invoked commands (Raycast speed principle).
- Refine Sonner toast presentation into a fixed portal overlay with rich promise states, clear icon indicators, and smooth stack transitions.

### R3. Feed, Triage & Detail View Architecture (`@/components/kit/*` & `src/ui/*`)
Enhance high-frequency error triaging workflows for maximum efficiency:
- Optimize issue and alert feed rows with left unread rails, zero-shift checkbox interactions, and high-visibility keyboard navigation focus cues.
- Refine the telemetry chart and sparkline components with fluid bezier paths and precise crosshair inspection tooltips.
- Polish code syntax inspection frames and stack trace explorers with high-contrast token themes, collapsible vendor traces, and one-click copy confirmation.
- Enhance the AI Copilot triage card, filter pill bars, and quick action toolbars with clean state indicators and accessible shortcuts.

### R4. Mobile Responsiveness & Native Touch Polish
Adapt the complete application interface for touch devices:
- Configure touch action properties (`touch-action: manipulation`, removal of 300ms tap highlight and delay).
- Ensure input fields prevent unwanted browser zoom on iOS via standard 16px font minimums.
- Stabilize viewport heights with dynamic viewport units (`100dvh`) and respect device safe areas (`env(safe-area-inset-*)`).
- Integrate Vaul-driven pull-to-dismiss bottom sheet drawers for detail inspections on mobile screens.

### R5. Motion Budget & Performance Guardrails
Enforce strict performance discipline across all animations:
- Restrict all motion to composite-only properties (`transform`, `opacity`) to guarantee 120fps fluid rendering.
- Respect `prefers-reduced-motion` across every animated component.
- Ensure all animated gesture interactions remain interruptible and velocity-aware at all times.

## Acceptance Criteria

### Interactive & Visual Quality
- [ ] Every button, chip, and interactive control provides immediate pointer-down visual depression with no lag or dead touch feel.
- [ ] Popovers, dropdown menus, and modal dialogs open smoothly with custom ease-out curves and scale-in transforms anchored to their triggers.
- [ ] Tab switches animate an active pill indicator smoothly across items without layout shift.
- [ ] Keyboard navigation (j/k feed navigation, ⌘K palette trigger) responds instantly without waiting on exit animations.
- [ ] Feed checkboxes and row selections toggle with zero pixel shift in surrounding text and column alignment.
- [ ] Touch gestures, mobile sheets, and safe-area insets function seamlessly on mobile viewports.

### System Verification & Code Quality
- [ ] All 109 unit and integration tests (`npm test` in `web/`) pass cleanly with zero failures.
- [ ] TypeScript compilation (`npm run typecheck`) and ESLint (`npm run lint`) pass with zero errors and warnings.
- [ ] Design kit playground registry (`src/pages/dev/design-kit/registry.ts` and `feature-ui-registry.ts`) remains in exact 1:1 synchronization with disk components.
- [ ] No undeclared arbitrary Tailwind color classes are introduced outside the semantic token bridge.
- [ ] Web application build (`npm run build`) completes successfully.
