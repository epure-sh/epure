# Component recipes

Primitives follow **shadcn new-york** in `src/ui/`. Colors from `tokens.css` only.

## Buttons

| Kind | shadcn mapping | Spec |
|---|---|---|
| Primary | `variant="primary"` | indigo fill, **8px** radius — **Resolve**, setup CTAs, form submit |
| Signal | `variant="signal"` | same indigo as accent (alias) — bulk/hot actions, not a green brand |
| Secondary | `variant="secondary"` | indigo wash, no chrome border — filter triggers, copy, Google sign-in |
| Ghost | `variant="ghost"` | **no border** — Ignore, Snooze, Copy for AI, dismiss |
| Danger | `variant="danger"` | semantic danger border — delete, isolated |

**Triage toolbar:** one `primary` (Resolve) · rest `ghost`. Never two bordered buttons in the cluster.

Sizes: `default` (h-8) · `sm` (h-7) · `toolbar` (h-7 text-xs) · `lg` (h-9) · `icon` (7×7)

Do **not** override buttons to `border-radius: 9999px`.

## Input / Select

- `h-8` · `rounded-md` · `text-sm` · hairline border only
- Focus: `.focus-ring` (1px accent outline)

## Card

- `rounded-lg` (12px) · `border-border` · `p-4` · no shadow
- Login: paper page (`bg-bg`), white card, 12px, one primary submit

## Badges / FilterChip

- Badges: `rounded-md` · `text-xs` (pills only for avatars / true capsules)
- Chips: **5–6px** radius · `text-xs` · `h-7` · key:value, not 9999px pills

## Issue list row

- Compact ops row · title `text-sm` · unread `font-semibold` · meta `font-mono-slash text-xs`
- Unread: weight + small indigo cue (dot and/or 2px `--accent`/`--signal` left edge). **No full-row green or indigo wash**
- Hover: `bg-state-hover`
- Selected: `bg-accent-muted` wash. If also unread, keep the unread mark
- Bulk: `bg-accent-muted/70` (same chroma as selected, not a second color)

## Selection states

| State | Token | Notes |
|---|---|---|
| Row hover | `bg-state-hover` | lightest paper wash |
| Row selected | `bg-accent-muted` | detail target — indigo wash, not a second chroma |
| Row unread | weight + dot/edge | never a full-row fill |
| Row bulk | `bg-accent-muted/70` | multi-select |
| Stat filter active | `bg-state-selected` + `border-b-accent` | not row-hover wash |
| Tab active | `font-semibold` + `border-b-accent` | ink text, not accent fill |

## Type roles

| Role | Class recipe | Use |
|---|---|---|
| display | `text-base font-medium tracking-ui` | PageHeader, PageChrome h1 (14–15px) |
| title | `text-md font-medium tracking-ui` | Issue detail h2 |
| title-compact | `text-sm font-medium tracking-ui` | Issues list context / row titles (13–14px) |
| section | `font-mono text-xs uppercase tracking-wide` | SectionHeader |
| meta | `text-xs text-ink-muted` | timestamps, labels |

No display / marketing sizes in-app.

## Stack / code

- `rounded-md` · `border-border` · `bg-bg-subtle` · mono xs

## Empty / Toast

- Empty: quiet type + one next action · no dashed frame · `py-10` standalone / inset inside tables
- Toast: `rounded-md` · compact `px-3 py-2`

## Shell

- Top strip: `bg-bg`, 8% hairline — not a floating white bar
- Rail: `bg-bg-subtle`, 1px `border-r`, `h-8` items, 8px radius, 2px inset accent. No gradient, no 3px pill marker
