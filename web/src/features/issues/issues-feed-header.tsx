import { Search } from "lucide-react";
import { useState, type RefObject } from "react";
import type { HeadlineStats } from "../../lib/api";
import { formatCompactCount } from "../../lib/format-count";
import { cn } from "../../lib/cn";
import { ActionButton } from "../../ui/action-button";
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
  extractChips,
  getEventsStatLabel,
  getIssueSortLabel,
  ISSUE_SORT_OPTIONS,
  parseQuery,
  queryHasToken,
  removeChipToken,
  replaceFreeText,
  STATUS_FILTER_PRESETS,
  TIME_WINDOW_OPTIONS,
  toggleToken,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";

function FeedStateDot() {
  return <span className="px-1.5 text-ink-muted/40" aria-hidden>·</span>;
}

interface FeedStateStatProps {
  label: string;
  value: number;
  loading?: boolean;
  active?: boolean;
  onClick?: () => void;
}

function FeedStateStat({ label, value, loading = false, active = false, onClick }: FeedStateStatProps) {
  const count = loading ? "—" : formatCompactCount(value);

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "focus-ring rounded-md px-0.5 transition-colors duration-fast hover:text-ink",
          active ? "font-medium text-accent" : "text-ink-muted",
        )}
      >
        <span className="font-mono tabular-nums text-ink">{count}</span> {label}
      </button>
    );
  }

  return (
    <span className="text-ink-muted">
      <span className="font-mono tabular-nums text-ink">{count}</span> {label}
    </span>
  );
}

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

  function removeChip(token: string) {
    onQueryChange(removeChipToken(query, token));
    filterInputRef?.current?.focus();
  }

  function applyStatePreset(token: string) {
    onQueryChange(toggleToken(query, token));
    filterInputRef?.current?.focus();
  }

  return (
    <header className="epure-issues-feed-header shrink-0 border-b border-border bg-bg">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 md:px-6">
        <h1 className="epure-page-title font-medium tracking-ui text-ink">Feed</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={issueSort} onValueChange={(value) => onIssueSortChange(value as IssueSortValue)}>
            <SelectTrigger aria-label="Sort issues" className="h-7 w-auto min-w-[8.5rem] text-xs">
              <SelectValue>{getIssueSortLabel(issueSort)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ISSUE_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeWindow} onValueChange={(value) => onTimeWindowChange(value as TimeWindowValue)}>
            <SelectTrigger aria-label="Time range" className="h-7 w-auto min-w-[4.5rem] text-xs">
              <SelectValue>
                {TIME_WINDOW_OPTIONS.find((option) => option.value === timeWindow)?.label.replace("Last ", "") ??
                  timeWindow.toUpperCase()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIME_WINDOW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onExportCsv ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ActionButton variant="ghost" size="toolbar" className="text-xs">
                  Export
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!issueCount}
                  onSelect={() => onExportCsv("view")}
                >
                  CSV · this view{issueCount ? ` (${issueCount})` : ""}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selectedCount === 0}
                  onSelect={() => onExportCsv("selected")}
                >
                  CSV · selected{selectedCount ? ` (${selectedCount})` : ""}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <ActionButton
              variant="ghost"
              size="toolbar"
              disabled
              tooltip="Saved views are coming soon"
              className="text-xs"
            >
              Save As
            </ActionButton>
          )}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-0.5 border-t border-border px-4 py-2 text-xs leading-snug md:px-6"
        aria-label="Issue counts by state"
      >
        <FeedStateStat
          label="unresolved"
          value={stats?.unresolved ?? 0}
          loading={statsLoading}
          active={queryHasToken(query, "is:unresolved")}
          onClick={onFilterToken ? () => onFilterToken("is:unresolved") : undefined}
        />
        <FeedStateDot />
        <FeedStateStat
          label="regressions"
          value={stats?.regressions ?? 0}
          loading={statsLoading}
          active={queryHasToken(query, "is:regression")}
          onClick={onFilterToken ? () => onFilterToken("is:regression") : undefined}
        />
        <FeedStateDot />
        <FeedStateStat
          label="snoozed"
          value={stats?.snoozed ?? 0}
          loading={statsLoading}
          active={queryHasToken(query, "is:snoozed")}
          onClick={onFilterToken ? () => onFilterToken("is:snoozed") : undefined}
        />
        <FeedStateDot />
        <FeedStateStat
          label={getEventsStatLabel(timeWindow).toLowerCase()}
          value={stats?.events_7d ?? 0}
          loading={statsLoading}
        />
      </div>

      <div className="border-t border-border py-2.5">
        <div className="mx-4 md:mx-6">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverAnchor asChild>
              <div
                className="epure-filter-panel epure-issues-feed-search flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border px-3"
                onClick={() => setSearchOpen(true)}
              >
                <Search size={14} className="shrink-0 text-ink-muted" aria-hidden />
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
                        ? "Search in this state…"
                        : chips.length > 0
                          ? "Add keywords…"
                          : "Search exceptions…"
                    }
                    aria-label="Search issues"
                    aria-expanded={searchOpen}
                    aria-haspopup="listbox"
                    className="h-full min-h-0 min-w-[8rem] flex-1 border-0 bg-transparent px-0 py-0 leading-none shadow-none focus-ring"
                  />
                </div>
              </div>
            </PopoverAnchor>

            <PopoverContent
              align="start"
              sideOffset={6}
              className="w-[var(--radix-popover-anchor-width)] space-y-3 p-3.5"
              onOpenAutoFocus={(event) => event.preventDefault()}
              onInteractOutside={(event) => {
                if (filterInputRef?.current?.contains(event.target as Node)) {
                  event.preventDefault();
                }
              }}
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-ink">State</p>
                <p className="text-xs text-ink-muted">Show issues in one lifecycle state at a time.</p>
              </div>
              <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Issue state">
                {STATUS_FILTER_PRESETS.map((preset) => {
                  const active = queryHasToken(query, preset.token);
                  return (
                    <FilterChip
                      key={preset.token}
                      label={preset.label}
                      active={active}
                      onClick={() => applyStatePreset(preset.token)}
                    />
                  );
                })}
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">
                Type in the search box to match exception titles and messages.
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
