# Handoff Report: UI Primitives & Tactility Survey (Milestone R2)

**Agent**: Survey Explorer 2 (UI Primitives & Tactility Specialist)  
**Task ID / Milestone**: Milestone R2 (Primitives Tactility & Micro-Interactions)  
**Date**: 2026-10-28T18:22:45Z  
**Recipient**: Orchestrator (`29c6a32f-7318-43eb-b9bc-1ba766ff2431`)  

---

## 1. Observation

Direct observations and evidence gathered from the codebase (`/Users/amomo/Projets/kelson/apps/epure/web`):

1. **Button Active State**:
   - `web/src/components/ui/button.tsx` (lines 12–13):
     ```ts
     "transition-[background-color,border-color,transform,opacity] duration-100 ease-out",
     "active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
     ```
   - Line 23:
     ```ts
     ghost: "bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary active:translate-y-0",
     ```
   - Ad-hoc class `.btn-tactile` defined in `src/app.css` (lines 101–110) with `scale(0.98) translateY(0.5px)` is NOT applied in `Button`, only scattered manually across 10 random feature files.

2. **Popover & Dropdown Transform Origins**:
   - `web/src/components/ui/popover.tsx` (line 24):
     ```ts
     "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
     ```
   - `web/src/components/ui/dropdown-menu.tsx` (line 69 & line 49):
     `DropdownMenuContent` uses generic `zoom-in-95` without origin anchoring; `DropdownMenuSubContent` has no scale at all.
   - `web/src/components/ui/select.tsx` (line 51):
     `SelectContent` only has fade (`fade-in-0`, `fade-out-0`), no scale and no origin.
   - `web/src/components/ui/tooltip.tsx` (line 22):
     `TooltipContent` only has fade (`fade-in-0`, `fade-out-0`), no scale and no origin.
   - Neither component references `var(--radix-popper-transform-origin)`.

3. **Tab & Segment Indicators**:
   - `web/src/components/ui/tabs.tsx` (lines 78–84):
     ```ts
     "inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong disabled:pointer-events-none disabled:opacity-40",
     variant === "line"
       ? "rounded-none border-b-2 border-transparent px-3 py-1.5 text-fg-muted hover:text-fg-primary data-[state=active]:border-accent data-[state=active]:text-fg-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
       : variant === "folder"
         ? "-mb-px rounded-t-md border border-transparent px-3 py-1.5 text-fg-muted hover:text-fg-primary data-[state=active]:border-border-subtle data-[state=active]:border-b-surface-1 data-[state=active]:bg-surface-1 data-[state=active]:font-semibold data-[state=active]:text-fg-primary"
         : "rounded-xs px-2.5 py-1 text-fg-secondary hover:text-fg-primary data-[state=active]:bg-surface-1 data-[state=active]:text-fg-primary data-[state=active]:shadow-tactile",
     ```
     Uses `transition-all` and swaps background colors instantly with no sliding indicator.
   - `web/src/components/ui/toggle-group.tsx` (lines 8–13):
     `ToggleGroupItem` uses `transition-colors select-none` with static background swap.

4. **Command Palette Exit Latency**:
   - `web/src/components/ui/command.tsx` (lines 30–38):
     `CommandDialog` directly mounts standard `DialogContent`, which has `data-[state=closed]:animate-out data-[state=closed]:zoom-out-95` with default 150ms+ exit animation. On `⌘K`, Escape, or item execution, the palette lingers during animation.

5. **Sonner Toast Setup**:
   - `web/src/components/ui/sonner.tsx` (lines 17–33):
     Lacks `richColors`, `icons`, `closeButton`, `mobileOffset`.
     Action button uses `group-[.toast]:bg-primary group-[.toast]:text-primary-fg` instead of Calm Ledger token classes (`bg-accent text-accent-contrast`).
   - `web/src/ui/toast-provider.tsx` (lines 4–12):
     `useToast().toast` only accepts `string` (`toast: (message: string) => void`), blocking `toast.success`, `toast.error`, `toast.promise`.

6. **Interactive Chips & Controls**:
   - `web/src/ui/filter-chip.tsx` (lines 57 & 81): Only uses `transition-colors duration-fast`; zero pointer-down active scale.
   - `web/src/components/ui/checkbox.tsx`: Lacks active scale (`active:scale-[0.92]`).

7. **Test Baseline**:
   - Running `npm test` in `web/` yields 109 passing tests (0 failures, 20 suites, 1.75s).
   - Registry consistency tests (`design kit registry matches ui/ and kit/ on disk`, `feature-ui groups are sorted and unique`, `feature-ui registry covers every src/ui module`) enforce strict 1:1 parity with files on disk.

---

## 2. Logic Chain

