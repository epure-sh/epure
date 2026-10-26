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
    <Badge
      variant="env"
      size="compact"
      className="epure-platform-badge min-w-4 font-mono uppercase"
      aria-hidden
    >
      {label}
    </Badge>
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
  const isEscalating = trendStatus === "escalating";
  const statusIndicator = unhandled ? (
    <span
      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-escalating shadow-[0_0_8px_rgba(244,63,94,0.65)] ring-[3px] ring-escalating/25 animate-pulse"
      title="Fatal unhandled crash"
      aria-hidden
    />
  ) : unread ? (
    <span
      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-info shadow-[0_0_8px_rgba(56,189,248,0.55)] ring-[3px] ring-info/25"
      title="Unread issue"
      aria-hidden
    />
  ) : (
    <span
      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fg-muted/30"
      title="Viewed issue"
      aria-hidden
    />
  );

  const rowClass = selected
    ? "bg-surface-2/80 border-l-[3px] border-l-primary shadow-tactile"
    : bulkSelected
      ? "bg-surface-2/40 hover:bg-surface-2/70 border-l-[3px] border-l-primary/50"
      : "hover:bg-surface-2/50 border-l-[3px] border-l-transparent";

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
        "epure-issue-row epure-feed-row relative grid items-center border-b border-border-subtle text-left transition-colors duration-fast focus-ring select-none cursor-pointer",
        `epure-issue-row--${rowVariant}`,
        unread && "epure-issue-row--unread",
        compact ? FEED_GRID_COMPACT : FEED_GRID_FULL,
        rowClass,
        className,
      )}
      {...props}
    >
      {/* 2px Escalating Left Indicator Bar */}
      {isEscalating && (
        <span
          data-slot="escalating-indicator"
          className="absolute inset-y-0 left-0 w-0.5 bg-escalating"
        />
      )}

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
                className={cn(
                  "epure-issue-row-title truncate text-xs leading-tight tracking-ui",
                  isEscalating ? "font-semibold text-fg-primary" : "text-fg-primary"
                )}
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
              <p className="mt-0.5 truncate text-xs leading-tight text-fg-muted">{subtitle}</p>
            ) : null}
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-fg-muted">
              {platform ? <PlatformBadge label={platform} /> : null}
              {projectCode ? (
                <span className="font-mono text-2xs font-medium text-fg-muted">{projectCode}</span>
              ) : null}
              {location ? (
                <Badge variant="neutral" size="compact" className="max-w-sm truncate font-mono">
                  {location}
                </Badge>
              ) : null}
              {unhandled ? (
                <Badge variant="escalating" size="compact" className="font-mono font-semibold uppercase">
                  Unhandled
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {lastSeen ? (
        <span className={cn("hidden text-xs leading-tight text-fg-muted lg:block", FEED_CELL_TEXT)}>
          {formatRelativeTime(lastSeen)}
        </span>
      ) : (
        <span className={cn("hidden lg:block", FEED_CELL_TEXT)} />
      )}

      {!compact && firstSeen ? (
        <span className={cn("hidden text-xs leading-tight text-fg-muted xl:block", FEED_CELL_TEXT)}>
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
              trendStatus === "escalating" ? "text-escalating font-semibold" : "text-fg-muted",
            )}
          >
            {TREND_STATUS_LABEL[trendStatus]}
          </span>
        </div>
      ) : !compact ? (
        <span className={cn("hidden lg:block", FEED_CELL_TREND)} />
      ) : null}

      {eventCount !== undefined ? (
        <span className={cn(FEED_CELL_NUMERIC, "font-mono-slash text-xs leading-tight tabular-nums text-fg-primary")}>
          {formatCompactCount(eventCount)}
        </span>
      ) : (
        <span className={FEED_CELL_NUMERIC} />
      )}

      {!compact && userCount !== undefined ? (
        <span
          className={cn(
            "hidden font-mono-slash text-xs leading-tight tabular-nums text-fg-muted xl:block",
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
