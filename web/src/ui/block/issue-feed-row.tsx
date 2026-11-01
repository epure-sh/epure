// web/src/ui/block/issue-feed-row.tsx
// Tier 3 Block: Consolidated Issue Feed Row
// Parameterized by variant="grid" | "compact" | "mobile" | "airy"
// Drop-in backward-compatible wrappers for IssueRowShell and IssueRow.

import * as React from "react";
import type { IssueSummary, TimelineBucket } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCompactCount } from "@/lib/format-count";
import { formatRelativeTime } from "@/lib/format-time";
import { Checkbox } from "../primitives/elements/checkbox";
import { Badge } from "../primitives/elements/badge";
import {
  IssuePriorityIcon,
  IssuePriorityBadge,
  resolveIssuePriority,
  type IssuePriority,
} from "../components/issue-priority";
import { InboxUnreadRail } from "@/components/kit/inbox-read-cue";
import { inferTrendStatus, type TrendStatus } from "../components/sparkline";

// ---------------------------------------------------------------------------
// Shared Grid & Layout Constants (Exact 1:1 synchronization with column header)
// ---------------------------------------------------------------------------

/** checkbox · issue · events · users · last seen · priority · actions */
export const ISSUE_ROW_GRID =
  "grid-cols-[16px_minmax(0,1fr)_4.5rem_4rem_5.25rem_4rem_2rem] gap-x-3";

export const ISSUE_FEED_ROW_HEIGHT_CLASS =
  "h-[4.625rem] max-h-[4.625rem] min-h-[4.625rem] overflow-hidden";

export const FEED_GRID_FULL =
  "grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_3rem_7.5rem_3.25rem_3.25rem_2.75rem_2.5rem]";

export const FEED_GRID_COMPACT = "grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_3.25rem]";

export const FEED_CELL_CHECKBOX = "flex items-center justify-center px-1.5 py-1.5";
export const FEED_CELL_ISSUE = "min-w-0 px-3 py-1.5 lg:px-4";
export const FEED_CELL_TEXT = "px-2 py-1.5";
export const FEED_CELL_TREND = "min-w-0 px-2 py-1.5";
export const FEED_CELL_NUMERIC = "px-2 py-1.5 text-right";
export const FEED_CELL_PRIORITY = "flex items-center justify-center px-2 py-1.5";
export const FEED_HEADER_CELL = "flex h-auto items-center border-r border-border py-2";

// ---------------------------------------------------------------------------
// Types & Contracts
// ---------------------------------------------------------------------------

export type IssueFeedRowVariant = "grid" | "compact" | "mobile" | "airy";
export type IssueRowPriority = IssuePriority;

export interface IssueFeedRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Visual layout presentation mode (default: "grid") */
  variant?: IssueFeedRowVariant;

  /** Unique issue identifier */
  id?: string;

  /** Primary issue title */
  title?: React.ReactNode;
  /** Backwards-compatibility alias for title */
  shortTitle?: string;

  /** Secondary issue subtitle or location */
  subtitle?: React.ReactNode;
  /** Backwards-compatibility aliases for subtitle */
  culprit?: string | null;
  location?: string | null;

  /** Platform identifier (e.g. "js", "python", "node") */
  platform?: string;
  /** Project code (e.g. "PROJ") */
  projectCode?: string;
  /** Environment tag (e.g. "production", "staging") */
  environment?: string;
  /** Release version string */
  release?: string;

  /** Timestamps */
  lastSeen?: string;
  timeAgo?: string;
  firstSeen?: string;
  age?: string;

  /** Telemetry & Counts */
  eventCount?: number | string;
  eventsCount?: number | string;
  userCount?: number | string;
  usersCount?: number | string;

  /** Domain model */
  issue?: IssueSummary | null;

  /** Sparkline & Trend data */
  trendBuckets?: TimelineBucket[];
  trendValues?: number[];
  trendSeries?: number[];
  trendStatus?: TrendStatus;

  /** State flags */
  unread?: boolean;
  selected?: boolean;
  detailActive?: boolean;
  bulkSelected?: boolean;
  selectionActive?: boolean;
  focused?: boolean;
  tourAnchor?: boolean;
  regression?: boolean;
  snoozed?: boolean;
  unhandled?: boolean;
  escalating?: boolean;
  compact?: boolean; // legacy alias for variant="compact"

  /** Severity & Priority */
  level?: string;
  status?: string;
  priority?: IssueRowPriority;

  /** Custom Slots */
  checkbox?: React.ReactNode;
  lifecycle?: React.ReactNode;
  rowActions?: React.ReactNode;

  /** Event Handlers */
  onSelectChange?: (selected: boolean) => void;
  onActivate?: () => void;
}

