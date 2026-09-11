import { cn } from "../../lib/cn";
import { Checkbox } from "../../ui/checkbox";
import {
  FEED_CELL_CHECKBOX,
  FEED_CELL_ISSUE,
  FEED_CELL_NUMERIC,
  FEED_CELL_PRIORITY,
  FEED_CELL_TEXT,
  FEED_CELL_TREND,
  FEED_GRID_COMPACT,
  FEED_GRID_FULL,
  FEED_HEADER_CELL,
} from "../../ui/issue-feed-layout";

const HEADER_LABEL = "text-xs font-medium text-ink-muted";

export interface IssueListColumnHeaderProps {
  compact?: boolean;
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  onToggleSelectAll?: () => void;
}

/** Sticky column labels for the issues feed grid; aligns with `IssueFeedRow` columns. */
export function IssueListColumnHeader({
  compact = false,
  selectAllChecked = false,
  selectAllIndeterminate = false,
  onToggleSelectAll,
}: IssueListColumnHeaderProps) {
  const gridClass = compact ? FEED_GRID_COMPACT : FEED_GRID_FULL;

  return (
    <div
      className={cn(
        "epure-issue-list-header sticky top-0 z-10 hidden shrink-0 items-center border-b border-l-2 border-l-transparent border-border bg-bg-subtle lg:grid",
        gridClass,
      )}
      aria-hidden
    >
      <div className={cn(FEED_HEADER_CELL, FEED_CELL_CHECKBOX)}>
        {onToggleSelectAll ? (
          <Checkbox
            checked={selectAllIndeterminate ? "indeterminate" : selectAllChecked}
            aria-label="Select all issues"
            title="Select all"
            onCheckedChange={() => onToggleSelectAll()}
          />
        ) : null}
      </div>

      <div className={cn(FEED_HEADER_CELL, FEED_CELL_ISSUE)}>
        <span className={HEADER_LABEL}>Issue</span>
      </div>

      <div className={cn(FEED_HEADER_CELL, FEED_CELL_TEXT, "hidden lg:flex")}>
        <span className={HEADER_LABEL}>Last seen</span>
      </div>

      {!compact ? (
        <>
          <div className={cn(FEED_HEADER_CELL, FEED_CELL_TEXT, "hidden xl:flex")}>
            <span className={HEADER_LABEL}>Age</span>
          </div>
          <div className={cn(FEED_HEADER_CELL, FEED_CELL_TREND, "hidden lg:flex")}>
            <span className={HEADER_LABEL}>Trend</span>
          </div>
          <div className={cn(FEED_HEADER_CELL, FEED_CELL_NUMERIC, "justify-end")}>
            <span className={HEADER_LABEL}>Events</span>
          </div>
          <div className={cn(FEED_HEADER_CELL, FEED_CELL_NUMERIC, "hidden justify-end xl:flex")}>
            <span className={HEADER_LABEL}>Users</span>
          </div>
          <div className={cn(FEED_CELL_PRIORITY, "hidden xl:flex")}>
            <span className={HEADER_LABEL}>Priority</span>
          </div>
        </>
      ) : (
        <div className={cn(FEED_CELL_NUMERIC, "flex justify-end")}>
          <span className={HEADER_LABEL}>Events</span>
        </div>
      )}
    </div>
  );
}
