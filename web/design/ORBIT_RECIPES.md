# Orbit Box / Text recipes (Epure)

Short cookbook for agents. Live demos: playground **`/__design#recipes`**
(canonical Orbit docs page; `/__orbit` redirects there).  
Rules: [`../AGENTS.md`](../AGENTS.md). Docs: [orbit.polar.sh](https://orbit.polar.sh/components/box).

Source of truth for the JSX below: `src/pages/dev/orbit-proof/orbit-recipes.tsx`.

## Motion (match Orbit)

Epure CSS vars in `design/tokens.css` mirror Orbit StyleX:

| Token | Value |
|---|---|
| `--duration-fast` / Orbit `fast` | **120ms** |
| `--duration-base` / Orbit `base` | **200ms** |
| `--duration-panel` / Orbit `slow` | **320ms** |
| `--ease-out` / Orbit `decelerate` | `cubic-bezier(0, 0, 0, 1)` |

Prefer Box props `transitionDuration="fast"` + `ease="decelerate"` over hand-rolled Tailwind durations.

## Alert History row

Alert title (`Text variant="title"`) + error line (`caption` + `monospace`) inside stacked `PolarCard` rows. Column header is its own card (**Alert** left, **Fired** right). Day buckets use `heading-xxs` + count; `gap-2` between alert cards.

## Issue feed row (`IssueRowShell`)

Orbit `Grid` + `ISSUE_ROW_TEMPLATE`, unread rail via `InboxUnreadRail`, metrics as mono `Text`. Closed API (no public `className`). Hover checkbox affordance lives in `issue-row-shell.css` (parent-hover hatch).

## Ask Agent card

`AskAgentCard` — Epure Orbit extension (closed props, Box/Text + Button). No public `className`.

## Vertical stack

```tsx
<Box flexDirection="column" rowGap="l">
  …
</Box>
```

## Horizontal toolbar row

```tsx
<Box alignItems="center" columnGap="m" justifyContent="between" width="100%">
  …
</Box>
```

## Card / PolarCard

Orbit has **no Card primitive**. Epure ships **`PolarCard`** as an Orbit
extension (same authoring rules as Polar — closed variants, Box/Text, lint-scoped).

```tsx
import {
  PolarCard,
  PolarCardHeader,
  PolarCardTitle,
  PolarCardDescription,
  PolarCardFooter,
  PolarCardOpenHint,
} from "@/components/kit/polar-card";

<PolarCard variant="interactive" to="/p/…/issues" padding="xl">
  <PolarCardHeader>
    <PolarCardTitle as="h2">Acme API</PolarCardTitle>
    <Badge>3 unresolved</Badge>
  </PolarCardHeader>
  <PolarCardDescription>acme-api</PolarCardDescription>
  <PolarCardFooter orientation="column" grow>
    …
    <PolarCardOpenHint>
      <Text variant="label">Open</Text>
    </PolarCardOpenHint>
  </PolarCardFooter>
</PolarCard>
```

**Variants:** `default` | `interactive` | `selected` (also `interactive`/`selected` booleans).  
**Footer:** `orientation="row"|"column"`, `grow` for gallery graphs.  
**No public `className`.** New Epure primitives follow AGENTS.md → “Epure Orbit extensions”.

Legacy recipe (raw Box) still valid for one-offs:

```tsx
import {
  PolarCard,
  PolarCardBody,
  PolarCardFooter,
  PolarCardHeader,
  PolarCardTitle,
  PolarCardDescription,
} from "@/components/kit/polar-card";

<PolarCard interactive to="/p/…/issues">
  <PolarCardBody>
    <PolarCardHeader>
      <PolarCardTitle>Acme API</PolarCardTitle>
      <Status status="Healthy" color="green" size="small" />
    </PolarCardHeader>
    <PolarCardDescription>slug · platform</PolarCardDescription>
  </PolarCardBody>
  <PolarCardFooter>…</PolarCardFooter>
</PolarCard>

{/* Static metric / plan tile */}
<PolarCard padding="l" selected={isCurrent}>
  <Text monospace tabularNums variant="heading-xs">42</Text>
  <Text variant="caption" color="muted">Active members</Text>
</PolarCard>
```

Raw Box (same Polar chrome) when you need a one-off:

```tsx
<Box
  borderRadius="xl"
  backgroundColor={{ base: "background-card", hover: "background-secondary" }}
  borderWidth={1}
  borderStyle="solid"
  borderColor="border-primary"
  boxShadow={{ base: "s", hover: "m" }}
  transform={{ hover: "translateY(-2px)" }}
  transitionProperty="common"
  transitionDuration="fast"
  ease="decelerate"
  padding="xl"
  flexDirection="column"
  rowGap="m"
>
  <Text variant="heading-xxs" as="h3">Title</Text>
  <Text color="muted">Description</Text>
</Box>
```

Do **not** use `epure-card` / `shadow-tactile` / indigo Calm Ledger for these surfaces.

## Sticky toolbar

```tsx
<Box
  position="sticky"
  top={0}
  zIndex={10}
  backgroundColor="background-primary"
  borderBottomWidth={1}
  borderStyle="solid"
  borderColor="border-primary"
  paddingHorizontal="xl"
  paddingVertical="m"
  alignItems="center"
  justifyContent="between"
  width="100%"
>
  …
</Box>
```

## Empty

```tsx
<Box
  flexDirection="column"
  alignItems="center"
  justifyContent="center"
  paddingVertical="3xl"
  rowGap="l"
>
  <Text color="muted">No items found</Text>
  <Button variant="secondary">Create first item</Button>
</Box>
```

## Loading

Prefer `Text loading` / `Spinner` over hand-rolled pulse boxes:

```tsx
<Box flexDirection="column" rowGap="m" padding="l">
  <Text loading placeholderText="Loading title…" variant="heading-xs" />
  <Text loading placeholderNumberOfLines={3} />
  <Box alignItems="center" columnGap="s">
    <Spinner />
    <Text color="muted">Loading…</Text>
  </Box>
</Box>
```

## Error

```tsx
<Box
  borderRadius="m"
  backgroundColor="background-warning"
  borderWidth={1}
  borderStyle="solid"
  borderColor="border-warning"
  padding="l"
  flexDirection="column"
  rowGap="s"
>
  <Text variant="label">Something went wrong</Text>
  <Text>{error.message}</Text>
</Box>
```

## Responsive grid

```tsx
import { Grid } from '@polar-sh/orbit'

<Grid
  templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }}
  gap="l"
>
  {items}
</Grid>
```

## DataTable (typed records)

Orbit DataTable wraps TanStack Table v9. Pagination and sorting are **manual** —
you own the current page of `data` and `rowCount`. Prefer the façade so product
imports stay stable:

```tsx
import { Text } from '@polar-sh/orbit/Text'
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableColumnDef,
  type DataTablePaginationState,
  type DataTableSortingState,
} from '@/components/kit/data-table'

const columns: DataTableColumnDef<Order>[] = [
  {
    accessorKey: 'customer',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => <Text>{row.original.customer}</Text>,
  },
]

<DataTable
  columns={columns}
  data={page}
  rowCount={total}
  isLoading={false}
  pagination={pagination}
  onPaginationChange={setPagination}
  sorting={sorting}
  onSortingChange={setSorting}
/>
```

Markup-only tables (no column defs): `@/components/ui/table` re-exports Orbit
`Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell`.
Use `TableFooter` / `TableCaption` from the same module when needed (Epure locals).

## Component inventory (Orbit → Epure)

Prefer `@/components/ui/*` / `@/components/kit/data-table` façades. Deep-import
`@polar-sh/orbit/<Name>` only on Orbit proof surfaces.

| Orbit (`packages/orbit`) | Epure import | Notes |
|---|---|---|
| `Box` | `@polar-sh/orbit/Box` | Deep import; no ui façade |
| `Text` | `@polar-sh/orbit/Text` | Deep import; no ui façade |
| `Grid` / `GridItem` | `@polar-sh/orbit` | Prefer on new Orbit surfaces |
| `Button` | `@/components/ui/button` | Epure variants/sizes mapped |
| `ButtonGroup` | `@polar-sh/orbit` | No façade yet |
| `Input` | `@/components/ui/input` | `leadingIcon` / trailing kbd API |
| `TextArea` | `@/components/ui/textarea` | Re-export |
| `Checkbox` | `@/components/ui/checkbox` | Wrap |
| `Switch` | `@/components/ui/switch` | Epure `size` |
| `Select`* | `@/components/ui/select` | Epure trigger size |
| `Tabs`* | `@/components/ui/tabs` | `line` / `folder` overlays |
| `Tooltip`* | `@/components/ui/tooltip` | Re-export |
| `Pill` | `@/components/ui/badge` | Epure Badge → PillColor |
| `Status` | `@/components/ui/status` | Re-export |
| `Alert` | `@/components/ui/alert` | Re-export |
| `Avatar` | `@/components/ui/avatar` | Re-export |
| `Spinner` | `@/components/ui/spinner` | Re-export |
| `SegmentedControl` | `@/components/ui/segmented-control` | Re-export |
| `Modal` / `InlineModal` | `@/components/ui/modal` | Prefer for new overlays |
| `DataTable`* | `@/components/kit/data-table` | TanStack v9 · manual sort/page |
| `Table`* (ui) | `@/components/ui/table` | Markup tables; Footer/Caption local |
| `List` / `ListItem` | `@polar-sh/orbit/List` | Feed/inbox rows — **not** org projects (gallery) |
| `ListGroup` / `Subnav` / `Truncated` | `@polar-sh/orbit` | Available; adopt when touching feed chrome |
| `Alert` | `@polar-sh/orbit/Alert` | **Used** on org home pause/welcome banners |
| `Status` / `Avatar` / `Grid` | façades / deep import | **Used** on org home project card gallery |

### No Orbit equivalent (keep minimal Polar chrome)

| Epure | Strategy |
|---|---|
| `dialog` (compound) | Radix Dialog · Orbit Modal shell colors (`gray-100` / white panel) |
| `dropdown-menu` | Radix · Polar `rounded-2xl` / `gray-*` / `polar-*` |
| `popover` | Radix · same Polar panel chrome |
| `sheet` / Vaul drawer | Product mobile detail — Polar gray borders / white / `rounded-t-3xl` |
| `command` (cmdk) | Keep; Polar `rounded-full` selected rows + gray washes |
| `progress` | Local meter · Orbit gray/surface tokens |
| `radio-group` / `toggle-group` | Radix · Polar hover/selected |
| `separator` / `label` | Thin locals · token colors |
| `sonner` | No Orbit toast — Polar `rounded-2xl` white panel + black action |
| `icon` | Phosphor re-export |

## Polar page layout (PageShell)

`PageShell density="standard"` owns chrome for **every** standard route:

1. **Gutter** — `paddingHorizontal="2xl"` (+ `paddingVertical="xl"`) on the
   scrollable main (clear space from the sidebar edge of the right pane).
2. **Centered column** — inner `maxWidth={1024}` with `alignItems="center"` on
   main so content sits in the middle of the *available* main column (screen
   minus sidebar), not full-bleed left and not viewport-centered including the
   rail.

Do **not** re-wrap children in `mx-auto max-w-* p-6` — that double-pads and
fights the shell. `density="full-bleed"` skips the column (issues feed, settings
split panes).

Dev note: `index.html` must link `/virtual:stylex.css` (css-only StyleX). Vite
`useCSSLayers: false` so Orbit padding wins over Tailwind’s unlayered
`* { padding: 0 }` preflight.

```tsx
<PageShell density="standard" actions={toolbar}>
  {/* children land in the centered column */}
  …
</PageShell>
```

## Polar page recipe (org home)

Projects are a **card gallery** (not Orbit `List` rows) via `PolarCard` on a
responsive `Grid`. Health uses `Status`; tags/stats use Badge→`Pill`; entity
mark uses `Avatar`.

```tsx
<PageShell density="standard" actions={toolbar}>
  <Box flexDirection="column" rowGap="l" width="100%">
    <Box alignItems="center" justifyContent="between">
      <Text as="h2" variant="heading-xs">Projects</Text>
      <Status status="3" color="gray" size="small" />
    </Box>
    <Grid
      templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
      gap="l"
      width="100%"
    >
      {projects.map((project) => (
        <PolarCard key={project.id} to={projectPath(project.id, "issues")}>
          …
        </PolarCard>
      ))}
    </Grid>
  </Box>
</PageShell>
```

Prefer this gallery over Orbit `List` for the projects home; keep `List` for
true feed/inbox row surfaces. Same `PolarCard` for team stat tiles, usage
metrics, billing / plan tiles, and channel cards.

### Product tables

| Surface | Status |
|---|---|
| Design-kit `data-table` | Orbit `DataTable` |
| Monitors list + check-ins | Orbit `DataTable` |
| Org usage by project | Orbit `DataTable` |
| Billing project usage | Orbit `DataTable` |
| Org team members | Orbit `Table` markup (Select/actions) — DataTable candidate |
| Issue occurrences | Custom infinite-scroll table (Phase 6) — DataTable candidate |

Docs reference screenshots: `/tmp/orbit-docs/*.png` · Epure proof: `/tmp/epure-orbit/*.png`.
