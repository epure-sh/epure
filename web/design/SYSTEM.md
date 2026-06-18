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

Cool instrument canvas, indigo accent, **green `--signal` for unread / bulk-select**. Hex lives in theme CSS only.

| Role | Use |
|---|---|
| `--bg` / `--surface` | Page + cards |
| `--accent` | Primary actions, focus, selected edge |
| `--signal` | Unread bar, bulk-select wash — product only |
| `--danger` | Live exceptions, destructive actions |

## Rules

- Token classes only — no `bg-[#…]`, no default Tailwind palette as brand
- Shape: shadcn new-york in `src/ui/` (`h-8`, `rounded-md`, `p-4` cards)
- Hairlines, not shadows, on chrome
- Kit before feature CSS
- Do not import or vendor marketing `marketing.css`

Recipes: [`components.md`](./components.md) · QA: [`qa.md`](./qa.md) · Brand kit: [`brand/kit/README.md`](./brand/kit/README.md)
