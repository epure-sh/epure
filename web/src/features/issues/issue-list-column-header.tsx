import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface IssueListColumnHeaderProps {
  compact?: boolean;
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  onToggleSelectAll?: () => void;
  className?: string;
}

/**
 * Sticky column labels for the issues feed grid; perfectly aligned with `IssueRowShell`
 * CSS Grid tracks: `grid-cols-[16px_auto_1fr_auto_80px_60px_80px] gap-3 px-3` (0px layout shift).
 */
export function IssueListColumnHeader({
  selectAllChecked = false,
  selectAllIndeterminate = false,
  onToggleSelectAll,
  className,
}: IssueListColumnHeaderProps) {
  return (
    <div
      data-slot="issue-list-column-header"
      className={cn(
        "sticky top-0 z-10 grid h-8 w-full items-center border-b border-border-subtle bg-surface-2/90 backdrop-blur-xs px-3 text-[11px] font-medium text-fg-muted select-none",
        "grid-cols-[16px_auto_1fr_auto_80px_60px_80px] gap-3",
        className
      )}
      aria-hidden
    >
      {/* 1. Checkbox slot */}
      <div className="flex items-center justify-center size-4 shrink-0">
        {onToggleSelectAll ? (
          <Checkbox
            checked={selectAllIndeterminate ? "indeterminate" : selectAllChecked}
            aria-label="Select all issues"
            title="Select all (x)"
            onCheckedChange={() => onToggleSelectAll()}
          />
        ) : null}
      </div>

      {/* 2. Priority indicator slot */}
      <div className="shrink-0 w-3.5 text-center text-[10px]">
        !
      </div>

      {/* 3. Title column */}
      <div className="min-w-0 truncate">
        Issue
      </div>

      {/* 4. Trend / sparkline column */}
      <div className="shrink-0 text-right pr-2">
        30d
      </div>

      {/* 5. Events count column */}
      <div className="text-right tabular-nums">
        Events
      </div>

      {/* 6. Users count column */}
      <div className="text-right tabular-nums">
        Users
      </div>

      {/* 7. Activity / TimeAgo column */}
      <div className="text-right tabular-nums">
        Last seen
      </div>
    </div>
  );
}
