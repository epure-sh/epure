import { Checkbox } from "@/components/ui/checkbox";
import { ISSUE_ROW_GRID } from "@/ui/block";
import { cn } from "@/lib/utils";

export interface IssueListColumnHeaderProps {
  compact?: boolean;
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  onToggleSelectAll?: () => void;
  /** Active time filter, used as the events column label hint. */
  windowLabel?: string;
  /** Issues currently shown in this filtered view. */
  viewCount?: number;
  /** @deprecated Checkboxes are always visible. */
  selectionActive?: boolean;
  className?: string;
}

/**
 * Sticky column labels aligned with `IssueRowShell` tracks so checkbox clicks shift 0 pixels.
 * Order: Issue · Events · Users · Last seen · Priority · Actions
 */
export function IssueListColumnHeader({
  selectAllChecked = false,
  selectAllIndeterminate = false,
  onToggleSelectAll,
  windowLabel = "7d",
  viewCount,
  className,
}: IssueListColumnHeaderProps) {
  return (
    <div
      data-slot="issue-list-column-header"
      className={cn(
        "group sticky top-[3.5rem] z-10 grid h-8 w-full items-center border-b border-border-subtle bg-surface-2/90 px-3 text-[11px] font-medium text-fg-muted backdrop-blur-xs select-none",
        ISSUE_ROW_GRID,
        className,
      )}
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
      <div className="flex min-w-0 items-center gap-1.5 truncate">
        <span>Issue</span>
        {typeof viewCount === "number" ? (
          <span
            className="shrink-0 font-mono text-[10px] font-normal tabular-nums text-fg-muted"
            aria-live="polite"
            aria-atomic="true"
          >
            {viewCount} in view
          </span>
        ) : null}
      </div>
      <div className="text-right tabular-nums" title={`Events in the last ${windowLabel}`}>
        Events
      </div>
      <div className="text-right font-semibold text-fg-secondary">Users</div>
      <div className="text-right">Last seen</div>
      <div className="text-right">Priority</div>
      <div className="sr-only">Actions</div>
    </div>
  );
}
