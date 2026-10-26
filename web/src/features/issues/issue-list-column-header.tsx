import { Checkbox } from "@/components/ui/checkbox";
import { ISSUE_ROW_GRID } from "@/components/kit/issue-row-shell";
import { cn } from "@/lib/utils";

export interface IssueListColumnHeaderProps {
  compact?: boolean;
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  onToggleSelectAll?: () => void;
  /** Active time filter, used as the trend and events column label. */
  windowLabel?: string;
  className?: string;
}

/**
 * Sticky column labels aligned with `IssueRowShell` tracks so checkbox clicks shift 0 pixels.
 */
export function IssueListColumnHeader({
  selectAllChecked = false,
  selectAllIndeterminate = false,
  onToggleSelectAll,
  windowLabel = "7d",
  className,
}: IssueListColumnHeaderProps) {
  return (
    <div
      data-slot="issue-list-column-header"
      className={cn(
        "sticky top-0 z-10 grid h-8 w-full items-center border-b border-border-subtle bg-surface-2/90 px-3 text-[11px] font-medium text-fg-muted backdrop-blur-xs select-none",
        ISSUE_ROW_GRID,
        className,
      )}
      aria-hidden
    >
      <div className="flex size-4 shrink-0 items-center justify-center">
        {onToggleSelectAll ? (
          <Checkbox
            checked={selectAllIndeterminate ? "indeterminate" : selectAllChecked}
            aria-label="Select all issues"
            title="Select all (x)"
            onCheckedChange={() => onToggleSelectAll()}
          />
        ) : null}
      </div>
      <div className="min-w-0 truncate">Issue</div>
      <div className="text-right">Last seen</div>
      <div className="text-right">Age</div>
      <div className="text-right">Trend</div>
      <div className="text-right tabular-nums" title={`Events in the last ${windowLabel}`}>
        {windowLabel}
      </div>
      <div className="text-right">Users</div>
      <div className="text-right">Priority</div>
    </div>
  );
}
