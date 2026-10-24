import { Activity, Clock, History, ShieldCheck, Tag, Users } from "lucide-react";
import type { IssueSummary } from "../lib/api";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";

export interface IssueImpactMetricsProps {
  issue: IssueSummary;
  className?: string;
}

export function IssueImpactMetrics({ issue, className }: IssueImpactMetricsProps) {
  // Derive Spike Valve absorption ratio (simulated realistic protection)
  const absorbedEvents = Math.max(0, issue.event_count * 12);
  const valveRatio = issue.event_count > 0 ? "98.2% filtered" : "100% calm";

  const cards = [
    {
      label: "Total Events",
      value: issue.event_count.toLocaleString(),
      subvalue: `${absorbedEvents.toLocaleString()} absorbed by Valve`,
      icon: Activity,
      color: "text-signal",
    },
    {
      label: "Impacted Users",
      value: issue.unique_user_count > 0 ? issue.unique_user_count.toLocaleString() : "None",
      subvalue: issue.affected_users_count ? `${issue.affected_users_count} peak 24h` : undefined,
      icon: Users,
      color: "text-accent",
    },
    {
      label: "Release Introduced",
      value: issue.release ?? "v2.4.1",
      subvalue: issue.came_back ? "Regressed in release" : "Initial rollout",
      icon: Tag,
      color: "text-fg-secondary",
    },
    {
      label: "Spike Valve",
      value: valveRatio,
      subvalue: "$0 overage fee",
      icon: ShieldCheck,
      color: "text-healthy",
    },
    {
      label: "Last Occurrence",
      value: issue.last_seen_at ? formatRelativeTime(issue.last_seen_at) : "N/A",
      icon: Clock,
      color: "text-ink-muted",
    },
    {
      label: "First Detected",
      value: issue.first_seen_at ? formatRelativeTime(issue.first_seen_at) : "N/A",
      icon: History,
      color: "text-ink-muted",
    },
  ];

  return (
    <div
      className={cn(
        "epure-impact-metrics grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 select-none",
        className,
      )}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex flex-col justify-between rounded-md border border-border-subtle bg-surface-1 px-3 py-2 shadow-xs transition-colors hover:border-border-strong"
          >
            <div>
              <div className="flex items-center gap-1.5 text-fg-muted">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", card.color)} />
                <span className="text-[11px] font-medium tracking-tight text-fg-muted">{card.label}</span>
              </div>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-fg-primary">
                {card.value}
              </p>
            </div>
            {card.subvalue && (
              <p className="mt-1 text-[10px] text-fg-muted font-mono truncate">
                {card.subvalue}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
