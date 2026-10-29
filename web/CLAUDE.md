# Epure Frontend Engineering Rules (CLAUDE.md)

## Orbit migration (Phase 1+)

New Orbit UI (Box/Text, StyleX tokens) is governed by **[`AGENTS.md`](./AGENTS.md)** and
[`design/ORBIT_RECIPES.md`](./design/ORBIT_RECIPES.md). Canonical live reference:
playground `/__design` (handbook + catalog + `#recipes`). `/__orbit` redirects there.
Plan: [`design/ORBIT_MIGRATION.md`](./design/ORBIT_MIGRATION.md).

Phase 3: Orbit owns `@theme` / surfaces (Inter + Geist Mono). Kit still uses product
utility aliases until Phase 4. Prefer `AGENTS.md` Box/Text for new Orbit work.

## Tech Stack
- Vite + React 19 + TypeScript + Tailwind CSS v4 (`@theme` in `src/styles/tokens.css` — Polar ramps)
- **DS:** vendored `@polar-sh/orbit` + StyleX (`packages/orbit`, `vite.stylex.ts`)
- Primitives: Orbit wrappers in `src/components/ui/` (+ remaining Radix)
- Domain Kit: Composite Epure components in `src/components/kit/` (Phase 4)
- Icons: `@phosphor-icons/react` (15px default size, `regular` weight default, `fill` for active states)
- State & URL: `@tanstack/react-query` (optimistic updates mandatory) + `nuqs` (URL filter state)

## Non-Negotiable UI Rules
1. **Read Catalog First:** Always read `src/components/INDEX.md` before writing or refactoring any `.tsx` file.
2. **Strict Layering:** Files in `src/pages/` and feature views MUST ONLY import components from `@/components/kit/*` and `@/components/ui/*`.
3. **No Raw HTML Controls:** Never use `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, or `style={{}}` outside `src/components/ui/`.
4. **Token colors:** Prefer product semantic utilities (`bg-canvas`, `text-fg-*`, `text-escalating`, …) or Orbit Polar ramps (`gray-*`, `polar-*`, `red-*`) already in `@theme`. No ad-hoc hex / zinc/slate brand inventing. New Orbit surfaces: Box/Text tokens only (`AGENTS.md`).
5. **Zero Layout Shift:** Always apply `tabular-nums` to numbers/counters/timestamps. Table and issue rows must use fixed CSS Grid tracks so clicking a `<Checkbox />` shifts 0 pixels.
