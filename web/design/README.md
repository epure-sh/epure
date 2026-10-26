# Product design (`web/design/`)

Visual source for the Epure dashboard only. Marketing lives in `apps/landing/design/` — do not import across repos.

## Read order

| Step | Doc | Purpose |
|------|-----|---------|
| 1 | [`SYSTEM.md`](./SYSTEM.md) | Calm Ledger rules: palette, density, unread vs selected, chrome |
| 2 | [`tokens.css`](./tokens.css) + [`themes/calm-ledger.css`](./themes/calm-ledger.css) | **Edit colors here** (hex in theme CSS) |
| 3 | [`tailwind.theme.cjs`](./tailwind.theme.cjs) | Tailwind → `var(--*)` |
| 4 | [`components.md`](./components.md) | Button/input/list recipes |
| 5 | [`qa.md`](./qa.md) | Pre-ship checklist |
| 6 | [`alerts-ui.md`](./alerts-ui.md) | Alert surfaces |
| 7 | [`brand/README.md`](./brand/README.md) | Logo strategy + legacy marks |
| 8 | [`brand/kit/README.md`](./brand/kit/README.md) | **Export kit** (favicon, icons, lockups) |

Runtime UI: [`src/components/INDEX.md`](../src/components/INDEX.md) (primitives + kit). App entry imports `@design/tokens.css` then [`src/styles/tokens.css`](../src/styles/tokens.css) — **bridge only** (Tailwind `@theme` names → Calm Ledger vars). Do not add a second palette in `src/styles/`.

## Folder map

```
design/
├── README.md              ← you are here (index)
├── SYSTEM.md              visual law
├── tokens.css             type, space, radius; imports themes/
├── tokens.json            machine-readable palette (keep in sync with theme)
├── themes/
│   ├── index.css
│   └── calm-ledger.css    product color tokens (:root + dark)
├── tailwind.theme.cjs
├── components.md          component recipes
├── qa.md
├── alerts-ui.md
└── brand/
    ├── README.md          mark metaphors, usage in React
    ├── epure-mark.svg     quick-import symbol (synced from kit)
    ├── marks/             exploration SVGs (01–25), not for production
    └── kit/               canonical chain-link exports
        ├── README.md      kit layout + generate
        ├── palette.json   hex for generator only (align with calm-ledger)
        ├── generate.py
        ├── source/        mark, wordmark, lockup masters
        ├── mark/          symbol on backgrounds
        ├── lockup/        mark + wordmark on backgrounds
        ├── icon/          square app icons (primary, surface, …)
        ├── favicon/       tab + PWA
        └── social/        512 profile squares
```

## Edit workflow

| Goal | Where |
|------|--------|
| Rebrand / product colors | `themes/calm-ledger.css`, then update `tokens.json` + `brand/kit/palette.json`, run `kit/generate.py` |
| Typography / spacing | `tokens.css` |
| Button, badge, control shape | `src/components/ui/*` (CVA) |
| New screen | `src/features/*` using `src/components/ui` + `kit` only |
| Favicon / app icon files | `brand/kit/` → `python3 generate.py` (syncs `public/favicon.svg`) |
| In-app logo geometry | `src/ui/logo.tsx` (React); keep in sync with `kit/source/mark.svg` |

## Design system vs brand kit

| Layer | Location | Scope |
|-------|----------|--------|
| **Design system** | `tokens.css`, `themes/`, `SYSTEM.md`, `components.md` | In-app UI: color, type, components |
| **Brand kit** | `brand/kit/` | Static exports: SVG/PNG touchpoints, social, favicon |
| **Exploration** | `brand/marks/` | Archived directions; chain link (#25) is canonical |

## Rules (short)

- Token classes only in components — no `bg-[#…]`, no default Tailwind palette as brand.
- `--signal` aliases `--accent` (one indigo; unread ≠ selected — see `SYSTEM.md`).
- Do not import landing `marketing.css`.
