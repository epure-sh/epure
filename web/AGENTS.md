# Epure web — agent rules (Orbit / Polar LLM-safe contract)

Read **before** authoring UI under `apps/epure/web`.

**Contract:** [`design/ORBIT_CONTRACT.md`](./design/ORBIT_CONTRACT.md) — same bet as
Polar’s Orbit: *make off-brand decisions unexpressible; CI is the guarantee.*

| Surface | Rules |
|---|---|
| **Orbit zone** (`eslint.config.js` → `orbitZoneFiles`, minus `orbitZoneDeferred`) | This document + `ORBIT_CONTRACT.md` |
| **Deferred hatches** (`orbitZoneDeferred`) | Third-party glue or careful-rewrite queue — do not grow; migrate off the list in the same PR that lands Box/Text. |

**Canonical live reference (one page):** playground **`/__design`**
(`npm run dev:playground`). Handbook principles, foundations, component catalog,
copy-paste recipes, and LLM contract — all in that shell. `/__orbit` redirects
there (`#recipes`). Markdown twins: [`design/ORBIT_RECIPES.md`](./design/ORBIT_RECIPES.md).

Upstream: [orbit.polar.sh](https://orbit.polar.sh/) · handbook
[handbook.polar.sh/design](https://handbook.polar.sh/design/).

**Theme:** Orbit StyleX tokens + `light-dark()` (`design/themes/orbit.css`). Fonts: Inter + Geist Mono. No Calm Ledger palette. No `dark:` at author sites.

---

## The Polar bet (do not weaken)

1. **Tokens are decisions**, not values — `background-card`, `padding="l"`, not `bg-gray-100` / `p-4`.
2. **Box is the only layout container** — polymorphic `as` for semantics; bare `<div>` is unavailable in the Orbit zone.
3. **Docs are a suggestion; `npm run lint` is the contract.** Green = mergeable. Gaps in rules are bugs in the system.
4. **Escape hatches are cracks** — prefer adding a token over `className` / inline style.

### Strict rules (Orbit zone)

- Author with `<Box />` + `<Text />` + named Orbit primitives (`Button`, `Grid`, `DataTable`, …).
- Closed token vocabulary only — no hex, no arbitrary px when a token exists, no `dark:`.
- **Never** `className` / `style` on `Box` or `Text`.
- Prefer migrating a touched Tailwind fragment to Box in the same change.
- Record tables → `@/components/kit/data-table` (Orbit DataTable). Markup → `@/components/ui/table`.

### Imports

```tsx
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit/Text'
import { Button, Grid, Spinner } from '@polar-sh/orbit'
```

### Box defaults

- Block-level `Box` defaults to flex — set `flexDirection` / `gap` without repeating `display="flex"`.
- Spacing: `none` `xs` `s` `m` `l` `xl` `2xl` …
- Colors: `background-primary`, `background-card`, `border-primary`, Text `color="muted"`, …

### Epure Orbit extensions

When Orbit has no primitive (e.g. Card), ship `src/components/kit/<name>.tsx`
**as if Polar authored it**: closed `variant` props, no public `className`,
Box/Text only, add file to `orbitZoneFiles`, document in `ORBIT_RECIPES.md`.

Reference: `src/components/kit/polar-card.tsx`, `ask-agent-card.tsx`, `issue-row-shell.tsx`.

### Deferred hatches (shrink only)

See `orbitZoneDeferred` in `eslint.config.js` and Phase 6 in `design/ORBIT_MIGRATION.md`.
True third-party: recharts (`telemetry-chart`), Shiki (`source-code-block`),
driver.js (`product-tour`), Radix/cmdk/sonner chrome. Everything else on that
list is a careful-rewrite queue — **do not add files to it**.
