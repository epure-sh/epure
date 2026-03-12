import { FilterChip } from "../../ui/filter-chip";
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
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Alert views">
        {ALERT_VIEW_MODES.map((option) => {
          const count = viewModeCounts[option.value];
          const active = viewMode === option.value;

          return (
            <FilterChip
              key={option.value}
              label={`${option.label} ${count}`}
              active={active}
              title={option.description}
              role="tab"
              aria-selected={active}
              onClick={() => onViewModeChange(option.value)}
            />
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
