# Orbit contract (Epure = Polar)

Epure implements the **same LLM-safe design system bet as Polar’s Orbit**
([Building an LLM safe design system](https://polar.sh) / orbit.polar.sh).

This file is the **contract**. Docs suggest. **CI (`npm run lint`) enforces.**

---

## The bet

Make it hard to express an off-brand decision in code. Ideally impossible.
If a value isn’t a design decision we’ve made, it must not pass lint.

| Wrong (values / strings) | Right (decisions / tokens) |
|---|---|
| `p-4`, `p-[17px]`, `bg-gray-100`, `dark:bg-zinc-900` | `padding="l"`, `backgroundColor="background-card"` |
| `className="flex gap-4 text-gray-500"` | `<Box columnGap="m"><Text color="muted">` |
| Hex / arbitrary CSS | Semantic tokens only |
| Parallel unconstrained `<div>` | Polymorphic `<Box as="nav" \| "section" \| …>` |

A token name is **intent** (`background-card`), not a value with a nicer name.
Light/dark is carried inside the token via `light-dark()` — no `dark:` second pass.

## Authoring vocabulary

1. **`<Box />`** from `@polar-sh/orbit/Box` — the only layout container.
2. **`<Text />`** from `@polar-sh/orbit/Text` — the only typography.
3. **Named Orbit primitives** when they fit (`Button`, `Grid`, `DataTable`, `Alert`, …).
4. **Epure Orbit extensions** (e.g. `PolarCard`) when Orbit has no primitive —
   same closed API, same lint list (see `AGENTS.md`).

## What CI forbids (Orbit zone)

Encoded in `eslint.config.js` → `orbitRestrictedSyntax`, applied to every file
on the Orbit `files` list:

- Raw layout HTML: `div`, `span`, `section`, `main`, `nav`, `header`, `footer`,
  `aside`, `article`, `ul`, `ol`, `li` → use `<Box as="…">`
- `className` / `style` on `Box` / `Text` (token props exist for layout/color)
- Raw hex color literals
- `dark:` variants
- Tailwind layout/color utilities on raw HTML

**Green lint = mergeable Orbit UI.** If something off slips through, that’s a
gap in the rules — fix the rule, don’t hope authors remember.

## Escape hatches

Every hatch is a crack. Allowed only when:

- Third-party glue (cmdk, charts, radix menu width, Shiki HTML hooks) that
  cannot take Box props, or
- Parent-hover / keyframe motion not yet tokenized (tiny `data-slot` CSS, e.g.
  `polar-card.css`)

Never for “I wanted `p-4`.” Prefer **adding a token** (or a closed kit prop
like `contentPadding="none"`) over a public `className`.

Kit components in the Orbit zone ship **closed APIs** — no public `className`
on `PageShell`, `EmptyState`, `SectionCard`, `PolarCard`, `UsageMeterCard`,
`FilterBar`, `NavCountPastille`, `CodeFrame`.

Audit `eslint-disable` for Orbit rules as a design-system bug.

## Migration

Product UI is **Orbit-by-default**: `orbitZoneFiles` covers `components/ui`,
`components/kit`, `ui`, `shell`, and `features`. The small
`orbitZoneDeferred` list is the only Calm Ledger remainder (third-party hosts +
careful-rewrite queue). Shrink that list when a file complies — same PR that
lands Box/Text. Do not add new deferred paths.

## References

- **Canonical live reference:** playground `/__design` (handbook + foundations +
  components + `#recipes`). `/__orbit` redirects there.
- Markdown twin: `ORBIT_RECIPES.md`
- Agent rules: `AGENTS.md`
- Migration phases: `ORBIT_MIGRATION.md`
- Upstream: [orbit.polar.sh](https://orbit.polar.sh/) ·
  [handbook.polar.sh/design](https://handbook.polar.sh/design/)
