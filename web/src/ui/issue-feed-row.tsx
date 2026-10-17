import { type HTMLAttributes, type ReactNode } from "react";
import type { TimelineBucket } from "../lib/api";
import { cn } from "../lib/cn";
import { formatCompactCount } from "../lib/format-count";
import { formatAge, formatRelativeTime } from "../lib/format-time";
import { getIssueRowVariant, useStyleTheme } from "../lib/style-theme";
import { Badge } from "./badge";
import {
  FEED_CELL_CHECKBOX,
  FEED_CELL_ISSUE,
  FEED_CELL_NUMERIC,
  FEED_CELL_PRIORITY,
  FEED_CELL_TEXT,
  FEED_CELL_TREND,
  FEED_GRID_COMPACT,
  FEED_GRID_FULL,
} from "./issue-feed-layout";
import { IssuePriorityIcon } from "./issue-priority";
import { OccurrenceLineChart } from "./occurrence-line-chart";
import type { TrendStatus } from "./sparkline";

export interface IssueFeedRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  shortTitle: string;
  subtitle?: string | null;
  lastSeen?: string;
  firstSeen?: string;
  eventCount?: number;
  userCount?: number;
  level?: string;
  status?: string;
  projectCode?: string;
  platform?: string;
  location?: string | null;
  trendBuckets?: TimelineBucket[];
  trendStatus?: TrendStatus;
  regression?: boolean;
  unhandled?: boolean;
  snoozed?: boolean;
  selected?: boolean;
  bulkSelected?: boolean;
  unread?: boolean;
  compact?: boolean;
  checkbox?: ReactNode;
}

const TREND_STATUS_LABEL: Record<TrendStatus, string> = {
  ongoing: "Ongoing",
  escalating: "Escalating",
  declining: "Declining",
};

function PlatformBadge({ label }: { label: string }) {
  return (
    <span
      className="epure-platform-badge inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-bg-subtle px-1 font-mono text-2xs font-medium uppercase text-ink-muted"
      aria-hidden
    >
      {label}
    </span>
  );
}

export function IssueFeedRow({
  shortTitle,
  subtitle,
  lastSeen,
  firstSeen,
  eventCount,
  userCount,
  level,
  status,
  projectCode,
  platform,
  location,
  trendBuckets = [],
  trendStatus = "ongoing",
  regression = false,
  unhandled = false,
  snoozed = false,
  selected = false,
  bulkSelected = false,
  unread = false,
  compact = false,
  checkbox,
  className,
  onClick,
  onKeyDown,
  ...props
}: IssueFeedRowProps) {
  const rowVariant = getIssueRowVariant(useStyleTheme());
  const statusIndicator = unhandled ? (
    <span
      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.65)] ring-[3px] ring-rose-500/25 animate-pulse"
      title="Fatal unhandled crash"
      aria-hidden
    />
  ) : unread ? (
    <span
      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.55)] ring-[3px] ring-sky-500/25"
      title="Unread issue"
      aria-hidden
    />
  ) : (
    <span
      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted/30"
      title="Viewed issue"
      aria-hidden
    />
  );

  const rowClass = selected
    ? "bg-accent-muted/50 dark:bg-accent-muted/30 border-l-[3px] border-l-accent shadow-xs"
    : bulkSelected
      ? "bg-accent-muted/30 hover:bg-state-hover border-l-[3px] border-l-accent/50"
      : "hover:bg-state-hover border-l-[3px] border-l-transparent";

  const keyHandler = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
    }
    onKeyDown?.(event);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={keyHandler}
      className={cn(
        "epure-issue-row epure-feed-row grid items-center border-b border-border/80 text-left transition-colors duration-fast focus-ring",
        `epure-issue-row--${rowVariant}`,
        unread && "epure-issue-row--unread",
        compact ? FEED_GRID_COMPACT : FEED_GRID_FULL,
        rowClass,
        className,
      )}
      {...props}
    >
      <div
        className={cn("hidden lg:flex", FEED_CELL_CHECKBOX)}
        onClick={(event) => event.stopPropagation()}
      >
        {checkbox}
      </div>

      <div className={FEED_CELL_ISSUE}>
        <div className="flex min-w-0 items-start gap-2">
          {statusIndicator}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="epure-issue-row-title truncate text-sm font-semibold leading-tight tracking-ui text-ink"
              >
                {shortTitle}
              </span>
              {regression ? (
                <Badge variant="warning" size="compact" className="shrink-0 font-medium">
                  Came back
                </Badge>
              ) : null}
              {snoozed ? (
                <Badge variant="info" size="compact" className="shrink-0 font-medium">
                  Snoozed
                </Badge>
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs leading-tight text-ink-muted">{subtitle}</p>
            ) : null}
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-ink-muted">
              {platform ? <PlatformBadge label={platform} /> : null}
              {projectCode ? (
                <span className="font-mono text-2xs font-medium text-ink-subtle">{projectCode}</span>
              ) : null}
              {location ? (
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-bg-subtle text-ink-muted border border-border/60 truncate max-w-sm">
                  {location}
                </span>
              ) : null}
              {unhandled ? (
                <span className="rounded bg-signal-muted px-1.5 py-0.2 font-mono text-[10px] font-semibold uppercase text-signal">
                  Unhandled
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {lastSeen ? (
        <span className={cn("hidden text-xs leading-tight text-ink-muted lg:block", FEED_CELL_TEXT)}>
          {formatRelativeTime(lastSeen)}
        </span>
      ) : (
        <span className={cn("hidden lg:block", FEED_CELL_TEXT)} />
      )}

      {!compact && firstSeen ? (
        <span className={cn("hidden text-xs leading-tight text-ink-muted xl:block", FEED_CELL_TEXT)}>
          {formatAge(firstSeen)}
        </span>
      ) : !compact ? (
        <span className={cn("hidden xl:block", FEED_CELL_TEXT)} />
      ) : null}

      {!compact && trendBuckets.length > 0 ? (
        <div className={cn("hidden lg:block", FEED_CELL_TREND)}>
          <OccurrenceLineChart
            buckets={trendBuckets}
            label="Errors · 30 days"
            height={24}
            interactive={false}
            emphasizeVariation
          />
          <span
            className={cn(
              "mt-0 block text-2xs leading-none",
              trendStatus === "escalating" ? "text-semantic-danger" : "text-ink-muted",
            )}
          >
            {TREND_STATUS_LABEL[trendStatus]}
          </span>
        </div>
      ) : !compact ? (
        <span className={cn("hidden lg:block", FEED_CELL_TREND)} />
      ) : null}

      {eventCount !== undefined ? (
        <span className={cn(FEED_CELL_NUMERIC, "font-mono-slash text-xs leading-tight tabular-nums text-ink")}>
          {formatCompactCount(eventCount)}
        </span>
      ) : (
        <span className={FEED_CELL_NUMERIC} />
      )}

      {!compact && userCount !== undefined ? (
        <span
          className={cn(
            "hidden font-mono-slash text-xs leading-tight tabular-nums text-ink-muted xl:block",
            FEED_CELL_NUMERIC,
          )}
        >
          {formatCompactCount(userCount)}
        </span>
      ) : !compact ? (
        <span className={cn("hidden xl:block", FEED_CELL_NUMERIC)} />
      ) : null}

      {!compact ? (
        <div className={cn("hidden xl:flex", FEED_CELL_PRIORITY)} title={level ?? undefined}>
          <IssuePriorityIcon level={level} status={status} size={14} />
        </div>
      ) : null}
    </div>
  );
}
