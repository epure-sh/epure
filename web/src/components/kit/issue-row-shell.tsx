import type * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface IssueRowShellProps {
  id: string;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  escalating?: boolean;
  statusBadge?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  sparkline?: React.ReactNode;
  eventsCount?: number | string;
  usersCount?: number | string;
  timeAgo?: string;
  onClick?: () => void;
  className?: string;
  actions?: React.ReactNode;
}

export function IssueRowShell({
  id: _id,
  selected = false,
  onSelectChange,
  escalating = false,
  statusBadge,
  title,
  subtitle,
  sparkline,
  eventsCount,
  usersCount,
  timeAgo,
  onClick,
  className,
  actions,
}: IssueRowShellProps) {
  return (
    <div
      data-slot="issue-row-shell"
      data-escalating={escalating}
      data-selected={selected}
      onClick={onClick}
      className={cn(
        "group relative grid h-10 w-full items-center border-b border-border-subtle px-3 text-xs transition-colors duration-100 cursor-pointer select-none",
        "grid-cols-[16px_auto_1fr_auto_90px_60px_60px] gap-3",
        selected ? "bg-surface-2/80" : "bg-surface-1 hover:bg-surface-2/50",
        className
      )}
    >
      {/* 2px Escalating Left Indicator Bar */}
      {escalating && (
        <span
          data-slot="escalating-indicator"
          className="absolute inset-y-0 left-0 w-0.5 bg-escalating"
        />
      )}

      {/* Checkbox: Fixed 16x16px size for 0px layout shift */}
      <div
        className="flex items-center justify-center size-4 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(val) => onSelectChange?.(Boolean(val))}
        />
      </div>

      {/* Status Badge slot */}
      {statusBadge ? (
        <div className="shrink-0 flex items-center">{statusBadge}</div>
      ) : (
        <div className="size-2 shrink-0 rounded-full bg-border-strong" />
      )}

      {/* Main title + subtitle slot */}
      <div className="min-w-0 flex items-baseline gap-2 truncate">
        <span
          className={cn(
            "truncate",
            escalating
              ? "font-semibold text-fg-primary"
              : "font-normal text-fg-primary"
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="truncate font-mono text-[11px] text-fg-muted">
            {subtitle}
          </span>
        )}
      </div>

      {/* Sparkline / telemetry visualization */}
      <div className="shrink-0 flex items-center justify-end">
        {sparkline}
      </div>

      {/* Events Count (tabular-nums) */}
      <div className="text-right font-mono text-[11px] tabular-nums text-fg-secondary">
        {eventsCount !== undefined ? (
          <span title="Total events">{eventsCount}</span>
        ) : null}
      </div>

      {/* Users Count (tabular-nums) */}
      <div className="text-right font-mono text-[11px] tabular-nums text-fg-muted">
        {usersCount !== undefined ? (
          <span title="Impacted users">{usersCount}</span>
        ) : null}
      </div>

      {/* Time Ago or Actions */}
      <div className="text-right font-mono text-[11px] tabular-nums text-fg-muted truncate">
        {actions || timeAgo}
      </div>
    </div>
  );
}
