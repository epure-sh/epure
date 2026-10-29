# Survey Analysis: UI Primitives & Tactility (Milestone R2)

**Explorer**: Survey Explorer 2 (UI Primitives & Tactility Specialist)  
**Target Codebase**: `apps/epure/web`  
**Timestamp**: 2026-10-28T18:22:00Z  

---

## 1. Executive Summary

A comprehensive forensic audit was conducted across all foundational UI primitives in `web/src/components/ui/*` and their corresponding feature façades in `web/src/ui/*`. The survey evaluated physical responsiveness, mechanical press feedback, transform-origin anchoring, tab indicator sliding transitions, command palette latency, and toast orchestration against Emil Kowalski & Apple Design engineering principles.

### Key Discoveries:
1. **Mechanical Press Feedback Deficit**: Buttons and interactive controls currently rely on an ad-hoc `active:translate-y-[0.5px]` translation with a weak linear/ease-out duration (`duration-100 ease-out`). The ghost variant explicitly cancels depression (`active:translate-y-0`). Clickable chips (`FilterChip`), segment items (`ToggleGroupItem`), tabs (`TabsTrigger`), and checkboxes have no mechanical depression (`:active scale(0.97)`) on pointer-down.
2. **Missing Transform Origins on Floating Primitives**: Radix UI popovers (`PopoverContent`), dropdowns (`DropdownMenuContent`, `DropdownMenuSubContent`), selects (`SelectContent`), and tooltips (`TooltipContent`) animate from `center` or default origins because `[transform-origin:var(--radix-popper-transform-origin,center)]` is completely missing.
3. **Static Tab & Segment Indicators**: `Tabs` and `ToggleGroup` switch active states via instant background color swaps and violate animation hygiene rules with `transition-all`. Neither primitive provides a layout-stable sliding indicator.
4. **Command Palette Exit Lag**: `CommandDialog` wraps standard `DialogContent` with a 150ms+ fade/zoom exit animation, violating the Raycast speed principle for 100+/day keyboard actions.
5. **Incomplete Sonner Toast Orchestration**: The Sonner `<Toaster />` lacks `richColors`, custom status icons, close buttons, and mobile safe-area offsets. The existing `useToast()` bridge only accepts plain strings, preventing feature components from invoking promise, success, or error toasts.

---

## 2. Complete Inventory of UI Primitives

The web application contains 21 foundational primitive modules in `src/components/ui/*` registered in `src/pages/dev/design-kit/registry.ts`, paired with corresponding façades and composite controls in `src/ui/*` registered in `feature-ui-registry.ts`.

