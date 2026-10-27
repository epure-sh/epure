import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Embedded History feed — checkbox · title stack (no kind icon per alerts-ui.md). */
export const ALERT_ROW_GRID = "grid-cols-[16px_minmax(0,1fr)]";

/** Notification feed cards — checkbox · kind icon · title. */
export const ALERT_FEED_CARD_ROW_GRID = "grid-cols-[16px_1.25rem_minmax(0,1fr)]";

export interface AlertListColumnHeaderProps {
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  onToggleSelectAll?: () => void;
  selectionActive?: boolean;
  className?: string;
}

export function AlertListColumnHeader({
  selectAllChecked = false,
  selectAllIndeterminate = false,
  onToggleSelectAll,
  selectionActive = false,
  className,
}: AlertListColumnHeaderProps) {
  return (
    <div
      data-slot="alert-list-column-header"
      className={cn(
        "group sticky top-0 z-10 grid h-8 w-full items-center gap-x-3 border-b border-border-subtle bg-surface-2/90 px-4 text-[11px] font-medium text-fg-muted backdrop-blur-xs select-none sm:gap-x-3.5",
        ALERT_ROW_GRID,
        className,
      )}
      aria-hidden
    >
      <div className="flex size-4 shrink-0 items-center justify-center">
        {onToggleSelectAll ? (
          <Checkbox
            checked={selectAllIndeterminate ? "indeterminate" : selectAllChecked}
            aria-label="Select all alerts"
            title="Select all"
            onCheckedChange={() => onToggleSelectAll()}
            className={cn(
              "transition-opacity duration-75",
              selectionActive
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            )}
          />
        ) : null}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate">Alert</span>
        <span className="shrink-0 font-mono tabular-nums">Fired</span>
      </div>
    </div>
  );
}
