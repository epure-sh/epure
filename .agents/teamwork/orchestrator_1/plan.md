# Orchestrator Execution Plan: Epure UI/UX Refactor

## Objectives
Deliver a native-feeling, tactile, ultra-fluid, and breathable error-tracking workspace adhering to Emil Kowalski & Apple Design principles, with 100% test pass rate (109 tests), 0 type/lint errors, and zero arbitrary color class leaks.

## Phases

### Phase 0: Survey & Scope Mapping
- Dispatch 3 parallel Explorers:
  - Explorer 1: Token & Depth Foundation (`calm-ledger.css`, `tokens.css`, `app.css`, Tailwind config, contrast/elevation).
  - Explorer 2: UI Primitives & Tactility (`@/components/ui/*`, Radix origins, Sonner toasts, tabs, active states, Raycast speed).
  - Explorer 3: Feature Views, Feed, Mobile & Performance (`@/components/kit/*`, `src/ui/*`, mobile sheets, touch actions, 100dvh, motion budget).
- Synthesize findings into `PROJECT.md` with Feature Inventory and Interface Contracts.

### Phase 1: Milestone R1 — Design Token & Depth System Foundation
- Refactor foundational styling tokens (`calm-ledger.css`, `tokens.css`, `app.css`).
- Establish APCA-compliant contrast, subtle specular rim lighting, elevated surfaces.
- Lock layout shift with `tabular-nums` and stable CSS Grid tracks.
- Full gate: Reviewers, Challengers, Forensic Auditor.

### Phase 2: Milestone R2 — Primitives Tactility & Micro-Interactions
- Overhaul primitives in `@/components/ui/*`.
- Mechanical depression (`:active scale(0.97)`), critically damped springs (`damping: 1.0`, `response: 0.35s`).
- Anchor popovers to trigger origins, sliding indicators for tabs/segments.
- Raycast speed for keyboard commands, refined Sonner portal toasts.
- Full gate: Reviewers, Challengers, Forensic Auditor.

### Phase 3: Milestone R3 — Feed, Triage & Detail View Architecture
- Feed rows (unread rails, zero-shift checkboxes, keyboard j/k focus cues).
- Telemetry chart & sparklines (bezier paths, crosshair tooltips).
- Code syntax inspection & stack trace explorers (copy confirmation, collapsible vendor traces).
- AI Copilot triage card, filter pill bars, quick action toolbars.
- Full gate: Reviewers, Challengers, Forensic Auditor.

### Phase 4: Milestone R4 — Mobile Responsiveness & Native Touch Polish
- Touch action properties (`manipulation`, no 300ms delay, no tap highlight).
- 16px font minimum on inputs to prevent iOS zoom.
- `100dvh` viewport stabilization and safe area insets.
- Vaul-driven pull-to-dismiss bottom sheet drawers for detail inspections.
- Full gate: Reviewers, Challengers, Forensic Auditor.

### Phase 5: Milestone R5 — Motion Budget & Performance Guardrails
- Composite-only properties (`transform`, `opacity`) for 120fps.
- `prefers-reduced-motion` across all animated components.
- Interruptible, velocity-aware gesture interactions.
- Full gate: Reviewers, Challengers, Forensic Auditor.

### Phase 6: Final Integration, E2E Verification & Adversarial Hardening
- Run all 109 unit/integration tests, typecheck, lint, build.
- Design kit playground registry 1:1 synchronization check.
- Semantic token bridge audit (no undeclared arbitrary Tailwind classes).
- Adversarial challenger stress testing.
- Forensic Auditor final sign-off.
- Final completion report sent to Sentinel.