1. **Premise 1 (Physical Tactility)**:
   Per Apple WWDC *Designing Fluid Interfaces* and Emil Kowalski's core principles, an interface feels direct and responsive only when elements respond immediately on pointer-down with mechanical depression (`:active scale(0.97)`) and rebound via critically damped springs (`damping: 1.0`, `response: 0.35s`).
   - *From Observation 1 & 6*: The current application uses `active:translate-y-[0.5px]` on `Button` (and cancels it on ghost buttons), and omits it entirely on `FilterChip`, `Checkbox`, `ToggleGroupItem`, and `TabsTrigger`.
   - *Inference*: The tactile feel across the application is flat, inconsistent, and mushy. Implementing uniform `:active:scale-[0.97]` with `--ease-mechanical` (`cubic-bezier(0.16, 1, 0.3, 1)`) and `@media (hover: hover) and (pointer: fine)` hover gating across all clickable primitives will restore native-feeling physical responsiveness.

2. **Premise 2 (Spatial Consistency & Transform Origins)**:
   Per Apple WWDC Principle 7 (*Spatial Consistency*) and Emil Kowalski: "Popovers should scale from their trigger, not from center. Anchor interactions to their source."
   - *From Observation 2*: Floating Radix primitives (`PopoverContent`, `DropdownMenuContent`, `SelectContent`, `TooltipContent`) do not reference `var(--radix-popper-transform-origin)` and scale from center.
   - *Inference*: Applying `[transform-origin:var(--radix-popper-transform-origin,center)]` with a scale transition of `scale(0.96) -> 1.0` and `opacity: 0 -> 1` aligns the spatial illusion that the floating panel blooms directly out of the invoking trigger.

3. **Premise 3 (Sliding Indicators vs Layout Shifts)**:
   Requirement R2 specifies sliding active indicators for tab groups and segment controls with zero layout shift.
   - *From Observation 3*: `Tabs` and `ToggleGroup` currently swap backgrounds statically.
   - *Inference*: Integrating a layout-stable sliding indicator (via `motion` or an animated CSS pill) gives a fluid transition across tab items without causing reflows.

4. **Premise 4 (Raycast Speed Principle)**:
   For tools invoked 100+ times/day via keyboard (like `⌘K`), opening and closing animations add perceptual latency and sluggishness.
   - *From Observation 4*: `CommandDialog` inherits a 150ms+ exit animation from `DialogContent`.
   - *Inference*: Disabling animation delays on `CommandDialog` (`data-[state=open]:duration-0 data-[state=closed]:duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none`) guarantees 0ms instantaneous opening and unmounting.

5. **Premise 5 (Sonner Rich States & Stacking)**:
   Requirement R2 specifies a fixed portal overlay with rich promise states, clear icon indicators, and smooth stack transitions.
   - *From Observation 5*: Sonner lacks rich colors, custom icons, close button, and mobile safe-area offsets, while `useToast()` is artificially constrained to strings.
   - *Inference*: Enabling `richColors`, injecting bespoke Phosphor icons, configuring mobile offsets, and proxying the full `sonner` API in `toast-provider.tsx` unlocks rich promise workflows across all feature views.

---

## 3. Caveats

1. **Registry Parity**: No files in `src/components/ui/` or `src/ui/` should be created or deleted without updating `src/pages/dev/design-kit/registry.ts` and `feature-ui-registry.ts`. All enhancements must be in-place edits on existing modules.
2. **Layer 1 Phosphor Icon Rule**: Files inside `src/components/ui/*` must import icons exclusively from `@phosphor-icons/react` or `@/components/ui/icon`. They must not import from `lucide-react`.
3. **Motion Library Usage**: The project has `"motion": "^14.6.0"` installed. When using `motion` for layout sliding indicators, full transform properties should be preferred to preserve hardware-accelerated composite performance under heavy telemetry loads.
4. **Desktop vs Touch Hover**: Any hover effect added to buttons or chips must be gated behind `@media (hover: hover) and (pointer: fine)` to avoid sticky hover states on iOS/Android devices.

---

## 4. Conclusion & Actionable Implementation Plan for Milestone R2

### Proposed Motion & Spring Parameters:
- **Button / Chip Press Depression**:
  - Transform: `scale(0.97)` on `:active`
  - Checkbox / Radio Press: `scale(0.92)` on `:active`
  - Easing Curve: `var(--ease-mechanical)` = `cubic-bezier(0.16, 1, 0.3, 1)` or `cubic-bezier(0.23, 1, 0.32, 1)`
  - Transition Duration: `160ms`
  - Spring Recovery equivalent: `damping: 1.0`, `response: 0.35s` (critically damped, zero overshoot)
