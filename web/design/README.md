# Product design (`web/design/`)

Visual source for the Epure dashboard. **Phase 3:** Polar Orbit owns color/radius/shadow/fonts; Calm Ledger palette is gone.

## Read order

| Step | Doc | Purpose |
|------|-----|---------|
| 1 | [`ORBIT_MIGRATION.md`](./ORBIT_MIGRATION.md) + [`AGENTS.md`](../AGENTS.md) | Migration status + Box/Text authoring |
| 2 | [`ORBIT_RECIPES.md`](./ORBIT_RECIPES.md) | Copy-paste Orbit layouts |
| 3 | [`tokens.css`](./tokens.css) + [`themes/orbit.css`](./themes/orbit.css) | Surfaces + chrome/type/motion extensions |
| 4 | [`src/styles/tokens.css`](../src/styles/tokens.css) | Tailwind `@theme` (Polar ramps + product aliases) |
| 5 | [`components.md`](./components.md) / kit | Legacy recipes until Phase 4 |
| 6 | [`brand/README.md`](./brand/README.md) | Logo strategy |

Runtime: entry imports `fonts.css` → `@design/tokens.css` → `src/styles/tokens.css` → `orbit-stylex.css`.

## Folder map

```
design/
├── ORBIT_MIGRATION.md     phase plan
├── ORBIT_RECIPES.md       Box/Text recipes
├── tokens.css             type, space, chrome, motion; imports themes/
├── tokens.json            machine-readable (keep aligned with orbit theme)
├── themes/
│   ├── index.css
│   └── orbit.css          product surface CSS vars (:root + dark)
├── tailwind.theme.cjs     legacy Tailwind → var(--*) helpers
└── brand/                 mark / kit exports
```

## Edit workflow

| Goal | Where |
|------|--------|
| Product / Orbit surface colors | `themes/orbit.css`, then sync `tokens.json` |
| Polar Tailwind ramps (`gray-*`, `polar-*`) | `src/styles/tokens.css` `@theme` |
| Typography / chrome dims / motion | `tokens.css` |
| New Orbit UI | Box/Text per `AGENTS.md` |
| Kit visuals | Phase 4 — `src/components/kit/*` |

## Rules (short)

- Orbit look is the bar — do not reintroduce a Calm Ledger competing palette.
- Product utility names (`bg-canvas`, `text-fg-*`, badge chips) are aliases onto Orbit until kit/product migrate.
- Record tables use Orbit `DataTable` (`@/components/kit/data-table`); markup tables use Orbit `Table` (`@/components/ui/table`).
- Do not import landing `marketing.css`.
