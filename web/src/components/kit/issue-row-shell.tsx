import type * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Shared with the column header so checkbox clicks shift 0 pixels. */
export const ISSUE_ROW_GRID =
  "grid-cols-[16px_minmax(0,1fr)_5.25rem_4.25rem_6.25rem_4.5rem_4rem_5.25rem] gap-x-3";

export type IssueRowPriority = "critical" | "high" | "medium" | "low";

const PRIORITY_TEXT: Record<IssueRowPriority, string> = {
  critical: "text-escalating",
  high: "text-escalating",
  medium: "text-regression",
  low: "text-fg-muted",
};

const PRIORITY_LABEL: Record<IssueRowPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export interface IssueRowShellProps {
  id: string;
  /** Bulk selection (X / header checkbox). */
  bulkSelected?: boolean;
  /** Keyboard focus — checks the row checkbox without a row wash. */
  focused?: boolean;
  /** Detail pane open on this issue — indigo selected wash. */
  detailActive?: boolean;
  onSelectChange?: (selected: boolean) => void;
  escalating?: boolean;
  priority?: IssueRowPriority;
  statusBadge?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  sparkline?: React.ReactNode;
  eventsCount?: number | string;
  usersCount?: number | string;
  timeAgo?: string;
  age?: string;
  onClick?: () => void;
  className?: string;
  /** First visible row — product tour anchor. */
  tourAnchor?: boolean;
  /** Unread since last detail view — indigo cue, cleared when detail is opened. */
  unread?: boolean;
}

export function IssueRowShell({
  id: _id,
  bulkSelected = false,
  focused = false,
  detailActive = false,
  onSelectChange,
  escalating = false,
  priority = "low",
  statusBadge,
  title,
  subtitle,
  meta,
  sparkline,
  eventsCount,
  usersCount,
  timeAgo,
  age,
  onClick,
  className,
  tourAnchor = false,
  unread = false,
}: IssueRowShellProps) {
  const tone = escalating ? "critical" : priority;
  const checkboxChecked = bulkSelected;

  return (
    <div
      data-slot="issue-row-shell"
      data-escalating={escalating}
      data-focused={focused}
      data-detail-active={detailActive}
      data-priority={tone}
      data-tour={tourAnchor ? "issue-row-sample" : undefined}
      onClick={onClick}
      className={cn(
        "relative grid min-h-[3.25rem] w-full items-center border-b border-border-subtle px-3 py-2 text-xs transition-colors duration-100 cursor-pointer select-none",
        ISSUE_ROW_GRID,
        detailActive && "bg-accent-muted",
        bulkSelected && !detailActive && "bg-accent-muted/70",
        className,
      )}
    >
      <div
        className="flex size-4 shrink-0 items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <Checkbox
          checked={checkboxChecked}
          onCheckedChange={(value) => onSelectChange?.(Boolean(value))}
          aria-label={checkboxChecked ? "Deselect issue" : "Select issue"}
        />
      </div>

      <div className="flex min-w-0 items-center gap-2 self-stretch py-0.5 pr-2">
        {unread ? (
          <span
            className="size-2 shrink-0 rounded-full bg-accent shadow-[0_0_6px_color-mix(in_srgb,var(--accent)_55%,transparent)] ring-[3px] ring-accent/20"
            title="Unread"
            aria-hidden
          />
        ) : (
          <span className="size-2 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "min-w-0 truncate text-sm text-fg-primary",
              unread ? "font-semibold" : "font-medium",
            )}
          >
            {title}
          </span>
          {statusBadge ? <span className="shrink-0">{statusBadge}</span> : null}
        </div>
        {subtitle ? (
          <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-fg-muted">{subtitle}</p>
        ) : null}
        {meta ? <div className="mt-1">{meta}</div> : null}
        </div>
      </div>

      <div className="text-right font-mono text-[11px] tabular-nums text-fg-secondary">{timeAgo}</div>
      <div className="text-right font-mono text-[11px] tabular-nums text-fg-muted">{age ?? "—"}</div>

      <div className="flex items-center justify-end">{sparkline}</div>

      <div className="text-right font-mono text-[11px] tabular-nums text-fg-secondary">
        {eventsCount !== undefined ? <span>{eventsCount}</span> : null}
      </div>
      <div className="text-right font-mono text-[11px] tabular-nums text-fg-muted">
        {usersCount !== undefined ? <span>{usersCount}</span> : null}
      </div>

      <div className="flex items-center justify-end">
        <span className={cn("font-medium tabular-nums", PRIORITY_TEXT[tone])}>
          {PRIORITY_LABEL[tone]}
        </span>
      </div>
    </div>
  );
}
