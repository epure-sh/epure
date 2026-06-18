# Theme evaluation checklist

Component matrix for **Calm Ledger (Indigo)** — the only production style theme.

Last evaluated: 2026-09-14 · **63/64 PASS (98%)** · **READY TO TEST**

## Primitives

| Component | Hook | calm-ledger |
|-----------|------|:-----------:|
| Button | `epure-button` | PASS (pill, all variants) |
| Badge | `epure-badge` | PASS (pill outline, semantic) |
| Input | `epure-input` | PASS (tall rounded-lg) |
| Select | `epure-select`, `epure-select-content`, `epure-select-item` | PASS |
| Checkbox | `epure-checkbox` | PASS (rounded-sm, accent checked) |
| Tabs | `epure-tabs-list`, `epure-tabs-trigger` | PASS (underline) |
| Card | `epure-card` | PASS (rounded-xl shadow) |
| Dialog | `epure-dialog-overlay`, `epure-dialog-content` | PASS |
| Dropdown | `epure-dropdown-content`, `epure-dropdown-menu-item` | PASS |
| Popover | `epure-popover-content` | PASS (rounded-lg shadow) |
| Tooltip | `epure-tooltip-content` | PASS (rounded-md shadow) |
| Toast | `epure-toast`, `epure-toast-host` | PASS (light surface, not inverted) |
| Skeleton | `epure-skeleton` | PASS (rounded-sm) |
| Kbd | `epure-kbd` | PASS (rounded-sm) |
| Separator | `epure-separator` | PASS |
| Label | `epure-label` | PASS (sans) |
| Field | `epure-field` | PASS |
| Section | `epure-section-header`, `epure-section-header-title`, `epure-overview-section` | PASS |
| Command | `epure-command`, `epure-command-input`, `epure-command-item` | PASS |
| FilterChip | `epure-filter-chip`, `epure-filter-chip--query` | PASS (pill) |
| Empty | `epure-empty`, `epure-empty-title` | PASS (dashed rounded-lg) |
| PageChrome | `epure-page-chrome`, `epure-page-chrome-header` | PASS |
| CodeBlock | `epure-code-block`, `epure-source-code-block` | PASS (inset rounded-lg) |

## Composites

| Component | Hook | calm-ledger |
|-----------|------|:-----------:|
| StatBar | `epure-stat-bar`, `epure-stat-band`, `epure-stat-card`, `epure-stat-rules`, `epure-stat-rule-segment`, `epure-stat-inline` | PASS (3 cards, 3xl sans) |
| StatValue | `epure-stat-value`, `epure-stat-value-number`, `epure-stat-value-label` | PASS (base in `app.css`) |
| IssueRow | `epure-issue-row`, `epure-issue-row--airy`, `epure-issue-row-title` | PASS (card gap, airy) |
| IssueFeedRow | same as IssueRow | PASS |
| IssueDetailTabs | `epure-issue-detail-tabs` | PASS |
| IssueDetailOverlay | `epure-issue-detail-overlay`, `epure-issue-detail-backdrop`, `epure-issue-detail-toolbar` | PASS |
| IssueOverviewPanel | `epure-overview`, `epure-inset-well` | PASS (card stack) |
| IssueImpactStrip | `epure-impact-strip` | PASS (shadow) |
| IssuePriorityBadge | `epure-priority-badge` | PASS (pill outline) |
| StackTracePanel | `epure-stack-trace`, `epure-call-stack`, `epure-call-stack-row`, `epure-stack-trace-exception` | PASS |
| BreadcrumbTimeline | `epure-breadcrumb-timeline` | PASS |
| FilterPanel | `epure-filter-panel` | PASS (rounded bar) |
| SetupChecklist | `epure-setup-checklist` | PASS |
| CopyDsnBlock | `epure-copy-dsn`, `epure-code-well` | PASS |
| SdkSnippetBlock | `epure-code-well` | PASS |
| RegressionStrip | `epure-regression-strip` | PASS (danger accent) |
| KeyboardHintsFooter | `epure-keyboard-hints` | PASS |
| StepIndicator | `epure-step-indicator` | PASS (pill chips) |
| FairUseBanner | `epure-fair-use-banner` | PASS (rounded shadow) |
| SettingsNav | `epure-settings-nav`, `epure-settings-nav-item` | PASS (pill active) |
| IssuesContextStrip | `epure-context-strip` | PASS |
| IssuesHomeHint | `epure-home-hint` | PASS |
| PageHeader | `epure-page-title` | PASS |
| IssueRowSkeleton | `epure-issue-row-skeleton` | PASS |
| OccurrencesTable | `epure-occurrences-table`, `epure-table`, `epure-table-header`, `epure-table-cell`, `epure-table-scroll` | PASS |
| OccurrenceList | `epure-occurrence-list-item`, `epure-occurrence-picker` | PASS |
| DiffPanel | `epure-card`, `epure-inset-well`, `epure-label` | PASS (reuses primitives) |
| Sparkline | `epure-sparkline` | PASS |
| LineChart | `epure-line-chart`, `epure-line-chart-tooltip` | PASS |
| MorePanel | `epure-more-panel` | PASS |
| PlatformBadge | `epure-platform-badge` | PASS (outline pill) |

