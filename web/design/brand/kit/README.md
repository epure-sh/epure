# Epure logo kit — chain link

Complete export set for the Epure chain-link mark. Colors from **Calm Ledger** (`themes/calm-ledger.css`). Typography: IBM Plex Sans Medium, title case **Epure**.

This kit lives in the **product** repo. It does not write files into the marketing site.

Regenerate everything:

```bash
python3 generate.py
```

---

## Layout

```
kit/
  palette.json          token reference (source of truth for hex in this kit)
  generate.py           generator — run after geometry or palette changes
  source/               building blocks (currentColor where noted)
    mark.svg            symbol only — 54×32
    wordmark.svg        text only
    lockup.svg          mark + wordmark (accent + ink)
  mark/                 symbol on backgrounds
  lockup/               full logo on backgrounds
  icon/                 square app icons (rx = 25% of size)
    primary/            accent bg, white mark
    surface/            white bg, accent mark
    subtle/             bg-subtle bg, accent mark
    muted/              accent-muted bg, accent mark
    ink/                ink bg, white mark
  favicon/              browser + PWA touchpoints
  social/               512×512 profile squares with lockup
```

On generate, `../epure-mark.svg` and `web/public/favicon.svg` are synced.

```bash
cd web/design/brand/kit && python3 generate.py
```

---

## Palette

| Token | Hex | Use in kit |
|---|---|---|
| `bg` | `#f9fafc` | Light page background |
| `bgSubtle` | `#f1f3f7` | Subtle panels |
| `surface` | `#ffffff` | Cards, modals |
| `ink` | `#111827` | Wordmark on light |
| `accent` | `#5a52e8` | Mark on light, icon fills |
| `accentMuted` | `#eeedfc` | Soft accent panels |
| `accentContrast` | `#ffffff` | Mark on accent / ink |

---

## Mark variants (`mark/`)

| File | Background | Mark |
|---|---|---|
| `mono-ink.svg` | transparent | ink |
| `mono-accent.svg` | transparent | accent |
| `mono-white.svg` | transparent | white |
| `on-accent.svg` | accent | white |
| `on-bg.svg` | bg | accent |
| `on-bg-subtle.svg` | bg-subtle | accent |
| `on-surface.svg` | surface | accent |
| `on-ink.svg` | ink | white |

---

## Lockup variants (`lockup/`)

| File | Background | Mark | Wordmark |
|---|---|---|---|
| `mono-ink.svg` | transparent | accent | ink |
| `mono-accent.svg` | transparent | accent | accent |
| `on-light.svg` | bg | accent | ink |
| `on-surface.svg` | surface | accent | ink |
| `on-subtle.svg` | bg-subtle | accent | ink |
| `on-muted.svg` | accent-muted | accent | ink |
| `on-accent.svg` | accent | white | white |
| `on-ink.svg` | ink | white | white |

Default product lockup: **`lockup/on-light.svg`**.

---

## Icon sizes (`icon/<variant>/`)

Each variant folder contains:

`icon-16` · `icon-32` · `icon-48` · `icon-64` · `icon-128` · `icon-180` · `icon-192` · `icon-512`

| Variant | When to use |
|---|---|
| **primary** | Favicon, navbar, app shell — default |
| **surface** | On white cards |
| **subtle** | On `bg-subtle` chrome |
| **muted** | On accent-muted chips |
| **ink** | Dark headers, reversed contexts |

Touchpoints:

| Asset | Path |
|---|---|
| Favicon (kit source) | `favicon/favicon.svg` (32, primary) |
| Product tab icon | `web/public/favicon.svg` ← synced on generate |
| Safari pinned (kit) | `favicon/mask-icon.svg` (monochrome ink; optional) |
| PWA manifest (kit) | `favicon/manifest-icons/icon-192.svg`, `icon-512.svg` |

---

## Social (`social/`)

512×512 rounded squares with centered lockup:

- `profile-accent.svg` — accent field, all white
- `profile-light.svg` — bg field, accent + ink
- `profile-surface.svg` — white field, accent + ink

---

## Geometry

| Property | Value |
|---|---|
| Mark viewBox | `54 × 32` (27:16) |
| Outer radius | `16` (full stadium ends) |
| Stroke | `8.5` |
| Inner radius | `7.5` |
| Cut angle | `27.5°` from vertical |
| Cut gap | `4.5` |
| Icon corner radius | `25%` of edge length (`rx = size / 4`) |

Paths are defined once in `generate.py` and copied into every export.

---

## Rules

- Wordmark is title case **Epure**
- Do not edit generated SVGs by hand — change `palette.json`, `generate.py`, or `source/mark.svg`, then re-run
- For in-app React usage, `src/ui/logo.tsx` owns the mark geometry
- Legacy exploration marks remain in `../marks/` (Pure Spike #7, etc.)
- Do not sync this kit into the marketing repo
