# UI kit (`src/ui/`)

**shadcn/ui (new-york)** on Radix + CVA. Edit primitives here or re-add via CLI — colors stay in `design/tokens.css`.

## Quick edits

| Goal | Where |
|---|---|
| Button size / shape | `button.tsx` → `buttonVariants` `size` / `variant` |
| Card padding | `card.tsx` → `CardHeader` / `CardContent` (`p-4`) |
| Input height | `input.tsx` → `h-8` |
| Global radius | `design/tokens.css` → `--radius` |
| Colors | `design/tokens.css` only |

## Add components (CLI)

```bash
cd web
npx shadcn@latest add alert sheet scroll-area
```

Overwrite a primitive after upstream changes:

```bash
npx shadcn@latest add button --overwrite
```

Then re-map Tailwind classes to tokens (`bg-surface`, `text-ink`, `border-border`, `bg-accent`, …) — **never** shadcn `bg-primary` unless wired in `tailwind.theme.cjs`.

## Stack

| Layer | Library |
|---|---|
| Primitives | Radix UI |
| Variants | CVA + `tailwind-merge` (`cn()`) |
| Command | cmdk |
| Icons | Lucide |

Config: `web/components.json` (style: **new-york**).

## Sizing defaults (compact dashboard)

| Component | Default |
|---|---|
| Button | `h-8` · `rounded-md` · `text-sm` |
| Input / Select | `h-8` |
| Card | `rounded-lg` · `p-4` · hairline, no shadow |
| Badge / FilterChip | `h-7` · `text-xs` |

## Shape vs color

- **Colors:** Calm Ledger — `design/themes/calm-ledger.css`
- **Shape:** shadcn new-york — edit `src/ui/*.tsx` or CLI, not one-off feature CSS
