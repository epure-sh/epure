import type * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Shared with the column header so checkbox clicks shift 0 pixels. */
export const ISSUE_ROW_GRID =
  "grid-cols-[16px_minmax(0,1fr)_5.25rem_4.25rem_6.25rem_4.5rem_4rem_5.25rem] gap-x-3";

export type IssueRowPriority = "critical" | "high" | "medium" | "low";

const PRIORITY_BAR: Record<IssueRowPriority, string> = {
  critical: "bg-escalating",
  high: "bg-escalating",
  medium: "bg-regression",
  low: "bg-border-strong",
};

const PRIORITY_DOT: Record<IssueRowPriority, string> = {
  critical: "bg-escalating",
  high: "bg-escalating",
  medium: "bg-regression",
  low: "bg-fg-muted",
};

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
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  escalating?: boolean;
  priority?: IssueRowPriority;
  statusBadge?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  sparkline?: React.ReactNode;
  eventsCount?: number | string;
  usersCount?: number | string;
  timeAgo?: string;
  age?: string;
  onClick?: () => void;
  className?: string;
  actions?: React.ReactNode;
}

export function IssueRowShell({
  id: _id,
  selected = false,
  onSelectChange,
  escalating = false,
  priority = "low",
  statusBadge,
  title,
  subtitle,
  sparkline,
  eventsCount,
  usersCount,
  timeAgo,
  age,
  onClick,
  className,
  actions,
}: IssueRowShellProps) {
  const tone = escalating ? "critical" : priority;

  return (
    <div
      data-slot="issue-row-shell"
      data-escalating={escalating}
      data-selected={selected}
      data-priority={tone}
      onClick={onClick}
      className={cn(
        "group relative grid min-h-14 w-full items-center border-b border-border-subtle px-3 py-2 text-xs transition-colors duration-100 cursor-pointer select-none",
        ISSUE_ROW_GRID,
        selected ? "bg-surface-2/80" : "bg-surface-1 hover:bg-surface-2/50",
        className,
      )}
    >
      <span
        data-slot="priority-indicator"
        className={cn("absolute inset-y-0 left-0 w-[3px]", PRIORITY_BAR[tone])}
      />

      <div
        className="flex size-4 shrink-0 items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelectChange?.(Boolean(value))}
        />
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_DOT[tone])} aria-hidden />
          <span className="truncate text-sm font-medium text-fg-primary">{title}</span>
          {statusBadge ? <span className="shrink-0">{statusBadge}</span> : null}
        </div>
        {subtitle ? (
          <p className="mt-0.5 truncate pl-4 font-mono text-[11px] text-fg-muted">{subtitle}</p>
        ) : null}
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

      <div className="relative flex items-center justify-end">
        <span className={cn("font-medium", PRIORITY_TEXT[tone], actions && "group-hover:invisible")}>
          {PRIORITY_LABEL[tone]}
        </span>
        {actions ? (
          <div
            className="absolute inset-y-0 right-0 hidden items-center justify-end group-hover:flex"
            onClick={(event) => event.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