| Module | Source Path | Façade / Wrapper Path | Underlying Engine | Current State & Gaps |
|---|---|---|---|---|
| **Button** | `src/components/ui/button.tsx` | `src/ui/button.tsx`, `src/ui/action-button.tsx`, `src/ui/copy-button.tsx`, `src/ui/apply-with-ai-button.tsx` | Radix Slot + CVA | Uses `active:translate-y-[0.5px]` and weak duration; ghost variant cancels press; missing `:active scale(0.97)` and critically damped spring recovery. |
| **Badge** | `src/components/ui/badge.tsx` | `src/ui/badge.tsx`, `src/ui/shared-project-badge.tsx` | CVA | Static display; lacks press feedback when used as interactive filter. |
| **Checkbox** | `src/components/ui/checkbox.tsx` | `src/ui/checkbox.tsx` | `@radix-ui/react-checkbox` | Abrupt indicator mounting; no `:active` mechanical depression feedback (`scale(0.92)`). |
| **Switch** | `src/components/ui/switch.tsx` | `src/ui/switch.tsx` | `@base-ui/react/switch` | Uses `duration-150 ease-out` on thumb; lacks tactile press deformation or spring feedback. |
| **RadioGroup** | `src/components/ui/radio-group.tsx` | `src/ui/radio-group.tsx` | `radix-ui` | No active press scale feedback. |
| **Input** | `src/components/ui/input.tsx` | `src/ui/input.tsx`, `src/ui/field.tsx` | CVA | Good baseline; lacks active focus ring spring dynamics and iOS 16px zoom guard. |
| **Label** | `src/components/ui/label.tsx` | `src/ui/label.tsx` | `@radix-ui/react-label` | Functional; no issues. |
| **Select** | `src/components/ui/select.tsx` | `src/ui/select.tsx` | `@radix-ui/react-select` | `SelectTrigger` lacks press feedback; `SelectContent` has no entry scale transform and no `var(--radix-popper-transform-origin)`. |
| **Popover** | `src/components/ui/popover.tsx` | `src/ui/popover.tsx` | `@radix-ui/react-popover` | Missing `transform-origin: var(--radix-popper-transform-origin, center)`; entry scale is hardcoded `zoom-in-95` instead of `scale(0.96)`. |
| **DropdownMenu** | `src/components/ui/dropdown-menu.tsx` | `src/ui/dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | Missing `--radix-popper-transform-origin`; SubContent has no scale entry; items lack tactile depression. |
| **Dialog** | `src/components/ui/dialog.tsx` | `src/ui/dialog.tsx` | `@radix-ui/react-dialog` | Centered modal (exempt from trigger origin); needs polished duration (200-250ms) and custom ease-out curve. |
| **Sheet** | `src/components/ui/sheet.tsx` | — | `@radix-ui/react-dialog` | Uses `ease-in-out` on enter/exit instead of `var(--ease-drawer)` or `ease-out`; lacks mobile velocity-aware gesture integration. |
| **Tooltip** | `src/components/ui/tooltip.tsx` | `src/ui/tooltip.tsx` | `@radix-ui/react-tooltip` | Missing transform-origin anchoring; no instant switch across adjacent tooltips (`skipDelayDuration`). |
| **Tabs** | `src/components/ui/tabs.tsx` | `src/ui/tabs.tsx`, `src/ui/issue-detail-tabs.tsx` | `@radix-ui/react-tabs` | No sliding active indicator; uses `transition-all`; no press feedback. |
| **ToggleGroup** | `src/components/ui/toggle-group.tsx` | — | `@radix-ui/react-toggle-group` | Used as segmented control; lacks sliding indicator and press feedback. |
| **Command** | `src/components/ui/command.tsx` | `src/ui/command.tsx`, `src/shell/command-palette.tsx`, `src/components/kit/command-bar.tsx` | `cmdk` | `CommandDialog` inherits 150ms+ dialog exit animation, causing noticeable delay on ⌘K and Escape. |
| **Sonner** | `src/components/ui/sonner.tsx` | `src/ui/toast-provider.tsx`, `src/ui/toast.tsx` | `sonner` | Missing `richColors`, bespoke icons, close button, and safe-area offsets; `useToast()` is restricted to string-only. |
| **Progress** | `src/components/ui/progress.tsx` | — | Custom | Uses `transition-all duration-300`; `SegmentedProgress` animates layout `width`. |
| **Separator** | `src/components/ui/separator.tsx` | `src/ui/separator.tsx` | `@radix-ui/react-separator` | Clean hairline divider. |
| **Table** | `src/components/ui/table.tsx` | — | Custom HTML | Functional; row hover transitions present. |
| **Icon** | `src/components/ui/icon.tsx` | — | `@phosphor-icons/react` | Re-exports Phosphor icons; clean. |
| **FilterChip** | — | `src/ui/filter-chip.tsx` | Custom Button | Core interactive triage control; missing `:active scale(0.97)` mechanical depression. |
| **Card** | — | `src/ui/card.tsx` | Custom HTML | Pure layout container; no issues. |

---

## 3. Deep-Dive Findings

### 3.1. Click & Press Feedback (Mechanical Depression)
- **Current Observation**: In `src/components/ui/button.tsx` (lines 12–13):
  ```ts
  "transition-[background-color,border-color,transform,opacity] duration-100 ease-out",
  "active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
  ```
  And in the `ghost` variant (line 23):
  ```ts
  ghost: "bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary active:translate-y-0",
  ```
- **Physical Defect**: `translate-y-[0.5px]` creates a 1D vertical displacement that feels like a glitchy pixel drop rather than a physical key depression. In ghost buttons, it is canceled entirely.
- **Principle**: Apple WWDC *Designing Fluid Interfaces* & Emil Kowalski:
  * "Buttons must feel responsive to press. Add `transform: scale(0.97)` on `:active` with `transition: transform 160ms var(--ease-out)`. Scale scales children too (font, icon, badge) proportionally, creating a true mechanical press sensation."
  * Hover feedback must be gated behind `@media (hover: hover) and (pointer: fine)` to avoid sticky tap highlights on touch screens.
  * Critically damped spring recovery: `damping: 1.0`, `response: 0.35s` (no overshoot, immediate rebound on release).

### 3.2. Radix UI Primitives & Transform Origin Anchoring
- **Current Observation**:
  * `PopoverContent` (`src/components/ui/popover.tsx`, line 24):
    ```ts
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
    ```
  * `DropdownMenuContent` (`src/components/ui/dropdown-menu.tsx`, line 69):
    ```ts
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
    ```
  * `SelectContent` (`src/components/ui/select.tsx`, line 51):
    ```ts
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    ```
  * `TooltipContent` (`src/components/ui/tooltip.tsx`, line 22):
    ```ts
    "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0"
    ```
- **Defect**: Radix Popper computes and attaches `--radix-popper-transform-origin` (e.g., `bottom left`, `top right`) to the content container. Without explicit CSS referencing this variable, the browser defaults to `transform-origin: 50% 50%` (center). Popovers, dropdown menus, and selects appear to "float in from nowhere" rather than blooming out of the button that spawned them.
- **Fix Required**:
  Add `[transform-origin:var(--radix-popper-transform-origin,center)]` and refine entrance scaling to `data-[state=open]:zoom-in-[0.96] data-[state=closed]:zoom-out-[0.96]` with `duration-150` and `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`).

### 3.3. Tab Groups & Segmented Controls
- **Current Observation**: In `src/components/ui/tabs.tsx` (lines 78–84):
  ```ts
  "inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong disabled:pointer-events-none disabled:opacity-40",
  variant === "line"
    ? "rounded-none border-b-2 border-transparent px-3 py-1.5 text-fg-muted hover:text-fg-primary data-[state=active]:border-accent data-[state=active]:text-fg-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
    : variant === "folder"
      ? "-mb-px rounded-t-md border border-transparent px-3 py-1.5 text-fg-muted hover:text-fg-primary data-[state=active]:border-border-subtle data-[state=active]:border-b-surface-1 data-[state=active]:bg-surface-1 data-[state=active]:font-semibold data-[state=active]:text-fg-primary"
      : "rounded-xs px-2.5 py-1 text-fg-secondary hover:text-fg-primary data-[state=active]:bg-surface-1 data-[state=active]:text-fg-primary data-[state=active]:shadow-tactile",
  ```
- **Defects**:
  1. `transition-all`: Violates animation design rules by animating unbudgeted properties.
  2. No Sliding Active Indicator: Clicking adjacent tabs swaps background/border colors instantaneously. There is no physical gliding pill indicator.
  3. `ToggleGroupItem` in `src/components/ui/toggle-group.tsx` suffers from identical static transitions.
- **Solution**:
  Use `motion` (already in `package.json` v14.6.0) or layout-stable CSS indicator. For pill tabs and segment controls, rendering an active background pill with `layoutId="active-tab-pill"` (or an active underline for line variant) gives a hardware-accelerated, critically damped glide (`type: "spring", bounce: 0.15, duration: 0.32`) with zero layout shift. In `prefers-reduced-motion`, it renders as an instant crossfade.

### 3.4. Command Palette (Raycast Speed Principle)
- **Current Observation**: In `src/components/ui/command.tsx` (lines 30–38):
  ```tsx
  export function CommandDialog({ open, onOpenChange, children }: CommandDialogProps) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="overflow-hidden p-0 max-w-lg shadow-float border-border-strong [&>button]:hidden">
          <Command className="...">
            {children}
          </Command>
        </DialogContent>
      </Dialog>
    );
  }
  ```
- **Defect**: `DialogContent` attaches `data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 ...`. When an engineer hits `⌘K` or presses `Escape`, or selects a command, Radix keeps the portal mounted while the 150ms exit animation runs.
- **Principle**: Emil Kowalski & Raycast:
  * "Frequency: 100+ times/day (keyboard shortcuts, command palette toggle) → No animation. Ever. Animation makes high-frequency tools feel slow, delayed, and disconnected from the user's keystrokes. Raycast has no open/close animation."
- **Solution**:
  In `CommandDialog`, pass `data-[state=open]:duration-0 data-[state=closed]:duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none` to both `DialogOverlay` and `DialogContent` so that `⌘K` opens and closes in exactly 0ms.

### 3.5. Sonner Toast Setup
- **Current Observation**: In `src/components/ui/sonner.tsx` (lines 17–33):
  * Positions at `bottom-right`.
  * Lacks `richColors`.
  * Uses unmapped token classes: `group-[.toast]:bg-primary group-[.toast]:text-primary-fg` (should be `bg-accent text-accent-contrast`).
  * Has no `icons` configuration.
  * Has no `closeButton: true`.
  * Has no mobile offset (`mobileOffset`).
- **Defect in `src/ui/toast-provider.tsx`**:
  ```ts
  export interface ToastContextValue {
    toast: (message: string) => void;
  }
  ```
  Calls to `useToast().toast(...)` only allow strings, blocking `toast.success()`, `toast.error()`, and `toast.promise()`.
- **Solution**:
  1. Add `richColors`, `closeButton`, `visibleToasts={4}`, `gap={10}`, and safe-area responsive offsets to `Toaster`.
  2. Supply standard Phosphor icons (`CheckCircle`, `WarningCircle`, `Warning`, `Info`, `CircleNotch`).
  3. Expand `ToastContextValue` in `toast-provider.tsx` to proxy the full `sonnerToast` API while maintaining backwards compatibility with `toast(msg: string)`.

---

## 4. Architectural Layout & Token Compliance

1. **Tokens**:
   - `design/tokens.css` already exports `--ease-mechanical: cubic-bezier(0.16, 1, 0.3, 1)`, `--duration-fast: 80ms`, `--duration-base: 120ms`.
   - We will establish `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`, and `--spring-press: cubic-bezier(0.2, 0, 0, 1)` to standardize all primitive micro-interactions.
2. **Registry Synchronization**:
   - No primitive files will be added or removed in R2; existing disk files match `DESIGN_KIT_UI_MODULES` (21 modules) and `DESIGN_KIT_FEATURE_UI_FACADES` (15 modules) 1:1, guaranteeing `npm test` registry assertions pass.
3. **Layer 1 Phosphor Icon Law**:
   - `src/components/ui/*` must import icons exclusively from `@phosphor-icons/react` or the internal `@/components/ui/icon` wrapper.
   - `src/ui/*` may use `lucide-react` or `@phosphor-icons/react`.

---

## 5. Review Format Checklist (Before vs After)

| Component | Before | After | Why |
|---|---|---|---|
| `Button` | `transition-[...transform...] duration-100 ease-out active:translate-y-[0.5px]` | `transition-transform duration-160 ease-[var(--ease-mechanical)] active:scale-[0.97]` | Immediate pointer-down mechanical depression with critically damped spring recovery |
| `Button (ghost)` | `active:translate-y-0` | `active:scale-[0.97]` | Ghost buttons must feel as tactile as filled buttons |
| `FilterChip` | `transition-colors duration-fast` (no active state) | `transition-[transform,color] duration-160 ease-[var(--ease-mechanical)] active:scale-[0.97]` | Filter chips are high-frequency click targets requiring tactile feedback |
| `PopoverContent` | Default transform-origin (center) | `[transform-origin:var(--radix-popper-transform-origin,center)] data-[state=open]:zoom-in-[0.96]` | Popovers must bloom from their trigger origin |
| `DropdownMenuContent` | Default transform-origin (center) | `[transform-origin:var(--radix-popper-transform-origin,center)] data-[state=open]:zoom-in-[0.96]` | Dropdown must scale from trigger location |
| `DropdownMenuSubContent` | Fade only, no scale | `[transform-origin:var(--radix-popper-transform-origin,center)] data-[state=open]:zoom-in-[0.96]` | Submenus must originate from parent item |
| `SelectContent` | Fade only, no scale | `[transform-origin:var(--radix-popper-transform-origin,center)] data-[state=open]:zoom-in-[0.96]` | Select menu must blossom from trigger |
| `TooltipContent` | Default center origin, no scale | `[transform-origin:var(--radix-tooltip-content-transform-origin,center)] data-[state=delayed-open]:zoom-in-[0.97]` | Tooltips scale out of trigger with fast 125ms duration |
| `TabsTrigger` | `transition-all` | `transition-[color,background-color] active:scale-[0.97]` | Specific property transition; prevents unbudgeted layout recalculations |
| `Tabs` | Color swap only | Sliding active pill/line indicator via `motion` layout or CSS | Visual continuity across tabs without layout shift |
| `ToggleGroupItem` | `transition-colors` only | `transition-colors active:scale-[0.97]` + sliding segment indicator | High-fidelity tactile segment control |
| `CommandDialog` | 150ms+ zoom/fade enter and exit | `data-[state=open]:duration-0 data-[state=closed]:duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none` | Raycast speed principle: 0ms delay on 100+/day keyboard commands |
| `Sonner Toaster` | Missing rich colors & icons | `richColors closeButton icons={{...}} mobileOffset={{...}}` | Rich promise states, clear icon indicators, and smooth stacking transitions |
| `Progress` | `transition-all duration-300` | `transition-transform duration-300 ease-out` | Animate composite-only transform rather than `all` |
| `SegmentedProgress` | Animates `width` with `duration-500` | Animates composite `scaleX` or hardware-accelerated transform | Avoid continuous layout/reflow cycles |
