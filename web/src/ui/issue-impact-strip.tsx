import type { LucideIcon } from "lucide-react";
import { Activity, Clock, History, ShieldCheck, Tag, Users } from "lucide-react";
import type { IssueSummary, IssueTimeline } from "../lib/api";
import { formatCompactCount } from "../lib/format-count";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";
import {
  TIMELINE_WINDOW_OPTIONS,
  type TimelineWindowValue,
} from "./issue-occurrence-timeline";
import { getTimeWindowShortLabel } from "@/lib/time-window";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Sparkline, fillSparklineWindow } from "./sparkline";

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

function buildMetrics(issue: IssueSummary): MetricSpec[] {
  const absorbedEstimate = Math.max(0, issue.event_count * 12);
  const releaseSub = issue.came_back
    ? "Regressed"
    : issue.status === "regression"
      ? "Came back"
      : "Introduced";

  return [
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
}

/** Legacy 6-cell grid — kept for previews / compact embeds outside the redesigned drawer. */
export function IssueImpactMetrics({ issue, className }: IssueImpactMetricsProps) {
  const metrics = buildMetrics(issue);
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

export interface IssueImpactLineProps {
  issue: IssueSummary;
  timeline?: IssueTimeline | null;
  timelineLoading?: boolean;
  timelineWindow?: TimelineWindowValue;
  onTimelineWindowChange?: (window: TimelineWindowValue) => void;
  className?: string;
}

function ImpactStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-2.5 py-1.5 sm:px-3 sm:py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums leading-tight text-fg-primary [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

/** Compact blast-radius stats for the issue detail header (chart lives in Context). */
export function IssueImpactLine({
  issue,
  className,
}: Pick<IssueImpactLineProps, "issue" | "className">) {
  const eventsLabel = formatCompactCount(issue.event_count);
  const usersCount =
    issue.affected_users_count != null && issue.affected_users_count > 0
      ? issue.affected_users_count
      : issue.unique_user_count;
  const usersLabel = usersCount > 0 ? formatCompactCount(usersCount) : "0";
  const first = formatFirstSeen(issue.first_seen_at);
  const last = issue.last_seen_at ? formatRelativeTime(issue.last_seen_at) : "—";

  return (
    <div
      className={cn(
        "grid grid-cols-4 divide-x divide-border-subtle overflow-hidden rounded-md border border-border-subtle bg-surface-1 shadow-xs",
        className,
      )}
      aria-label="Issue impact"
    >
      <ImpactStat label="Events" value={eventsLabel} />
      <ImpactStat label="Affected users" value={usersLabel} />
      <ImpactStat label="First seen" value={first} />
      <ImpactStat label="Last seen" value={last} />
    </div>
  );
}

export interface IssueOccurrenceTrendProps {
  timeline?: IssueTimeline | null;
  timelineLoading?: boolean;
  timelineWindow?: TimelineWindowValue;
  onTimelineWindowChange?: (window: TimelineWindowValue) => void;
  className?: string;
}

/** Prominent Sparkline + discreet window chip — first block of the Context tab. */
export function IssueOccurrenceTrend({
  timeline,
  timelineLoading,
  timelineWindow = "7d",
  onTimelineWindowChange,
  className,
}: IssueOccurrenceTrendProps) {
  // Full window grid painted with real bucket counts (quiet slots = 0).
  const points = fillSparklineWindow(timeline?.buckets ?? [], timelineWindow);
  const hasAnyEvents = points.some((point) => point.value > 0);
  const showChart = !timelineLoading && Boolean(timeline);

  return (
    <div className={cn("min-w-0 space-y-1.5", className)} aria-label="Occurrence trend">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">
          Occurrences
        </p>
        {onTimelineWindowChange ? (
          <Select
            value={timelineWindow}
            onValueChange={(value) => onTimelineWindowChange(value as TimelineWindowValue)}
          >
            <SelectTrigger
              size="sm"
              className="h-6 min-h-6 w-auto min-w-0 gap-0.5 border-transparent bg-transparent px-1.5 font-mono text-[10px] tabular-nums text-fg-muted shadow-none hover:bg-surface-2 hover:text-fg-secondary"
              aria-label="Timeline window"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <SelectValue>{getTimeWindowShortLabel(timelineWindow)}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {TIMELINE_WINDOW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  <span className="font-mono text-[10px] tabular-nums text-fg-muted">
                    {getTimeWindowShortLabel(option.value)}
                  </span>
                  <span className="ml-2">{option.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {timelineLoading ? (
        <p className="py-6 text-center text-xs text-fg-muted">Loading timeline…</p>
      ) : showChart ? (
        <div className="min-w-0 overflow-hidden rounded-md border border-border-subtle bg-surface-1 px-3 py-3 shadow-xs">
          <Sparkline
            points={points}
            prominent
            scaleToExtent={hasAnyEvents}
            xAxis={timelineWindow === "24h" ? "hours" : "days"}
            className="w-full min-w-0"
          />
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-fg-muted">
          Not enough data for a trend in this window.
        </p>
      )}
    </div>
  );
}
