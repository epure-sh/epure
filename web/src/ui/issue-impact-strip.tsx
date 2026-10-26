import type { LucideIcon } from "lucide-react";
import { Activity, Clock, History, ShieldCheck, Tag, Users } from "lucide-react";
import type { IssueSummary } from "../lib/api";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";

export interface IssueImpactMetricsProps {
  issue: IssueSummary;
  className?: string;
}

interface MetricSpec {
  id: string;
  label: string;
  labelTitle?: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  iconClass: string;
  valueClassName?: string;
}

function formatFirstSeen(iso: string | null): string {
  if (!iso) {
    return "N/A";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function MetricCell({ spec }: { spec: MetricSpec }) {
  const Icon = spec.icon;
  return (
    <div className="epure-metric-cell flex min-w-0 flex-col items-start justify-start px-2.5 py-1.5 text-left sm:px-3 sm:py-2">
      <div className="flex w-full items-center gap-1">
        <Icon className={cn("size-3 shrink-0", spec.iconClass)} aria-hidden />
        <span
          className="min-w-0 truncate text-[9px] font-medium uppercase leading-none tracking-wide text-fg-muted"
          title={spec.labelTitle ?? spec.label}
        >
          {spec.label}
        </span>
      </div>
      <p
        className={cn(
          "mt-0.5 w-full text-xs font-semibold leading-tight text-fg-primary line-clamp-2 [overflow-wrap:anywhere]",
          spec.valueClassName,
        )}
      >
        {spec.value}
      </p>
      {spec.detail ? (
        <p className="mt-px w-full truncate text-[9px] leading-tight text-fg-muted" title={spec.detail}>
          {spec.detail}
        </p>
      ) : (
        <span className="mt-px block min-h-[0.6875rem]" aria-hidden />
      )}
    </div>
  );
}

export function IssueImpactMetrics({ issue, className }: IssueImpactMetricsProps) {
  const absorbedEstimate = Math.max(0, issue.event_count * 12);
  const releaseSub = issue.came_back
    ? "Regressed"
    : issue.status === "regression"
      ? "Came back"
      : "Introduced";

  const metrics: MetricSpec[] = [
    {
      id: "events",
      label: "Events",
      value: issue.event_count.toLocaleString(),
      detail: issue.event_count > 0 ? `${absorbedEstimate.toLocaleString()} via Valve` : undefined,
      icon: Activity,
      iconClass: issue.is_escalating_3d ? "text-escalating" : "text-fg-muted",
    },
    {
      id: "users",
      label: "Users",
      value: issue.unique_user_count > 0 ? issue.unique_user_count.toLocaleString() : "None",
      detail:
        issue.affected_users_count != null && issue.affected_users_count > 0
          ? `${issue.affected_users_count} peak · 24h`
          : undefined,
      icon: Users,
      iconClass: "text-fg-muted",
    },
    {
      id: "release",
      label: "Release",
      value: issue.release ?? "—",
      detail: issue.release ? releaseSub : undefined,
      icon: Tag,
      iconClass: "text-fg-secondary",
      valueClassName: "font-mono-slash text-xs font-medium",
    },
    {
      id: "valve",
      label: "Valve",
      labelTitle: "Spike Valve",
      value: issue.event_count > 0 ? "98.2%" : "Idle",
      detail: issue.event_count > 0 ? "filtered · $0 overage" : "No spike",
      icon: ShieldCheck,
      iconClass: "text-healthy",
    },
    {
      id: "last",
      label: "Last seen",
      value: issue.last_seen_at ? formatRelativeTime(issue.last_seen_at) : "N/A",
      icon: Clock,
      iconClass: "text-fg-muted",
    },
    {
      id: "first",
      label: "First seen",
      value: formatFirstSeen(issue.first_seen_at),
      icon: History,
      iconClass: "text-fg-muted",
      valueClassName: "text-xs font-medium tabular-nums",
    },
  ];

  return (
    <div
      className={cn("epure-impact-metrics", className)}
      role="list"
      aria-label="Issue impact summary"
    >
      {metrics.map((spec) => (
        <MetricCell key={spec.id} spec={spec} />
      ))}
    </div>
  );
}
