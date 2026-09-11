# Product design system — Calm Ledger

Visual law for the Epure dashboard (`web/`). This folder is the only design source for the product repo. The marketing site has its own `design/` and is not imported here.

## Layers

```
web/design/tokens.css          1. Colors, type, space, motion (hex only here)
web/design/themes/*.css        2. Calm Ledger theme (`data-style="calm-ledger"`)
web/design/tailwind.theme.cjs  3. Tailwind names → var(--*)
web/src/ui/                    4. shadcn + Radix kit
web/src/shell/                 5. App chrome (rail, navbar, page header)
web/src/features/              6. Screens — compose ui + shell only
```

Alias: `@design` → `web/design`. Import tokens once in `src/main.tsx`.

## Palette

Warm **paper canvas**, **one indigo chroma**. Hex lives in theme CSS only. Copy landing light values into the product theme — do not import `marketing.css`.

| Role | Use |
|---|---|
| `--bg` / `--bg-subtle` | Page paper (`#f4f4f2`) and rail (`#ebebe8`) |
| `--surface` | Cards, list well — white |
| `--text` | Near-black ink (`#0a0a0a`); muted/subtle = ink alphas (`#525252` / `#737373`) |
| `--border` | 8% hairline (`rgba(10,10,10,0.08)`), not opaque slate |
| `--accent` | Primary actions, focus, selected wash (`--accent-muted`), unread cue |
| `--signal` | **Alias of `--accent`** — unread / hot use the same indigo, never a second green brand chroma |
| `--danger` / `--success` / `--warning` | Semantics only (live exceptions, ok, caution) — not unread |

## Density and shape

- Compact ops: controls `h-8`, tight list rows
- Buttons / badges / checkboxes: **8px** (`rounded-md`). **No pills** on primary controls
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

Recipes: [`components.md`](./components.md) · QA: [`qa.md`](./qa.md) · Brand kit: [`brand/kit/README.md`](./brand/kit/README.md)
