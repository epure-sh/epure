# Design system

Single editable source for product UI. **Colors** in `tokens.css`; **components** are shadcn/Radix in `src/ui/`.

## Layers

```
web/design/tokens.css         1. Colors, type, space, motion (hex only here)
web/design/tailwind.theme.cjs 2. Tailwind names → var(--*)
web/src/ui/                   3. shadcn + Radix kit (see ui/README.md)
web/src/shell/                4. App chrome (header, context)
web/src/features/             5. Screens — compose ui + shell only
```

## Edit workflow

| Goal | File |
|---|---|
| Rebrand / palette | `tokens.css` (`:root` + `[data-theme="dark"]`) |
| Button / badge shape | `src/ui/button.tsx`, `badge.tsx` (CVA variants) |
| Add a control | `npx shadcn@latest add …` in `web/` → lands in `src/ui/` |
| New screen | `src/features/…` using `src/ui` exports only |

Import once in `src/main.tsx`: `@design/tokens.css`.

## Kit

Primitives: shadcn-style on Radix — `Button`, `Input`, `Badge`, `Card`, `Dialog`, `Select`, `Tabs`, …

Full inventory: [`src/ui/README.md`](../src/ui/README.md).

Recipes: [`components.md`](./components.md) · QA: [`qa.md`](./qa.md).

## Rules

- Token classes only in components — no `bg-[#…]`, no default Tailwind palette as brand.
- **Shape:** shadcn new-york defaults in `src/ui/` (`h-8`, `rounded-md`, `p-4` cards) — edit CVA or CLI, not feature CSS.
- **Colors:** Calm Ledger palette in theme CSS only (indigo accent).
