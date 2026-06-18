import { cn } from "../../lib/cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  ALERT_TIME_WINDOW_OPTIONS,
  ALERT_VIEW_MODES,
  type AlertTimeWindow,
  type AlertViewMode,
} from "./alert-utils";

export interface AlertsToolbarProps {
  viewMode: AlertViewMode;
  onViewModeChange: (value: AlertViewMode) => void;
  viewModeCounts: Record<AlertViewMode, number>;
  timeWindow: AlertTimeWindow;
  onTimeWindowChange: (value: AlertTimeWindow) => void;
}

export function AlertsToolbar({
  viewMode,
  onViewModeChange,
  viewModeCounts,
  timeWindow,
  onTimeWindowChange,
}: AlertsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 md:px-6">
      <div
        className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-bg-subtle/40 p-0.5"
        role="tablist"
        aria-label="Alert views"
      >
        {ALERT_VIEW_MODES.map((option) => {
          const count = viewModeCounts[option.value];
          const active = viewMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              title={option.description}
              className={cn(
                "inline-flex h-8 max-w-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-fast focus-ring",
                active
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
              onClick={() => onViewModeChange(option.value)}
            >
              <span className="truncate">{option.label}</span>
              <span
                className={cn(
                  "font-mono text-2xs tabular-nums",
                  active ? "text-ink-muted" : "text-ink-muted/70",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Select
        value={timeWindow}
        onValueChange={(value) => onTimeWindowChange(value as AlertTimeWindow)}
      >
        <SelectTrigger aria-label="Time range" className="h-8 w-auto min-w-[7.5rem] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALERT_TIME_WINDOW_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-sm">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