export interface IssueRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  lastSeen?: string;
  eventCount?: number;
  userCount?: number;
  level?: string;
  environment?: string;
  release?: string;
  regression?: boolean;
  snoozed?: boolean;
  unread?: boolean;
  selected?: boolean;
  bulkSelected?: boolean;
}

export interface IssueRowShellProps {
  id: string;
  bulkSelected?: boolean;
  focused?: boolean;
  detailActive?: boolean;
  onSelectChange?: (selected: boolean) => void;
  escalating?: boolean;
  priority?: IssueRowPriority;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  lifecycle?: React.ReactNode;
  eventsCount?: number | string;
  usersCount?: number | string;
  timeAgo?: string;
  age?: string;
  rowActions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  tourAnchor?: boolean;
  unread?: boolean;
  selectionActive?: boolean;
  unhandled?: boolean;
  regression?: boolean;
  snoozed?: boolean;
}

// ---------------------------------------------------------------------------
// Main Consolidated Component: IssueFeedRow
// ---------------------------------------------------------------------------

export const IssueFeedRow = React.forwardRef<HTMLDivElement, IssueFeedRowProps>(
  function IssueFeedRow(
    {
      issue,
      variant: variantProp,
      compact = false,
      id,
      title,
      shortTitle,
      subtitle,
      culprit,
      location,
      platform,
      projectCode,
      environment,
      release,
      lastSeen,
      timeAgo,
      firstSeen,
      age,
      eventCount,
      eventsCount,
      userCount,
      usersCount,
      trendBuckets = [],
      trendValues,
      trendSeries: trendSeriesProp,
      trendStatus: trendStatusProp,
      unread = false,
      selected = false,
      detailActive = false,
      bulkSelected = false,
      focused = false,
      tourAnchor = false,
      regression = false,
      snoozed = false,
      unhandled = false,
      escalating = false,
      level,
      status,
      priority,
      checkbox,
      lifecycle,
      rowActions,
      onSelectChange,
      onActivate,
      onClick,
      onKeyDown,
      className,
      ...props
    },
    ref,
  ) {
    // Resolve variant (compact prop acts as backwards-compatible fallback)
    const variant: IssueFeedRowVariant = variantProp ?? (compact ? "compact" : "grid");

    // Normalize titles & subtitles
    const displayTitle = title ?? shortTitle ?? issue?.title ?? "Untitled Issue";
    const displaySubtitle = subtitle ?? culprit ?? location ?? issue?.culprit ?? null;

    // Normalize selection & focus
    const isSelected = selected || detailActive;
    const isBulkSelected = bulkSelected;

    // Normalize timestamps
    const resolvedLastSeen = lastSeen ?? issue?.last_seen_at ?? null;
    const formattedLastSeen = resolvedLastSeen ? formatRelativeTime(resolvedLastSeen) : undefined;
    const displayTimeAgo = timeAgo ?? (formattedLastSeen === "-" ? "—" : formattedLastSeen);

    // Normalize counts
    const resolvedEventCount = eventsCount ?? eventCount ?? issue?.event_count;
    const displayEvents =
      typeof resolvedEventCount === "number"
        ? formatCompactCount(resolvedEventCount)
        : (resolvedEventCount ?? "-");

    const resolvedUserCount = usersCount ?? userCount ?? issue?.unique_user_count;
    const displayUsers =
      typeof resolvedUserCount === "number"
        ? formatCompactCount(resolvedUserCount)
        : (resolvedUserCount ?? "-");

    // Trend & Escalating status
    const trendSeries = trendValues ?? trendSeriesProp ?? trendBuckets.map((b) => b.count);
    const resolvedTrendStatus = trendStatusProp ?? inferTrendStatus(trendSeries);
    const resolvedLevel = level ?? issue?.level ?? null;
    const resolvedStatus = status ?? issue?.status ?? null;
    const isEscalating = Boolean(
      escalating || resolvedTrendStatus === "escalating" || resolvedStatus === "regression",
    );

    // Priority resolution — prefer explicit prop, else score/level/status (escalating bumps to critical)
    const resolvedPriority: IssuePriority =
      priority ??
      (isEscalating
        ? "critical"
        : resolveIssuePriority(resolvedLevel, resolvedStatus, issue ?? undefined));

    // Keyboard navigation handler
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate?.();
        onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
      }
      onKeyDown?.(event);
    };

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
      onActivate?.();
      onClick?.(event);
    };

    // -----------------------------------------------------------------------
    // Variant: Mobile (Stacked Touch View)
    // -----------------------------------------------------------------------
    if (variant === "mobile") {
      return (
        <div
          ref={ref}
          role="button"
          tabIndex={0}
          data-slot="issue-feed-row"
          data-variant="mobile"
          data-issue-id={id}
          data-unread={unread ? true : undefined}
          data-selected={isSelected ? true : undefined}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            "group relative flex w-full flex-col gap-1.5 border-b border-border-subtle p-3.5 sm:p-4 text-left transition-all duration-100 select-none cursor-pointer focus-ring touch-manipulation active:scale-[0.99]",
          isSelected ? "bg-state-selected" : "hover:bg-state-hover",
            unread && "epure-issue-row--unread",
            className,
          )}
          {...props}
        >
          <InboxUnreadRail unread={unread} />
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              {unread ? (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "line-clamp-2 text-sm leading-snug tracking-ui",
                      unread ? "font-semibold text-fg-primary" : "font-medium text-fg-secondary",
                    )}
                  >
                    {displayTitle}
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
              </div>
            </div>
            {displayTimeAgo ? (
              <span className="shrink-0 pt-0.5 font-mono text-2xs tabular-nums text-fg-muted">
                {displayTimeAgo}
              </span>
            ) : null}
          </div>

          {displaySubtitle ? (
            <p className="truncate font-mono text-xs text-fg-muted">{displaySubtitle}</p>
          ) : null}

          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-fg-muted">
            {resolvedEventCount !== undefined ? (
              <span className="font-mono tabular-nums">{displayEvents} events</span>
            ) : null}
            {resolvedUserCount !== undefined ? (
              <span className="font-mono tabular-nums">· {displayUsers} users</span>
            ) : null}
            {platform ? (
              <Badge variant="env" size="compact" className="font-mono uppercase">
                {platform}
              </Badge>
            ) : null}
            {environment ? <span>· {environment}</span> : null}
            {release ? <span>· {release}</span> : null}
            <IssuePriorityBadge level={level} status={status} priority={resolvedPriority} compact />
          </div>
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // Variant: Airy (Card-like breathing container)
    // -----------------------------------------------------------------------
    if (variant === "airy") {
      return (
        <div
          ref={ref}
          role="button"
          tabIndex={0}
          data-slot="issue-feed-row"
          data-variant="airy"
          data-issue-id={id}
          data-unread={unread ? true : undefined}
          data-selected={isSelected ? true : undefined}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-surface-1 p-3.5 my-1.5 shadow-xs transition-all duration-150 text-left select-none cursor-pointer focus-ring hover:border-border-strong hover:bg-surface-2/40 hover:shadow-tactile active:scale-[0.99]",
            isSelected && "bg-state-selected",
            className,
          )}
          {...props}
        >
          <InboxUnreadRail unread={unread} />
          <div
            className="flex size-4 shrink-0 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {checkbox ?? (
              <Checkbox
                checked={isBulkSelected}
                onCheckedChange={(val) => onSelectChange?.(Boolean(val))}
                aria-label={isBulkSelected ? "Deselect issue" : "Select issue"}
              />
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "truncate text-sm leading-tight tracking-ui",
                  unread ? "font-semibold text-fg-primary" : "font-medium text-fg-secondary",
                )}
              >
                {displayTitle}
              </span>
              {regression ? (
                <Badge variant="warning" size="compact">
                  Came back
                </Badge>
              ) : null}
              {snoozed ? (
                <Badge variant="info" size="compact">
                  Snoozed
                </Badge>
              ) : null}
            </div>
            {displaySubtitle ? (
              <p className="truncate font-mono text-xs text-fg-muted">{displaySubtitle}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3 text-right">
            <span className="font-mono text-xs tabular-nums text-fg-primary">{displayEvents}</span>
            <IssuePriorityIcon level={level} status={status} size={14} priority={resolvedPriority} />
            {rowActions ? <div onClick={(e) => e.stopPropagation()}>{rowActions}</div> : null}
          </div>
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // Variant: Compact (Dense 5-column grid)
    // -----------------------------------------------------------------------
    if (variant === "compact") {
      return (
        <div
          ref={ref}
          role="button"
          tabIndex={0}
          data-slot="issue-feed-row"
          data-variant="compact"
          data-issue-id={id}
          data-unread={unread ? true : undefined}
          data-selected={isSelected ? true : undefined}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            "group relative grid h-12 max-h-12 min-h-12 w-full items-center border-b border-border-subtle px-3 text-xs transition-colors duration-100 cursor-pointer select-none focus-ring",
            "grid-cols-[16px_minmax(0,1fr)_4.5rem_3.5rem_1.5rem] gap-x-2",
          isSelected
            ? "bg-state-selected"
            : isBulkSelected
              ? "bg-state-selected/70"
              : "hover:bg-state-hover",
          className,
        )}
        {...props}
      >
          <InboxUnreadRail unread={unread && !isSelected} />
          <div
            className="flex size-4 shrink-0 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {checkbox ?? (
              <Checkbox
                checked={isBulkSelected}
                onCheckedChange={(val) => onSelectChange?.(Boolean(val))}
                aria-label={isBulkSelected ? "Deselect issue" : "Select issue"}
              />
            )}
          </div>

          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden pr-2">
            <span
              className={cn(
                "truncate text-xs leading-tight tracking-ui",
                unread ? "font-semibold text-fg-primary" : "font-normal text-fg-secondary",
              )}
            >
              {displayTitle}
            </span>
            {displaySubtitle ? (
              <span className="truncate font-mono text-[11px] text-fg-muted">
                · {displaySubtitle}
              </span>
            ) : null}
          </div>

          <div className="text-right font-mono text-[11px] tabular-nums text-fg-muted">
            {displayTimeAgo ?? "-"}
          </div>
          <div className="text-right font-mono text-[11px] tabular-nums text-fg-primary">
            {displayEvents}
          </div>
          <div className="flex items-center justify-end">
            <IssuePriorityIcon level={level} status={status} size={14} priority={resolvedPriority} />
          </div>
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // Variant: Grid (Default locked desktop feed row, matching IssueRowShell)
    // -----------------------------------------------------------------------
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        data-slot={((props as Record<string, unknown>)["data-slot"] as string) ?? "issue-feed-row"}
        data-variant="grid"
        data-issue-id={id}
        data-escalating={isEscalating}
        data-focused={focused}
        data-detail-active={isSelected}
        data-priority={resolvedPriority}
        data-tour={tourAnchor ? "issue-row-sample" : undefined}
        data-inbox-unread={unread ? true : undefined}
        data-inbox-read={!unread ? true : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "epure-feed-row group relative grid w-full items-center border-b border-border-subtle px-3 text-xs transition-colors duration-100 cursor-pointer select-none focus-ring",
          ISSUE_FEED_ROW_HEIGHT_CLASS,
          ISSUE_ROW_GRID,
          isSelected
            ? "bg-state-selected"
            : isBulkSelected
              ? "bg-state-selected/70"
              : "hover:bg-state-hover",
          className,
        )}
        {...props}
      >
        {/* Unread rail only when not the open row — open issue is bg-only. */}
        <InboxUnreadRail unread={unread && !isSelected} />

        {/* Checkbox column - zero layout shift 16px track */}
        <div
          className="flex size-4 shrink-0 items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          {checkbox ?? (
            <Checkbox
              checked={isBulkSelected}
              onCheckedChange={(value) => onSelectChange?.(Boolean(value))}
              aria-label={isBulkSelected ? "Deselect issue" : "Select issue"}
            />
          )}
        </div>

        {/* Title & Metadata column */}
        <div className="flex min-h-0 min-w-0 items-center self-stretch overflow-hidden pr-2">
          <div className="flex min-w-0 flex-col justify-center gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "block truncate text-sm leading-tight tracking-ui transition-colors",
                  unread ? "font-semibold text-fg-primary" : "font-normal text-fg-secondary",
                  isEscalating && "font-semibold text-fg-primary",
                )}
              >
                {displayTitle}
              </span>
              {unread ? <span className="sr-only">Unread. </span> : null}
            </div>

            {displaySubtitle ? (
              <p
                className={cn(
                  "truncate font-mono text-[11px] leading-tight transition-colors",
                  unread ? "text-fg-muted" : "text-fg-muted/75",
                )}
              >
                {displaySubtitle}
              </p>
            ) : null}

            {lifecycle ||
            regression ||
            snoozed ||
            platform ||
            projectCode ||
            (location && !subtitle) ||
            unhandled ? (
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                {lifecycle}
                {!lifecycle && regression ? (
                  <Badge variant="warning" size="compact" className="shrink-0 font-medium">
                    Came back
                  </Badge>
                ) : null}
                {!lifecycle && snoozed ? (
                  <Badge variant="info" size="compact" className="shrink-0 font-medium">
                    Snoozed
                  </Badge>
                ) : null}
                {unhandled ? (
                  <Badge
                    variant="escalating"
                    size="compact"
                    className="shrink-0 font-mono font-semibold uppercase"
                  >
                    Unhandled
                  </Badge>
                ) : null}
                {platform ? (
                  <Badge variant="env" size="compact" className="font-mono uppercase">
                    {platform}
                  </Badge>
                ) : null}
                {projectCode ? (
                  <span className="font-mono text-2xs font-medium text-fg-muted">{projectCode}</span>
                ) : null}
                {location && !subtitle ? (
                  <Badge variant="neutral" size="compact" className="max-w-sm truncate font-mono">
                    {location}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Events */}
        <div className="flex items-center justify-end text-right font-mono text-[11px] tabular-nums text-fg-primary">
          {displayEvents}
        </div>

        {/* Users affected */}
        <div className="flex items-center justify-end text-right font-mono text-[11px] font-bold tabular-nums text-fg-primary">
          {displayUsers}
        </div>

        {/* Last seen */}
        <div className="flex items-center justify-end text-right font-mono text-[11px] tabular-nums text-fg-muted">
          {displayTimeAgo ?? "—"}
        </div>

        {/* Priority */}
        <div className="flex items-center justify-end">
          <IssuePriorityIcon
            level={level}
            status={status}
            size={16}
            priority={resolvedPriority}
          />
        </div>

        {/* Row Actions Slot */}
        <div className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
          {rowActions}
        </div>
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Backwards-Compatible Drop-In Wrappers
// ---------------------------------------------------------------------------

export function IssueRowShell(props: IssueRowShellProps) {
  return <IssueFeedRow variant="grid" data-slot="issue-row-shell" {...props} />;
}

export function IssueRow({
  title,
  lastSeen,
  eventCount,
  userCount,
  level,
  environment,
  release,
  regression,
  snoozed,
  unread,
  selected,
  bulkSelected,
  className,
  onClick,
  ...props
}: IssueRowProps) {
  return (
    <IssueFeedRow
      variant="mobile"
      title={title}
      lastSeen={lastSeen}
      eventCount={eventCount}
      userCount={userCount}
      level={level}
      environment={environment}
      release={release}
      regression={regression}
      snoozed={snoozed}
      unread={unread}
      selected={selected}
      bulkSelected={bulkSelected}
      className={className}
      onClick={onClick as any}
      {...(props as any)}
    />
  );
}