- **Popover / Dropdown / Select Entry**:
  - Transform Origin: `var(--radix-popper-transform-origin, center)`
  - Scale: `scale(0.96) -> scale(1.0)`
  - Opacity: `0 -> 1`
  - Duration: `150ms` ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`)
- **Tooltip Entry**:
  - Transform Origin: `var(--radix-tooltip-content-transform-origin, center)`
  - Scale: `scale(0.97) -> scale(1.0)`
  - Duration: `125ms` ease-out; `skipDelayDuration: 300ms` for instant neighbor hover
- **Tab / Segment Sliding Indicator**:
  - Spring: `type: "spring"`, `bounce: 0.15`, `duration: 0.32s`
  - Composite-only layout transition; `prefers-reduced-motion` crossfade fallback
- **Command Palette (`⌘K`)**:
  - Open & Close Duration: `0ms` (instantaneous, zero animation delay)
- **Sonner Toast**:
  - Stacking: `visibleToasts: 4`, `gap: 10`, `richColors: true`, `closeButton: true`
  - Mobile Offset: `bottom: calc(env(safe-area-inset-bottom, 0px) + 16px)`, `right: 16px`, `left: 16px`
  - Custom Icons: Phosphor `CheckCircle`, `WarningCircle`, `Warning`, `Info`, `CircleNotch`

### Exact Files to Enhance for Milestone R2:
1. `web/src/components/ui/button.tsx` — Add `:active:scale-[0.97]`, 160ms mechanical transition, remove ghost active cancel, add hover media query.
2. `web/src/components/ui/popover.tsx` — Add `[transform-origin:var(--radix-popper-transform-origin,center)]` and `scale(0.96)` zoom.
3. `web/src/components/ui/dropdown-menu.tsx` — Add `[transform-origin:var(--radix-popper-transform-origin,center)]` to Content and SubContent, add item press feedback.
4. `web/src/components/ui/select.tsx` — Add `[transform-origin:var(--radix-popper-transform-origin,center)]`, zoom-in-96, and trigger press depression.
5. `web/src/components/ui/tooltip.tsx` — Add `[transform-origin:var(--radix-tooltip-content-transform-origin,center)]`, zoom-in-97, 125ms duration.
6. `web/src/components/ui/tabs.tsx` — Implement layout-stable sliding active indicator for pill and line variants, remove `transition-all`, add active press.
7. `web/src/components/ui/toggle-group.tsx` — Implement sliding segment indicator and active press feedback.
8. `web/src/components/ui/command.tsx` — Set `duration-0` / `animate-none` on `CommandDialog` for 0ms instantaneous opening and closing.
9. `web/src/components/ui/sonner.tsx` — Add `richColors`, `closeButton`, custom Phosphor status icons, token color classes, mobile safe-area offsets.
10. `web/src/ui/toast-provider.tsx` — Expand `ToastContextValue` to proxy full `sonnerToast` API (`toast.success`, `toast.error`, `toast.promise`).
11. `web/src/components/ui/checkbox.tsx` — Add active press scale (`scale(0.92)`) and spring check reveal.
12. `web/src/components/ui/switch.tsx` — Add tactile thumb compression and spring physics.
13. `web/src/components/ui/radio-group.tsx` — Add active press feedback.
14. `web/src/components/ui/sheet.tsx` — Replace `ease-in-out` with `var(--ease-drawer)` / `ease-out`.
15. `web/src/components/ui/progress.tsx` — Replace `transition-all` with composite-only transforms.
16. `web/src/ui/filter-chip.tsx` — Add `:active:scale-[0.97]` mechanical depression to query and preset chips.
17. `web/src/app.css` & `web/design/tokens.css` — Standardize `--ease-mechanical`, `--ease-out`, `--ease-drawer`, and tactile utility classes.

---

## 5. Verification Method

To independently verify all findings and test proposals:

1. **Test Suite Execution**:
   ```bash
   cd /Users/amomo/Projets/kelson/apps/epure/web
   npm test
   ```
   *Expected*: All 109 unit and integration tests pass cleanly, including `tabs.test.ts` and registry sync tests.
2. **TypeScript Compilation & Linting**:
   ```bash
   npm run typecheck
   npm run lint
   ```
   *Expected*: Zero TypeScript errors and zero ESLint warnings.
3. **Application Build**:
   ```bash
   npm run build
   ```
   *Expected*: Successful Vite bundle creation with no missing tokens or broken imports.
4. **Code Inspection**:
   - Verify `Button` variants in `src/components/ui/button.tsx` include `active:scale-[0.97]`.
   - Verify `PopoverContent` in `src/components/ui/popover.tsx` contains `[transform-origin:var(--radix-popper-transform-origin,center)]`.
   - Verify `CommandDialog` in `src/components/ui/command.tsx` has `duration-0` / `animate-none`.
   - Verify `Toaster` in `src/components/ui/sonner.tsx` contains `richColors` and custom icons.
