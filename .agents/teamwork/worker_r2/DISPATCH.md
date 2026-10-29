## 2026-10-28T17:45:07Z
You are Worker R2 (Primitives Tactility & Micro-Interactions) for the Epure UI/UX refactor project.

Your assigned metadata working directory:
/Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/worker_r2/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You MUST read these documents before starting:
- /Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/orchestrator_1/PROJECT.md
- /Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/explorer_survey_2/handoff.md

Relevant design skills:
- /Users/amomo/Projets/kelson/apps/epure/.agents/skills/apple-design/SKILL.md
- /Users/amomo/Projets/kelson/apps/epure/.agents/skills/emil-design-eng/SKILL.md
- /Users/amomo/Projets/kelson/apps/epure/.agents/skills/animate/SKILL.md
- /Users/amomo/Projets/kelson/apps/epure/.agents/skills/ask-sonner/SKILL.md

Target project directory:
/Users/amomo/Projets/kelson/apps/epure/web

Files you exclusively own for editing:
- `src/components/ui/button.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/toggle-group.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/sonner.tsx`
- `src/ui/toast-provider.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/progress.tsx`
- `src/ui/filter-chip.tsx`

Tasks for Milestone R2:
1. `Button` (`src/components/ui/button.tsx`):
   - Add `:active scale(0.97)` mechanical depression with critically damped return (`transition-transform duration-150` with `cubic-bezier(0.16, 1, 0.3, 1)` or `var(--ease-mechanical)`).
   - Remove ghost button `active:translate-y-0` override so all buttons have tactile depression.
   - Gate hover transitions behind `@media (hover: hover) and (pointer: fine)`.
2. Floating Origins:
   - `PopoverContent` (`src/components/ui/popover.tsx`): Add `[transform-origin:var(--radix-popper-transform-origin,center)]`, `scale(0.96) -> 1.0`, `opacity: 0 -> 1`.
   - `DropdownMenuContent` and `DropdownMenuSubContent` (`src/components/ui/dropdown-menu.tsx`): Add `[transform-origin:var(--radix-popper-transform-origin,center)]`, `scale(0.96) -> 1.0`, item press feedback.
   - `SelectContent` (`src/components/ui/select.tsx`): Add `[transform-origin:var(--radix-popper-transform-origin,center)]` and `scale(0.96) -> 1.0`.
   - `TooltipContent` (`src/components/ui/tooltip.tsx`): Add `[transform-origin:var(--radix-tooltip-content-transform-origin,center)]` and `scale(0.97) -> 1.0`.
3. Sliding Indicators for Tabs & Segments:
   - `Tabs` (`src/components/ui/tabs.tsx`): Provide sliding active indicator for tab groups (`pill` and `line` variants) without layout shift. Eliminate `transition-all`.
   - `ToggleGroup` (`src/components/ui/toggle-group.tsx`): Provide sliding or layout-stable indicator with active press feedback.
4. Raycast Speed for Command Palette:
   - `CommandDialog` in `src/components/ui/command.tsx`: 0ms instantaneous opening/closing (`duration-0` / `animate-none`) to eliminate delays for keyboard-invoked commands.
5. Sonner Toast & Toast Provider:
   - `Sonner` (`src/components/ui/sonner.tsx`): Configure `richColors`, `closeButton`, custom Phosphor status icons (`CheckCircle`, `WarningCircle`, `Warning`, `Info`, `CircleNotch`), token color classes, mobile safe-area offsets (`calc(env(safe-area-inset-bottom, 0px) + 16px)`).
   - `ToastProvider` (`src/ui/toast-provider.tsx`): Proxy full `sonner` toast API (`toast.success`, `toast.error`, `toast.promise`, `toast.info`, etc.).
6. Primitives Polish:
   - `Checkbox` (`src/components/ui/checkbox.tsx`): Active scale `scale(0.92)`.
   - `Switch` (`src/components/ui/switch.tsx`): Tactile thumb compression on active.
   - `RadioGroup` (`src/components/ui/radio-group.tsx`): Active press feedback.
   - `Progress` (`src/components/ui/progress.tsx`): Replace `transition-all` with composite `scaleX` or `transform`.
   - `FilterChip` (`src/ui/filter-chip.tsx`): Add `:active:scale-[0.97]` mechanical depression.
7. Verification:
   - Run `npm test` (verify all 109 tests pass cleanly).
   - Run `npm run typecheck` (0 errors).
   - Run `npm run lint` (0 errors, 0 warnings).
   - Run `npm run build` (build succeeds).
   - Verify design kit registry parity: `node --import tsx --test 'src/pages/dev/design-kit/design-kit-registry.test.ts'`.
