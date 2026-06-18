# Component recipes

Primitives follow **shadcn new-york** in `src/ui/`. Colors from `tokens.css` only.

## Buttons

| Kind | shadcn mapping | Spec |
|---|---|---|
| Primary | `variant="primary"` | indigo fill — **Resolve**, setup CTAs, form submit |
| Signal | `variant="signal"` | green unread / bulk-select |
| Secondary | `variant="secondary"` | bordered · filter triggers, copy, regression CTAs |
| Ghost | `variant="ghost"` | no border — Ignore, Snooze, Copy for AI, dismiss |
| Danger | `variant="danger"` | semantic danger border — delete, isolated |

**Triage toolbar:** one `primary` (Resolve) · rest `ghost`. Never two bordered buttons in the cluster.

Sizes: `default` (h-8) · `sm` (h-7) · `toolbar` (h-7 text-xs) · `lg` (h-9) · `icon` (7×7)

## Input / Select

- `h-8` · `rounded-md` · `text-sm` · hairline border only
- Focus: `.focus-ring` (1px accent outline)

## Card

- `rounded-lg` · `border-border` · `p-4` · no shadow

## Badges / FilterChip

- `rounded-md` · `text-xs` · `h-7` (chips)

## Issue list row

- `h-row` · title `text-sm font-medium` · meta `font-mono-slash text-xs`
- Unread: 2px `--signal` left bar
- Hover: `bg-state-hover` · Selected: `bg-state-selected` + 2px `--accent` left edge
- Bulk: `bg-signal-muted/40`

## Selection states

| State | Token | Notes |
|---|---|---|
| Row hover | `bg-state-hover` | lightest wash |
| Row selected | `bg-state-selected` + `border-l-accent` | detail target |
| Row bulk | `bg-signal-muted/40` | multi-select |
| Stat filter active | `bg-state-selected` + `border-b-accent` | not row-hover wash |
| Tab active | `font-semibold` + `border-b-accent` | ink text, not accent fill |

## Type roles

| Role | Class recipe | Use |
|---|---|---|
| display | `text-2xl font-medium tracking-ui` | PageHeader, PageChrome h1 |
| title | `text-xl font-medium tracking-ui` | Issue detail h2 |
| title-compact | `text-md font-medium tracking-ui` | Issues list context |
| section | `font-mono text-xs uppercase tracking-wide` | SectionHeader |
| meta | `text-xs text-ink-muted` | timestamps, labels |

## Stack / code

- `rounded-md` · `border-border` · `bg-bg-subtle` · mono xs

## Empty / Toast

- Empty: dashed border · `p-4`
- Toast: `rounded-md` · compact `px-3 py-2`