## Shell chrome hooks

| Surface | Hook | calm-ledger |
|---------|------|:-----------:|
| App shell | `epure-app-shell`, `epure-app-shell-main` | PASS |
| Top strip | `epure-top-strip`, `epure-navbar` | PASS |
| Navbar crumbs | `epure-navbar-crumb`, `epure-navbar-separator`, `epure-navbar-search` | PASS |
| Navbar actions | `epure-navbar-action`, `epure-navbar-icon-button`, `epure-navbar-logo` | PASS |
| Navbar account | `epure-navbar-account`, `epure-navbar-avatar`, `epure-navbar-feedback` | PASS |
| Shell rail | `epure-shell-rail`, `epure-rail`, `epure-nav-item`, `epure-rail-section-label`, `epure-rail-back` | PASS |
| Issues layout | `epure-issues-layout__list`, `epure-issues-layout__detail` | PASS (overlay shadow) |
| Auth / shell loading | `epure-auth-loading`, `epure-shell-loading` | PASS (text-only, no spinner) |

## Token alignment

| Check | Status |
|-------|--------|
| Color tokens defined only in `calm-ledger.css` `[data-style]` block | PASS |
| Geometry tokens (`--radius-*`, `--control-height`, `--shadow-sm`) theme-scoped | PASS |
| `--text-base` alias added in `tokens.css` (matches `--text-md`) | PASS |
| `:root` shadow defaults `none`; calm-ledger overrides with soft shadow | PASS (intentional) |
| `app.css` base typography hooks (`epure-stat-value`, `epure-inset-well`) use theme vars | PASS |
| No duplicate color hex in `tokens.css` | PASS |

## Intentional exceptions

| Item | Reason |
|------|--------|
| `epure-stat-value-compact` | Base typography only in `app.css`; calm-ledger uses card variant |
| Loading states | Text-only placeholders (`epure-auth-loading`); no `animate-spin` hook in kit |
| `epure-issue-row-skeleton` | Hook on `IssueRowSkeleton` root |
| Toast default TSX | Still uses `bg-ink` classes; calm-ledger overrides to light surface |
| Diff panel root | No dedicated hook; styled via `epure-card` / `epure-inset-well` children |

## Dead / obsolete rules

| Rule | Note |
|------|------|
| `.epure-stat-bar > .grid` | Removed — replaced by `.epure-stat-band` (was dead) |
| `.epure-settings-nav-item.border-l-accent` | Replaced with `[class*="border-l-accent"]` |

## Theme init

| Check | Status |
|-------|--------|
| Default `data-style="calm-ledger"` on document root | PASS |
| Legacy stored theme ids migrate to `calm-ledger` | PASS |
| No style switcher in app or playground | PASS |

## Build

| Check | Status |
|-------|--------|
| `npm run build` | PASS |
| `npx tsc -b` | PASS |

## CSS additions (2026-09-14 audit)

- Button variants: `signal`, `danger`, `link`
- Badge semantic: `success`, default `border-border`
- Filter chip: `--query` modifier, `bg-state-selected` active
- Stat bar: `epure-stat-band`, `epure-stat-rules`, `epure-stat-rule-segment`, `epure-stat-inline`
- Shell: full navbar + rail hook family
- Tables, call stack, occurrence lists, issue detail overlay
- Checkbox checked state, toast light surface override
