import { cn } from "../../lib/cn";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  ALERT_KIND_FILTERS,
  ALERT_SORT_OPTIONS,
  ALERT_TIME_WINDOW_OPTIONS,
  ALERT_VIEW_MODES,
  type AlertKindFilter,
  type AlertSort,
  type AlertTimeWindow,
  type AlertViewMode,
} from "./alert-utils";

export interface AlertsToolbarProps {
  viewMode: AlertViewMode;
  onViewModeChange: (value: AlertViewMode) => void;
  viewModeCounts: Record<AlertViewMode, number>;
  timeWindow: AlertTimeWindow;
  onTimeWindowChange: (value: AlertTimeWindow) => void;
  kindFilter?: AlertKindFilter;
  onKindFilterChange?: (value: AlertKindFilter) => void;
  sort?: AlertSort;
  onSortChange?: (value: AlertSort) => void;
  onResetFilters?: () => void;
}

export function AlertsToolbar({
  viewMode,
  onViewModeChange,
  viewModeCounts,
  timeWindow,
  onTimeWindowChange,
  kindFilter = "all",
  onKindFilterChange,
  sort = "newest",
  onSortChange,
  onResetFilters,
}: AlertsToolbarProps) {
  const counts = viewModeCounts ?? { all: 0, unread: 0, resolved: 0, ignored: 0 };
  const hasCustomFilters = kindFilter !== "all" || timeWindow !== "7d" || sort !== "newest";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-1 px-4 py-2 md:px-6">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Alert views">
        {ALERT_VIEW_MODES.map((option) => {
          const count = counts[option.value] ?? 0;
          const active = viewMode === option.value;

          return (
            <Button
              key={option.value}
              variant={active ? "secondary" : "ghost"}
              size="xs"
              role="tab"
              aria-selected={active}
              title={option.description}
              onClick={() => onViewModeChange(option.value)}
              className={cn(
                "h-7 gap-1.5 px-2.5 text-xs font-medium",
                active
                  ? "bg-surface-2 text-fg-primary border border-border-strong shadow-tactile"
                  : "text-fg-muted hover:text-fg-primary hover:bg-surface-2/60",
              )}
            >
              <span>{option.label}</span>
              <span
                className={cn(
                  "font-mono text-[10px] tabular-nums rounded px-1.5 py-0.5",
                  active
                    ? "bg-surface-3 text-fg-primary"
                    : "bg-surface-2 text-fg-muted",
                )}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Kind filter */}
        {onKindFilterChange && (
          <Select
            value={kindFilter}
            onValueChange={(value) => onKindFilterChange(value as AlertKindFilter)}
          >
            <SelectTrigger aria-label="Filter by type" size="sm" className="w-auto min-w-[7.5rem] text-xs">
              <SelectValue placeholder="Alert type">
                {ALERT_KIND_FILTERS.find((f) => f.value === kindFilter)?.label ?? "All types"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ALERT_KIND_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Time range */}
        <Select
          value={timeWindow}
          onValueChange={(value) => onTimeWindowChange(value as AlertTimeWindow)}
        >
          <SelectTrigger aria-label="Time range" size="sm" className="w-auto min-w-[7.5rem] text-xs">
            <SelectValue placeholder="Time range">
              {ALERT_TIME_WINDOW_OPTIONS.find((o) => o.value === timeWindow)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ALERT_TIME_WINDOW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        {onSortChange && (
          <Select
            value={sort}
            onValueChange={(value) => onSortChange(value as AlertSort)}
          >
            <SelectTrigger aria-label="Sort alerts" size="sm" className="w-auto min-w-[7rem] text-xs">
              <SelectValue placeholder="Sort">
                {ALERT_SORT_OPTIONS.find((s) => s.value === sort)?.label ?? "Newest"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ALERT_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasCustomFilters && onResetFilters && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onResetFilters}
            className="h-7 text-xs text-fg-muted hover:text-fg-primary"
            title="Reset filters to default"
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
