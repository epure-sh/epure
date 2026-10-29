# Epure Design System Catalog (src/components/INDEX.md)

## Layer 1: Personalized Primitives (`@/components/ui/*`)
- `Button` (`@/components/ui/button`): `variant="primary|secondary|outline|ghost|danger|filterEscalating|filterRegression|link|signal"`, `size="xs|sm|md|icon|icon-xs"`, `hotkey?: string`, `loading?: boolean`, `className?` for layout only (not one-off colors)
- `Input` (`@/components/ui/input`): `size="sm|md"`, `leadingIcon?: ReactNode`, `trailingShortcut?: string`
- `Checkbox` (`@/components/ui/checkbox`): Zero-shift 16x16px checkbox (`checked`, `onCheckedChange`)
- `Badge` (`@/components/ui/badge`): `variant="neutral|escalating|regression|healthy|info|…"`, solid semantic fills
- `Icon` (`@/components/ui/icon`): Unified wrapper over `@phosphor-icons/react` (`name`, `size=15`, `weight="regular"|"fill"|"bold"|"duotone"`)
- `Select` (`@/components/ui/select`): `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`
- `Dialog` (`@/components/ui/dialog`): `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogClose`
- `Sheet` (`@/components/ui/sheet`): Slide-over drawer primitive wrapping Radix / Vaul
- `DropdownMenu` (`@/components/ui/dropdown-menu`): `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`
- `Popover` (`@/components/ui/popover`): `Popover`, `PopoverTrigger`, `PopoverContent`
- `Tooltip` (`@/components/ui/tooltip`): `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
- `Tabs` (`@/components/ui/tabs`): `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Label` (`@/components/ui/label`): Accessible label primitive wrapping `@radix-ui/react-label`
- `Separator` (`@/components/ui/separator`): Hairline separator primitive wrapping `@radix-ui/react-separator`
- `Progress` (`@/components/ui/progress`): Accessible progress bar primitive wrapping `@radix-ui/react-progress`
- `RadioGroup` (`@/components/ui/radio-group`): Radio group primitives wrapping `@radix-ui/react-radio-group`
- `Command` (`@/components/ui/command`): Command primitive wrapping `cmdk`
- `Sonner` (`@/components/ui/sonner`): `Toaster`, `toast` notification system

## Layer 2: Epure Composite Kit (`@/components/kit/*`)
- `PageShell` (`@/components/kit/page-shell`): `title`, `description`, `actions`, `density="standard|full-bleed"` — standard = `--epure-page-gutter` (class `epure-page-gutter-x`) + full-width column; page wash = `background-secondary` / `bg-canvas`
- `PolarCard` (`@/components/kit/polar-card`): Polar gallery card (`interactive`, `selected`, `to`, `padding`) + `PolarCardHeader` / `Title` / `Description` / `Body` / `Footer`
- `SectionCard` (`@/components/kit/section-card`): Standard settings/billing panel with header, body, and footer slots
- `CommandBar` (`@/components/kit/command-bar`): Unified `⌘K` search palette & trigger input
- `FilterBar` (`@/components/kit/filter-bar`): URL-synced filter pills + leading `[All]` reset button; optional inline compact search (`search`, `onSearchChange`, `searchPlaceholder`, `searchInputRef`)
- `NavCountPastille` (`@/components/kit/nav-count-pastille`): Sidebar/rail mono count chip (`count`, `tone="neutral|accent"`) — hidden at 0; uses `formatCompactCount`
- `InboxUnreadRail` / read cues (`@/components/kit/inbox-read-cue`): Shared unread rail + title/meta classes for issue and alert feeds
- `InboxLifecycleCue` (`@/components/kit/inbox-lifecycle-cue`): Shared snoozed / came back / resolved / ignored line on issue + alert rows (`@/lib/inbox-lifecycle`)
- Inbox viewed state: `@/lib/inbox-read-state` + `useInboxReadState` (one store per project; issue ↔ alert linked by `issue_id`)
- `IssueRowShell` (`@/components/kit/issue-row-shell`): Locked CSS Grid feed row (issue, last seen, age, events, users, priority icon, row menu slot) — checkbox on row hover or when any bulk selection is active; unread = left accent rail + semibold title
- Alerts History (`AlertListRow`, `AlertsDayGroup`): stacked `PolarCard` rows with day buckets
- `TelemetryChart` (`@/components/kit/telemetry-chart`): Vercel-style Recharts wrapper with locked dark crosshair tooltip
- `CreateAlertRulePanel` (`@/components/kit/create-alert-rule`): Three-step alert setup. Step 1 picks a template, step 2 builds When / If / Then, step 3 chooses channels and message fields. Props: `step`, `draft`, `channels`, `onChange`, `onStep`, `onCreateChannel`, `onPing`, `onSubmit`.
- `AskAgentCard` (`@/components/kit/ask-agent-card`): Primary `[Ask Agent]` copy button + secondary `Check docs ↗` link
- `UsageMeterCard` (`@/components/kit/usage-meter-card`): Resource usage quota meter card with status thresholds
- `EmptyState` (`@/components/kit/empty-state`): Standard zero-data / empty state display
- `DataTable` (`@/components/kit/data-table`): Orbit DataTable façade (`@tanstack/react-table` v9 · manual sort/pagination)
- `CodeFrame` (`@/components/kit/code-frame`): Syntax-highlighted code block wrapping `shiki` with copy actions and target line highlighting
- `ProductTour` / `startEpureProductTour` (`@/components/kit/product-tour`): Issues feed tour (driver.js) styled with Calm Ledger tokens in `app.css`
- `useEpureShortcut` (`@/components/kit/use-epure-shortcut`): Hotkey hook wrapping `react-hotkeys-hook` with automatic form and dialog suppression

## Playground design kit

`npm run dev:playground` → **`/__design`** (canonical Orbit docs: handbook, foundations, component Examples, `#recipes`; `?view=canvas` optional). Catalog: `src/pages/dev/design-kit/` — register `@/components/ui` + `@/components/kit` in `registry.ts` (+ `DESIGN_KIT_UI_META` / `DESIGN_KIT_KIT_META`) + `previews/ui|kit/*.preview.tsx`; register `src/ui/*` in `feature-ui-registry.ts` + `previews/feature-ui/feature-ui-group-previews.tsx`. `/__orbit` redirects to `/__design#recipes`. `npm test` fails if any module is missing.

