import { MoreHorizontal } from "lucide-react";
import { FilterChip } from "../../ui/filter-chip";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
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
  type AlertKindFilter,
  type AlertSort,
  type AlertTimeWindow,
} from "./alert-utils";

export interface AlertsToolbarProps {
  kindFilter: AlertKindFilter;
  onKindFilterChange: (value: AlertKindFilter) => void;
  sort: AlertSort;
  onSortChange: (value: AlertSort) => void;
  timeWindow: AlertTimeWindow;
  onTimeWindowChange: (value: AlertTimeWindow) => void;
  compactRows: boolean;
  onCompactRowsChange: (value: boolean) => void;
}

export function AlertsToolbar({
  kindFilter,
  onKindFilterChange,
  sort,
  onSortChange,
  timeWindow,
  onTimeWindowChange,
  compactRows,
  onCompactRowsChange,
}: AlertsToolbarProps) {
  const sortLabel =
    ALERT_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Newest first";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2 md:px-6">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {ALERT_KIND_FILTERS.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            active={kindFilter === option.value}
            onClick={() => onKindFilterChange(option.value)}
          />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Select value={timeWindow} onValueChange={(value) => onTimeWindowChange(value as AlertTimeWindow)}>
          <SelectTrigger aria-label="Time range" className="h-8 w-auto min-w-[8.5rem] text-xs">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0"
              aria-label={`More options — sorted ${sortLabel.toLowerCase()}`}
            >
              <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs font-normal text-ink-muted">Sort</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={(value) => onSortChange(value as AlertSort)}>
              {ALERT_SORT_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <label className="flex cursor-pointer items-start gap-2 px-2 py-1.5">
              <Checkbox
                checked={compactRows}
                onCheckedChange={(checked) => onCompactRowsChange(checked === true)}
                aria-label="Compact rows"
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm text-ink">Compact rows</span>
                <span className="block text-xs text-ink-muted">Less padding in the list</span>
              </span>
            </label>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
