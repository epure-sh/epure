import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  Moon,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { useState, type RefObject } from "react";
import type { HeadlineStats } from "../../lib/api";
import { formatCompactCount } from "../../lib/format-count";
import { cn } from "../../lib/cn";
import { ActionButton } from "../../ui/action-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { FilterChip } from "../../ui/filter-chip";
import { Input } from "../../ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "../../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  ENVIRONMENT_FILTER_PRESETS,
  extractChips,
  getEventsStatLabel,
  getIssueSortLabel,
  hasActiveFilters,
  IMPACT_FILTER_PRESETS,
  ISSUE_SORT_OPTIONS,
  LEVEL_FILTER_PRESETS,
  parseQuery,
  queryHasToken,
  removeChipToken,
  replaceFreeText,
  resetQuery,
  STATUS_FILTER_PRESETS,
  TIME_WINDOW_OPTIONS,
  toggleToken,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";

export interface IssuesFeedHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  onApply: () => void;
  timeWindow: TimeWindowValue;
  onTimeWindowChange: (value: TimeWindowValue) => void;
  issueSort: IssueSortValue;
  onIssueSortChange: (value: IssueSortValue) => void;
  filterInputRef?: RefObject<HTMLInputElement | null>;
  issueCount?: number;
  loading?: boolean;
  stats?: HeadlineStats | null;
  statsLoading?: boolean;
  onFilterToken?: (token: string) => void;
  selectedCount?: number;
  onExportCsv?: (scope: "view" | "selected") => void;
}

