import { useCallback, useEffect, useRef, type ReactNode } from "react";
import type { IssueSummary, ProjectRow, TimelineBucket } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "../../ui/empty";
import { IssueRowShell } from "@/components/kit/issue-row-shell";
import { IssueListColumnHeader } from "./issue-list-column-header";
import { OccurrenceLineChart } from "../../ui/occurrence-line-chart";
import { resolveIssuePriority } from "../../ui/issue-priority";
import { formatCompactCount } from "../../lib/format-count";
import { formatAge, formatRelativeTime } from "../../lib/format-time";
import { copyText } from "../../lib/copy-text";
import { toast } from "@/components/ui/sonner";
import {
  inferTrendStatus,
  issueLocationHint,
  parseIssueTitle,
  projectIssueCode,
} from "./issue-feed-utils";
import {
  canIgnoreIssue,
  canResolveIssue,
  canSnoozeIssue,
} from "./issue-triage-utils";

export interface IssueListProps {
  issues: IssueSummary[];
  projects: ProjectRow[];
  focusedId: string | null;
  selectedId?: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string, extend?: boolean) => void;
  onToggleSelect: (id: string) => void;
  onResolve: (id: string) => void;
  onReopen?: (id: string) => void;
  onIgnore: (id: string) => void;
  onSnooze?: (id: string) => void;
  onUnsnooze?: (id: string) => void;
  actionsDisabled?: boolean;
  onMoveSelection: (direction: "up" | "down") => void;
  onOpenDetail: () => void;
  onFocusQuery: () => void;
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  onToggleSelectAll?: () => void;
  compact?: boolean;
  filtersActive?: boolean;
  onResetFilters?: () => void;
  windowLabel?: string;
  isIssueUnread?: (issue: IssueSummary) => boolean;
  trendBucketsByIssueId?: Record<string, TimelineBucket[]>;
  /** Render inside a parent card (no outer border / margin). */
  embedded?: boolean;
  bulkToolbar?: ReactNode;
}

