# Epure Semantic Token Map

All colors in Epure use OKLCH color space defined in `src/styles/tokens.css`.
Default Tailwind colors (`zinc-*`, `slate-*`, `red-*`, `blue-*`, etc.) are purged via `--color-*: initial;`.

## Surfaces (Architectural Obsidian)
- `bg-canvas`: `oklch(0.125 0.005 260)` — App canvas background
- `bg-surface-1`: `oklch(0.155 0.006 260)` — Cards, sidebar, table rows, base panels
- `bg-surface-2`: `oklch(0.195 0.008 260)` — Hover states, secondary buttons, inputs
- `bg-surface-3`: `oklch(0.235 0.010 260)` — Active/selected elements, kbd pills
- `bg-overlay`: `oklch(0.155 0.006 260 / 0.88)` — Modal & palette backdrops

## Hairline Borders
- `border-border-subtle`: `oklch(0.225 0.008 260)` — Structural dividers (1px)
- `border-border-strong`: `oklch(0.315 0.012 260)` — Interactive control borders & focus rings

## Typography Hierarchy
- `text-fg-primary`: `oklch(0.965 0.003 260)` — Primary headings, titles
- `text-fg-secondary`: `oklch(0.735 0.008 260)` — Standard body and table cell text
- `text-fg-muted`: `oklch(0.525 0.010 260)` — Metadata, timestamps, helper text

## Semantic Status & Intent
- `bg-primary` / `text-primary-fg`: High-contrast monochrome primary CTA
- `text-escalating` / `bg-escalating`: `oklch(0.65 0.22 28)` — High-signal spike / danger
- `text-regression` / `bg-regression`: `oklch(0.76 0.16 75)` — Amber (regression / warning)
- `text-healthy` / `bg-healthy`: `oklch(0.72 0.17 152)` — Emerald (resolved / healthy)
- `text-info` / `bg-info`: `oklch(0.68 0.15 250)` — Cool blue (info / dormant)

## Geometry & Shadows
- Radius: `rounded-xs` (4px), `rounded-control` (6px), `rounded-panel` (8px)
- Shadows: `shadow-tactile` (inset bevel highlight), `shadow-float` (popovers, menus)