export function IssuesFeedHeader({
  query,
  onQueryChange,
  timeWindow,
  onTimeWindowChange,
  issueSort,
  onIssueSortChange,
  filterInputRef,
  issueCount,
  stats,
  statsLoading = false,
  onFilterToken,
  selectedCount = 0,
  onExportCsv,
}: IssuesFeedHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const chips = extractChips(query);
  const { freeText } = parseQuery(query);
  const hasStateChip = chips.some((chip) => chip.key === "is");

  const isUnresolvedActive = queryHasToken(query, "is:unresolved");
  const isRegressionActive = queryHasToken(query, "is:regression");
  const isSnoozedActive = queryHasToken(query, "is:snoozed");
  const isAllActive = !hasStateChip;

  // Active filters beyond default "is:unresolved"
  const isCustomized = hasActiveFilters(query) || Boolean(freeText && freeText.trim().length > 0);

  function setDirectStateFilter(token: string | null) {
    if (token && onFilterToken) {
      onFilterToken(token);
      return;
    }
    let nextQuery = query;
    // Remove existing `is:...` tokens
    for (const chip of chips) {
      if (chip.key === "is") {
        nextQuery = removeChipToken(nextQuery, chip.token);
      }
    }
    if (token) {
      nextQuery = `${nextQuery.trim()} ${token}`.trim();
    }
    onQueryChange(nextQuery);
    filterInputRef?.current?.focus();
  }

  function removeChip(token: string) {
    onQueryChange(removeChipToken(query, token));
    filterInputRef?.current?.focus();
  }

  function applyPreset(token: string) {
    onQueryChange(toggleToken(query, token));
    filterInputRef?.current?.focus();
  }

  function handleResetAll() {
    onQueryChange(resetQuery());
    setSearchOpen(false);
    filterInputRef?.current?.focus();
  }

  const unresolvedCount = statsLoading ? "…" : formatCompactCount(stats?.unresolved ?? 0);
  const regressionCount = statsLoading ? "…" : formatCompactCount(stats?.regressions ?? 0);
  const snoozedCount = statsLoading ? "…" : formatCompactCount(stats?.snoozed ?? 0);
  const eventsCount = statsLoading ? "…" : formatCompactCount(stats?.events_7d ?? 0);

  return (
    <header className="epure-issues-feed-header shrink-0 border-b border-border bg-bg select-none">
      {/* Tier 1: Triage Mode Cockpit & View Horizon Controls */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/60 px-4 py-2 md:px-6">
        {/* Triage Mode Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {/* Unresolved Tab */}
          <Button
            variant={isUnresolvedActive ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDirectStateFilter(isUnresolvedActive ? null : "is:unresolved")}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                (stats?.unresolved ?? 0) > 0 ? "bg-signal animate-pulse" : "bg-fg-muted/40",
              )}
            />
            <span>Unresolved</span>
            <span
              className={cn(
                "ml-1 font-mono text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full",
                isUnresolvedActive
                  ? "bg-signal/20 text-signal"
                  : "bg-surface-2 text-fg-muted",
              )}
            >
              {unresolvedCount}
            </span>
          </Button>

          {/* Regressions Tab */}
          <Button
            variant={isRegressionActive ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDirectStateFilter(isRegressionActive ? null : "is:regression")}
          >
            <AlertTriangle
              className={cn(
                "h-3 w-3 shrink-0",
                (stats?.regressions ?? 0) > 0 ? "text-regression" : "text-fg-muted/60",
              )}
            />
            <span>Regressions</span>
            <span
              className={cn(
                "ml-0.5 font-mono text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full",
                (stats?.regressions ?? 0) > 0
                  ? "bg-regression/20 text-regression"
                  : "bg-surface-2 text-fg-muted",
              )}
            >
              {regressionCount}
            </span>
          </Button>

          {/* Snoozed Tab */}
          <Button
            variant={isSnoozedActive ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDirectStateFilter(isSnoozedActive ? null : "is:snoozed")}
          >
            <Moon className="h-3 w-3 shrink-0 text-fg-muted/70" />
            <span>Snoozed</span>
            <span className="ml-0.5 font-mono text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-surface-2 text-fg-muted">
              {snoozedCount}
            </span>
          </Button>

          {/* All Issues Tab */}
          <Button
            variant={isAllActive ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDirectStateFilter(null)}
          >
            All
          </Button>
        </div>

        {/* View Controls: Sort, Time Window, Export */}
        <div className="flex items-center gap-2">
          {/* Sort Selector */}
          <Select value={issueSort} onValueChange={(value) => onIssueSortChange(value as IssueSortValue)}>
            <SelectTrigger aria-label="Sort issues" className="h-7 w-auto min-w-[8rem] text-xs btn-tactile">
              <SlidersHorizontal className="mr-1.5 h-3 w-3 text-ink-muted shrink-0" />
              <SelectValue>{getIssueSortLabel(issueSort)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ISSUE_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time Window Selector */}
          <Select value={timeWindow} onValueChange={(value) => onTimeWindowChange(value as TimeWindowValue)}>
            <SelectTrigger aria-label="Time range" className="h-7 w-auto min-w-[4.8rem] text-xs btn-tactile">
              <Clock className="mr-1.5 h-3 w-3 text-ink-muted shrink-0" />
              <SelectValue>
                {TIME_WINDOW_OPTIONS.find((option) => option.value === timeWindow)?.label.replace("Last ", "") ??
                  timeWindow.toUpperCase()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIME_WINDOW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Export Action */}
          {onExportCsv ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ActionButton variant="ghost" size="toolbar" className="h-7 text-xs btn-tactile">
                  <Download className="mr-1 h-3 w-3 text-ink-muted" />
                  <span>Export</span>
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  disabled={!issueCount}
                  onSelect={() => onExportCsv("view")}
                >
                  CSV · Current view {issueCount ? `(${issueCount})` : ""}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selectedCount === 0}
                  onSelect={() => onExportCsv("selected")}
                >
                  CSV · Selected {selectedCount ? `(${selectedCount})` : ""}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* Tier 2: Search Omnibar with Pre-Filter Palette on click & One Reset Button */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 max-w-2xl">
          {/* Unified Command Omnibar */}
          <div className="relative min-w-0 flex-1">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverAnchor asChild>
                <div
                  className="epure-filter-panel epure-issues-feed-search flex h-8 min-w-0 items-center gap-2 rounded-md border border-border bg-surface px-2.5 transition-colors hover:border-border-strong focus-within:border-accent cursor-text"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search size={13} className="shrink-0 text-ink-muted" aria-hidden />
                  <div className="flex min-h-0 min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                    {chips.map((chip) => (
                      <FilterChip
                        key={chip.token}
                        variant="query"
                        filterKey={chip.plain ? undefined : chip.key}
                        label={chip.label}
                        tokenHint={chip.token}
                        title={chip.token}
                        onRemove={() => removeChip(chip.token)}
                      />
                    ))}
                    <Input
                      ref={filterInputRef}
                      value={freeText ?? ""}
                      onChange={(event) => onQueryChange(replaceFreeText(query, event.target.value))}
                      onFocus={() => setSearchOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          setSearchOpen(false);
                        }
                        if (event.key === "Escape") {
                          setSearchOpen(false);
                          filterInputRef?.current?.blur();
                        }
                      }}
                      placeholder={
                        hasStateChip
                          ? "Filter in this view or type level:error…"
                          : chips.length > 0
                            ? "Add keywords or tokens…"
                            : "Search exceptions (e.g. TypeError, level:error, env:prod)…"
                      }
                      aria-label="Search issues"
                      aria-expanded={searchOpen}
                      aria-haspopup="listbox"
                      className="h-full min-h-0 min-w-[7rem] flex-1 border-0 bg-transparent px-0 py-0 text-xs leading-none shadow-none focus:outline-none"
                    />
                  </div>

                  <kbd className="hidden sm:inline-flex h-4 select-none items-center rounded border border-border px-1.5 font-mono text-[10px] text-ink-subtle">
                    /
                  </kbd>
                </div>
              </PopoverAnchor>

              {/* Comprehensive Pre-Filter Palette (opens only when clicking search bar) */}
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-[min(calc(100vw-2rem),520px)] space-y-3.5 p-4 shadow-xl border border-border bg-surface rounded-xl"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onInteractOutside={(event) => {
                  if (filterInputRef?.current?.contains(event.target as Node)) {
                    event.preventDefault();
                  }
                }}
              >
                {/* Palette Header */}
                <div className="border-b border-border/70 pb-2.5">
                  <p className="text-xs font-semibold text-ink">Pre-Filter Options</p>
                  <p className="text-2xs text-ink-muted">Click any token to filter results immediately.</p>
                </div>

                {/* Categorized Filter Tokens */}
                <div className="space-y-3">
                  {/* Category 1: Severity Level */}
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                      Severity Level
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {LEVEL_FILTER_PRESETS.map((preset) => {
                        const active = queryHasToken(query, preset.token);
                        return (
                          <Button
                            key={preset.token}
                            variant={active ? "secondary" : "outline"}
                            size="xs"
                            onClick={() => applyPreset(preset.token)}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                preset.token === "level:fatal" && "bg-escalating",
                                preset.token === "level:error" && "bg-escalating",
                                preset.token === "level:warning" && "bg-regression",
                                preset.token === "level:info" && "bg-info",
                              )}
                            />
                            <span>{preset.label}</span>
                            {active ? <Check size={11} className="ml-0.5 text-primary" /> : null}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category 2: Environment */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted mb-1.5">
                      Environment
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ENVIRONMENT_FILTER_PRESETS.map((preset) => {
                        const active = queryHasToken(query, preset.token);
                        return (
                          <Button
                            key={preset.token}
                            variant={active ? "secondary" : "outline"}
                            size="xs"
                            onClick={() => applyPreset(preset.token)}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                preset.token === "env:production" && "bg-healthy",
                                preset.token === "env:staging" && "bg-info",
                                preset.token === "env:development" && "bg-regression",
                                preset.token === "env:preview" && "bg-info",
                              )}
                            />
                            <span>{preset.label}</span>
                            {active ? <Check size={11} className="ml-0.5 text-primary" /> : null}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category 3: Lifecycle State */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted mb-1.5">
                      Lifecycle State
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_FILTER_PRESETS.map((preset) => {
                        const active = queryHasToken(query, preset.token);
                        return (
                          <Button
                            key={preset.token}
                            variant={active ? "secondary" : "outline"}
                            size="xs"
                            onClick={() => applyPreset(preset.token)}
                          >
                            <span>{preset.label}</span>
                            {active ? <Check size={11} className="ml-0.5 text-primary" /> : null}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category 4: Impact & Telemetry */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted mb-1.5">
                      Impact & Telemetry
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {IMPACT_FILTER_PRESETS.map((preset) => {
                        const active = queryHasToken(query, preset.token);
                        return (
                          <Button
                            key={preset.token}
                            variant={active ? "secondary" : "outline"}
                            size="xs"
                            onClick={() => applyPreset(preset.token)}
                          >
                            <Users size={12} className="text-fg-muted" />
                            <span>{preset.label}</span>
                            {active ? <Check size={11} className="ml-0.5 text-primary" /> : null}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Syntax Helper Footer */}
                <div className="border-t border-border-subtle pt-2.5 flex items-center justify-between text-[10px] text-fg-muted">
                  <span>
                    Combine: <code className="font-mono text-fg-primary">level:error env:production</code>
                  </span>
                  <span>
                    Press <kbd className="font-mono text-fg-primary border border-border-subtle px-1 rounded">Enter</kbd> to search
                  </span>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Only ONE Reset Button (visible when query is customized) */}
          {isCustomized ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetAll}
              title="Reset all filters to default (Esc)"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </Button>
          ) : null}
        </div>

        {/* Live Ingestion & Spike Valve Telemetry Indicator */}
        <div className="hidden sm:flex items-center gap-2 text-2xs text-ink-muted shrink-0">
          <span className="flex items-center gap-1.5 rounded-full border border-border/80 bg-surface px-2.5 py-0.5 font-tabular">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <span className="font-mono font-medium text-ink">{eventsCount}</span>
            <span>{getEventsStatLabel(timeWindow).toLowerCase()}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-ink-subtle">
            <Sparkles className="h-3 w-3 text-healthy" />
            <span>0 overages</span>
          </span>
        </div>
      </div>
    </header>
  );
}

