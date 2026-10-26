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
- `PageShell` (`@/components/kit/page-shell`): `title`, `description`, `actions`, `density="standard|full-bleed"`
- `SectionCard` (`@/components/kit/section-card`): Standard settings/billing panel with header, body, and footer slots
- `CommandBar` (`@/components/kit/command-bar`): Unified `⌘K` search palette & trigger input
- `FilterBar` (`@/components/kit/filter-bar`): URL-synced filter pills + leading `[All]` reset button; optional inline compact search (`search`, `onSearchChange`, `searchPlaceholder`, `searchInputRef`)
- `IssueRowShell` (`@/components/kit/issue-row-shell`): Locked CSS Grid feed row (issue, last seen, age, trend, events, users, priority) — checkbox is bulk-select only; unread indigo dot clears after detail view
- `TelemetryChart` (`@/components/kit/telemetry-chart`): Vercel-style Recharts wrapper with locked dark crosshair tooltip
- `AskAgentCard` (`@/components/kit/ask-agent-card`): Primary `[Ask Agent]` copy button + secondary `Check docs ↗` link
- `UsageMeterCard` (`@/components/kit/usage-meter-card`): Resource usage quota meter card with status thresholds
- `EmptyState` (`@/components/kit/empty-state`): Standard zero-data / empty state display
- `DataTable` (`@/components/kit/data-table`): High-performance table combining `@tanstack/react-table` v8 and `@tanstack/react-virtual`
- `CodeFrame` (`@/components/kit/code-frame`): Syntax-highlighted code block wrapping `shiki` with copy actions and target line highlighting
- `ProductTour` / `startEpureProductTour` (`@/components/kit/product-tour`): Issues feed tour (driver.js) styled with Calm Ledger tokens in `app.css`
- `useEpureShortcut` (`@/components/kit/use-epure-shortcut`): Hotkey hook wrapping `react-hotkeys-hook` with automatic form and dialog suppression

## Playground design kit

`npm run dev:playground` → **`/__design`** (not shipped on production builds). Catalog: `src/pages/dev/design-kit/` — register `@/components/ui` + `@/components/kit` in `registry.ts` + `previews/ui|kit/*.preview.tsx`; register `src/ui/*` in `feature-ui-registry.ts` + `previews/feature-ui/feature-ui-group-previews.tsx`. `npm test` fails if any module is missing.

