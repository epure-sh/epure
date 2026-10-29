---
name: epure-design-system
description: Use whenever creating, styling, personalizing, or refactoring UI components, pages, tables, forms, or design tokens in Epure's Vite + React frontend.
---

# Epure Design System Execution Protocol

**Canonical live reference:** playground `/__design` (handbook + foundations + components + `#recipes`). Read `AGENTS.md` + `design/ORBIT_CONTRACT.md` before authoring Orbit-zone UI.

## Step 1: Check Existing Primitives & Kit
1. Read `src/components/INDEX.md`, `AGENTS.md`, and `src/styles/tokens.css`.
2. Prefer Orbit Box/Text token props over new Tailwind layout. If a primitive is missing from `src/components/ui/`, inspect upstream Orbit / existing façades before inventing one.

## Step 2: Personalize Layer 1 (`src/components/ui/*`)
When adding or editing a primitive in `src/components/ui/`:
- Use `data-slot="<name>"` on root and sub-elements.
- Lock heights to `h-6` (`xs`), `h-7` (`sm`), or `h-8` (`md`) and border radius to `rounded-control` (`6px`).
- Omit `className` from public props (`Omit<React.ComponentProps<...>, "className">`) on atomic controls (`Button`, `Input`, `Checkbox`, `Badge`) so callers must use CVA `variant` and `size` props.

## Step 3: Compose Layer 2 (`src/components/kit/*`)
When a pattern combines multiple primitives (e.g., a card, filter bar, row, or chart):
- Create it in `src/components/kit/<name>.tsx` using ONLY `@/components/ui/*` primitives.
- Register the new component and its props in `src/components/INDEX.md`.
- Register in `src/pages/dev/design-kit/registry.ts` and add a matching `previews/ui/*.preview.tsx` or `previews/kit/*.preview.tsx` (playground `/__design` only; `npm test` enforces catalog sync).

## Step 4: Verify Zero Violations
Run `npm run lint && npm run typecheck` and resolve all AST errors before finishing.
