import type { ReactNode } from "react";
import type { IssueSummary } from "../lib/api";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";

export interface IssueImpactMetricsProps {
  issue: IssueSummary;
  className?: string;
}

export function IssueImpactMetrics({ issue, className }: IssueImpactMetricsProps) {
  const parts: ReactNode[] = [
    <span key="events" className="font-mono-slash tabular-nums font-medium text-ink">
      {issue.event_count.toLocaleString()} events
    </span>,
  ];

  if (issue.unique_user_count >= 1) {
    parts.push(
      <span key="users" className="font-mono-slash tabular-nums font-medium text-ink">
        {issue.unique_user_count.toLocaleString()} users
      </span>,
    );
  }

  if (issue.last_seen_at) {
    parts.push(
      <span key="last" className="text-ink-muted">
        last {formatRelativeTime(issue.last_seen_at)}
      </span>,
    );
  }

  return (
    <p
      className={cn(
        "epure-impact-metrics flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm",
        className,
      )}
    >
      {parts.map((part, index) => (
        <span key={index} className="inline-flex items-baseline gap-2">
          {index > 0 ? <span className="text-ink-muted" aria-hidden>·</span> : null}
          {part}
        </span>
      ))}
    </p>
  );
}
