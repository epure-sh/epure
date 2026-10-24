# Epure Frontend Engineering Rules (CLAUDE.md)

## Tech Stack
- Vite + React 19 + TypeScript + Tailwind CSS v4 (`@theme inline` in `src/styles/tokens.css`)
- Primitives: Personalized `shadcn/ui` (Radix base) in `src/components/ui/`
- Domain Kit: Composite Epure components in `src/components/kit/`
- Icons: `@phosphor-icons/react` (15px default size, `regular` weight default, `fill` for active states)
- State & URL: `@tanstack/react-query` (optimistic updates mandatory) + `nuqs` (URL filter state)

## Non-Negotiable UI Rules
1. **Read Catalog First:** Always read `src/components/INDEX.md` before writing or refactoring any `.tsx` file.
2. **Strict Layering:** Files in `src/pages/` and feature views MUST ONLY import components from `@/components/kit/*` and `@/components/ui/*`.
3. **No Raw HTML Controls:** Never use `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, or `style={{}}` outside `src/components/ui/`.
4. **No Arbitrary Tailwind Colors:** Default Tailwind palettes (`zinc-*`, `slate-*`, `red-*`, `blue-*`) are disabled in `@theme inline`. Use ONLY semantic tokens (`bg-canvas`, `bg-surface-1`, `bg-surface-2`, `bg-surface-3`, `border-border-subtle`, `border-border-strong`, `text-fg-primary`, `text-fg-secondary`, `text-fg-muted`, `text-escalating`, `text-regression`, `text-healthy`, `text-info`).
5. **Zero Layout Shift:** Always apply `tabular-nums` to numbers/counters/timestamps. Table and issue rows must use fixed CSS Grid tracks so clicking a `<Checkbox />` shifts 0 pixels.
