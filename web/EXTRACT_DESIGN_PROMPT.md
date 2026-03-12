# Extract Epure dashboard design system

Extract the Epure dashboard design system into ONE file: `web/design.md`.

This is the **product** repo. Do not read the marketing site `design/` folder.

## Sources

Read these; prefer code over stale docs:

- `web/design/README.md`
- `web/design/tokens.css`
- `web/design/themes/*.css` (active theme + index)
- `web/design/components.md`
- `web/design/qa.md`
- `web/design/brand/README.md`
- `web/design/tailwind.theme.cjs` (if present)
- `web/src/ui/` (CVA variants, README inventory)
- `web/src/shell/` (chrome: rail, top strip, page header)
- Sample feature screens under `web/src/features/` only to verify recipes match reality

## Output

A single self-contained `web/design.md` an agent can follow without opening other files.

Structure:

1. **Principles** — token-only colors, no hex in JSX, hairlines not shadows, shadcn new-york shapes, kit before feature CSS
2. **Layers** — tokens → theme → Tailwind map → `src/ui` → shell → features
3. **Tokens** — fonts, type scale, space, chrome layout vars, motion, reduced-motion; list semantic color roles with actual CSS var names and hex from the active theme (light + dark if both exist)
4. **Typography roles** — display / title / section / meta recipes with exact classes
5. **Components** — buttons (variants + when to use), input/select, card, badge/chip, dialog/toast/empty, issue row + selection states
6. **Shell / layout** — rail widths, top height, list/detail split, content max-widths
7. **Do / don't** — from QA + README (e.g. no default Tailwind brand colors, no dual bordered toolbar buttons, signal vs primary)
8. **Inventory** — brief list of `src/ui` primitives that exist

## Rules

- Compress; no research essays, no THEME_EVAL / color-research dumps
- Cite real token names and class recipes; if doc and code disagree, trust code
- Do not invent colors or components that aren’t in the repo
- Write only `web/design.md`; don’t refactor UI
