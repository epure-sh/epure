# Product design system — Polar Orbit (Phase 3)

Visual law for the Epure dashboard (`web/`). Orbit owns surfaces; Calm Ledger palette is removed. Marketing has its own `design/` — do not import it.

**Folder index:** [`README.md`](./README.md). **Authoring:** [`AGENTS.md`](../AGENTS.md). **Migration:** [`ORBIT_MIGRATION.md`](./ORBIT_MIGRATION.md).

## Layers

```
web/design/themes/orbit.css    1. Product surface CSS vars (Orbit values)
web/src/styles/tokens.css      2. Tailwind @theme — Polar ramps + product aliases
web/design/tokens.css          3. Type, chrome dims, motion (extensions, not a second palette)
web/src/components/ui/         4. Phase 2 Orbit wrappers (+ remaining Radix)
web/src/components/kit/        5. Kit (Phase 4 restyle)
web/src/shell/ + features/     6. Chrome + screens (Phase 6 for Epure-only surfaces)
```

Alias: `@design` → `web/design`. Entry: `fonts.css` → `@design/tokens.css` → `src/styles/tokens.css`.

## Palette

**Orbit gray (light) / polar (dark)** canvas. Accent = indigo (Orbit semantic). Fonts = Inter + Geist Mono.

| Role | Use |
|---|---|
| `--bg` / `--bg-subtle` | White / gray50 (light); polar950 / polar900 (dark) |
| `--surface` | Cards — white (light) / polar800 (dark) |
| `--text` | Black / white; muted = gray500 / polar400 |
| `--border` | gray200 / polar700 |
| `--accent` | Indigo accent + `--accent-muted` wash; unread cue |
| `--signal` | **Alias of `--accent`** |
| `--danger` / `--success` / `--warning` | Orbit red / emerald / amber — semantics only |

## Density and shape

- Compact ops: controls `h-8`, tight list rows
- Buttons / badges: **8px** (`rounded-md`). Checkboxes: **4px** rounded square (`rounded-xs`), always **1px** `--border-strong` on `--surface` fill (no hover-only chrome). **No pills** on primary controls
- Filter chips: **5–6px**, key:value
- Cards: **12px**, hairline ring, no drop shadows on chrome
- Pills only for true pills (avatar, maybe env badge)

## Unread vs selected (issue list)

Collapsing `--signal` onto `--accent` must **not** make unread look like selected.

| State | Treatment |
|---|---|
| Unread | Type weight (`font-semibold`) + small indigo cue (dot and/or 2px inset left edge). **No full-row wash** |
| Selected | Indigo wash (`--accent-muted`). Accent stays a small fraction of list pixels (~10% max) |
| Unread + selected | Selected wash wins; keep the unread mark (weight / dot / edge) |

## Rules

- Token classes only — no `bg-[#…]`, no default Tailwind palette as brand
- Shape: shadcn new-york in `src/ui/` (`h-8`, `rounded-md`, `p-4` cards)
- Hairlines, not shadows, on chrome
- Header sits on paper with 8% hairline — not a floating white bar
- Rail: flat `--bg-subtle`, 1px `border-r`, ~8px active item, 2px inset accent. No gradient, no 3px pill bar
- Ghost buttons: text or faint wash, **no bordered-ghost army**. Secondary = indigo wash, not a second outline
- Empty: quiet type + one next action — no dashed circus
- Type: IBM Plex Sans; 14–15px chrome titles; 13–14px list titles; mono for IDs/counts. No display sizes in-app
- Kit before feature CSS
- Do not import or vendor marketing `marketing.css`

Recipes: [`components.md`](./components.md) · QA: [`qa.md`](./qa.md) · Alerts: [`alerts-ui.md`](./alerts-ui.md) · Brand kit: [`brand/kit/README.md`](./brand/kit/README.md)