export function IssueList({
  issues,
  projects,
  focusedId,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onResolve,
  onReopen,
  onIgnore,
  onSnooze,
  onUnsnooze,
  actionsDisabled = false,
  onMoveSelection,
  onOpenDetail,
  onFocusQuery,
  selectAllChecked = false,
  selectAllIndeterminate = false,
  onToggleSelectAll,
  compact = false,
  filtersActive = false,
  onResetFilters,
  windowLabel = "7d",
  isIssueUnread,
  trendBucketsByIssueId = {},
  embedded = false,
  bulkToolbar,
}: IssueListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleCopyAgentPrompt = useCallback((issue: IssueSummary) => {
    const brief = [
      `[Bug] ${issue.level ? `[${issue.level.toUpperCase()}] ` : ""}${issue.title ?? "Production Exception"}`,
      `Release: ${issue.release ?? "unknown"} | Environment: ${issue.environment ?? "production"}`,
      `Occurrences: ${issue.event_count} across ${issue.unique_user_count} users`,
      `Last seen: ${issue.last_seen_at ?? "recently"}`,
      "",
      "Please analyze this production error, identify root cause, and provide fix recommendations.",
    ].join("\n");
    void copyText(brief);
    toast.success("Copied prompt for AI agent (C)");
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const targetId = selectedId ?? focusedId;

      // J / K Navigation
      if (!event.altKey && !event.metaKey && !event.ctrlKey && event.key === "j") {
        event.preventDefault();
        onMoveSelection("down");
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && event.key === "k") {
        event.preventDefault();
        onMoveSelection("up");
        return;
      }

      // Enter / O opens detail
      if (
        (event.altKey && event.key.toLowerCase() === "k") ||
        (!event.altKey && !event.metaKey && !event.ctrlKey && (event.key === "Enter" || event.key === "o"))
      ) {
        event.preventDefault();
        onOpenDetail();
        return;
      }

      // R or E: Resolve / Unresolve (Reopen) toggle
      if (
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        (event.key.toLowerCase() === "r" || event.key === "e") &&
        targetId &&
        !actionsDisabled
      ) {
        const issue = issues.find((row) => row.id === targetId);
        if (issue) {
          if (issue.status === "resolved") {
            if (onReopen) {
              event.preventDefault();
              onReopen(targetId);
            }
          } else if (canResolveIssue(issue.status)) {
            event.preventDefault();
            onResolve(targetId);
          }
        }
        return;
      }

      // S: Snooze / Unsnooze toggle
      if (
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        event.key.toLowerCase() === "s" &&
        targetId &&
        !actionsDisabled
      ) {
        const issue = issues.find((row) => row.id === targetId);
        if (issue) {
          if ((issue.snoozed || issue.status === "snoozed") && onUnsnooze) {
            event.preventDefault();
            onUnsnooze(targetId);
          } else if (canSnoozeIssue(issue) && onSnooze) {
            event.preventDefault();
            onSnooze(targetId);
          }
        }
        return;
      }

      // C: Copy AI prompt
      if (
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        event.key.toLowerCase() === "c" &&
        targetId
      ) {
        const issue = issues.find((row) => row.id === targetId);
        if (issue) {
          event.preventDefault();
          handleCopyAgentPrompt(issue);
        }
        return;
      }

      // X: Toggle checkbox
      if (event.key === "x" && focusedId) {
        event.preventDefault();
        onToggleSelect(focusedId);
        return;
      }

      // I: Ignore
      if (event.key === "i" && targetId && !actionsDisabled) {
        const issue = issues.find((row) => row.id === targetId);
        if (issue && canIgnoreIssue(issue.status)) {
          event.preventDefault();
          onIgnore(targetId);
        }
        return;
      }

      // /: Focus query search
      if (event.key === "/") {
        event.preventDefault();
        onFocusQuery();
      }
    },
    [
      actionsDisabled,
      issues,
      focusedId,
      selectedId,
      onFocusQuery,
      onIgnore,
      onMoveSelection,
      onOpenDetail,
      onResolve,
      onSnooze,
      onToggleSelect,
      handleCopyAgentPrompt,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!focusedId || !listRef.current) {
      return;
    }
    const row = listRef.current.querySelector(`[data-issue-id="${focusedId}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [focusedId]);

  const isEmpty = issues.length === 0;
  const emptyContent = filtersActive ? (
    <Empty
      variant="search"
      className="w-full"
      title="No matching exceptions"
      description="No issues match your active filter criteria. Try adjusting your search query or clearing filters."
      action={
        onResetFilters ? (
          <Button variant="outline" size="sm" onClick={onResetFilters} className="btn-tactile">
            Clear active filters (Esc)
          </Button>
        ) : null
      }
    />
  ) : (
    <Empty
      variant="zen"
      className="w-full"
      title="Inbox Zero · Production is Calm"
      description="Zero unresolved exceptions detected in this time horizon. The Spike Valve is active and guarding against unneeded overage charges."
    />
  );

  return (
    <div
      className={cn(
        "w-full",
        embedded ? "flex min-h-0 min-w-0 flex-1 flex-col" : "mb-3",
        !embedded && (isEmpty ? "shrink-0" : "flex min-h-0 min-w-0 flex-1 flex-col"),
      )}
    >
      <div
        ref={listRef}
        data-slot="issue-feed-list"
        className={cn(
          "epure-issue-list flex flex-col bg-surface-1",
          embedded
            ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
            : cn(
                "rounded-lg border border-border shadow-xs",
                isEmpty ? "shrink-0 overflow-hidden" : "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
              ),
        )}
      >
        {bulkToolbar}
        <IssueListColumnHeader
          compact={compact}
          selectAllChecked={selectAllChecked}
          selectAllIndeterminate={selectAllIndeterminate}
          onToggleSelectAll={onToggleSelectAll}
          windowLabel={windowLabel}
        />

        {isEmpty ? (
          <div className="epure-issue-list-empty px-4 py-6">
            {emptyContent}
          </div>
        ) : null}

        {issues.map((issue, index) => {
          const title = issue.title ?? "Untitled issue";
          const { shortTitle, subtitle } = parseIssueTitle(title);
          const bulkSelected = selectedIds.has(issue.id);
          const focused = issue.id === focusedId;
          const detailActive = issue.id === selectedId;
          const buckets = trendBucketsByIssueId[issue.id] ?? [];
          const trendStatus = inferTrendStatus(issue, buckets);
          const isEscalating = Boolean(issue.is_escalating_3d || trendStatus === "escalating");
          const windowEvents = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
          const priority = resolveIssuePriority(issue.level, issue.status);
          const project = projects.find((row) => row.id === issue.project_id);
          const projectCode = project?.slug
            ? projectIssueCode(project.slug, issue.id)
            : null;
          const location = issueLocationHint(issue);

          const metaRow = (
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-fg-muted">
              {issue.environment ? (
                <Badge variant="env" size="compact" className="font-mono uppercase">
                  {issue.environment.slice(0, 4)}
                </Badge>
              ) : null}
              {projectCode ? (
                <span className="font-mono font-medium">{projectCode}</span>
              ) : null}
              {location ? (
                <span className="max-w-[12rem] truncate rounded-sm border border-border-subtle bg-surface-2 px-1 font-mono">
                  {location}
                </span>
              ) : null}
              {issue.status === "unresolved" && issue.level === "error" ? (
                <Badge variant="escalating" size="compact" className="font-mono font-semibold uppercase">
                  Unhandled
                </Badge>
              ) : null}
            </div>
          );

          return (
            <div key={issue.id} data-issue-id={issue.id}>
              <IssueRowShell
                id={issue.id}
                bulkSelected={bulkSelected}
                focused={focused}
                detailActive={detailActive}
                tourAnchor={index === 0}
                unread={isIssueUnread?.(issue) ?? false}
                onSelectChange={() => onToggleSelect(issue.id)}
                escalating={isEscalating}
                priority={priority}
                statusBadge={
                  issue.status === "regression" ? (
                    <Badge variant="regression" size="sm">Came back</Badge>
                  ) : issue.snoozed ? (
                    <Badge variant="info" size="sm">Snoozed</Badge>
                  ) : null
                }
                title={shortTitle}
                subtitle={subtitle}
                meta={metaRow}
                sparkline={
                  buckets.length > 0 ? (
                    <OccurrenceLineChart
                      buckets={buckets}
                      height={22}
                      className="w-24"
                      interactive={false}
                      emphasizeVariation
                    />
                  ) : null
                }
                eventsCount={
                  buckets.length > 0
                    ? formatCompactCount(windowEvents)
                    : formatCompactCount(issue.event_count)
                }
                usersCount={formatCompactCount(issue.unique_user_count)}
                timeAgo={issue.last_seen_at ? formatRelativeTime(issue.last_seen_at) : "—"}
                age={issue.first_seen_at ? formatAge(issue.first_seen_at) : "—"}
                onClick={() => onSelect(issue.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
