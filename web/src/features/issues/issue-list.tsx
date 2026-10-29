import { useCallback, useEffect, useMemo, useRef } from "react";
import type { IssueSummary, ProjectRow, TimelineBucket } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Button } from "@/components/ui/button";
import { Empty } from "../../ui/empty";
import { IssueInboxLifecycleCue } from "@/components/kit/inbox-lifecycle-cue";
import { issueInboxLifecycleKinds } from "@/lib/inbox-lifecycle";
import { IssueRowShell } from "@/components/kit/issue-row-shell";
import { IssueListColumnHeader } from "./issue-list-column-header";
import { resolveIssuePriority } from "../../ui/issue-priority";
import { IssueRowActionsMenu } from "./issue-row-actions-menu";
import type { SnoozeMode } from "../../lib/api";
import { formatCompactCount } from "../../lib/format-count";
import { formatAge, formatRelativeTime } from "../../lib/format-time";
import { copyText } from "../../lib/copy-text";
import { toast } from "@/components/ui/sonner";
import {
  inferTrendStatus,
  parseIssueTitle,
} from "./issue-feed-utils";
import { bulkTriageAvailability, issueWorkflowActions } from "./issue-triage-utils";
import { BulkActions } from "./bulk-actions";

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
  canMerge?: boolean;
  canSplitForIssueId?: string | null;
  onMenuResolve: (ids: string[]) => void;
  onMenuIgnore: (ids: string[]) => void;
  onMenuReopen: (ids: string[]) => void;
  onMenuSnooze: (mode: SnoozeMode, ids: string[]) => void;
  onMenuUnsnooze?: (ids: string[]) => void;
  /** Open issue, including when the active filter has already dropped it. */
  selectedIssue?: IssueSummary | null;
  onMenuAskAi: (issues: IssueSummary[]) => void;
  onMenuMarkRead: (ids: string[]) => void;
  onMenuDeleteRequest: (ids: string[]) => void;
  onMenuMerge?: () => void;
  onMenuSplit?: () => void;
  onClearSelection?: () => void;
  canSplit?: boolean;
  onBulkSplit?: () => void;
}

export function IssueList({
  issues,
  projects: _projects,
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
  canMerge = false,
  canSplitForIssueId = null,
  onMenuResolve,
  onMenuIgnore,
  onMenuReopen,
  onMenuSnooze,
  onMenuUnsnooze,
  selectedIssue = null,
  onMenuAskAi,
  onMenuMarkRead,
  onMenuDeleteRequest,
  onMenuMerge,
  onMenuSplit,
  onClearSelection,
  canSplit = false,
  onBulkSplit,
}: IssueListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIssuesForBulk = useMemo(
    () => issues.filter((issue) => selectedIds.has(issue.id)),
    [issues, selectedIds],
  );
  const bulkAvailability = useMemo(
    () => bulkTriageAvailability(selectedIssuesForBulk),
    [selectedIssuesForBulk],
  );

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
        const issue =
          issues.find((row) => row.id === targetId) ??
          (selectedIssue?.id === targetId ? selectedIssue : undefined);
        if (issue) {
          const actions = issueWorkflowActions(issue);
          if (actions.includes("reopen") && onReopen) {
            event.preventDefault();
            onReopen(targetId);
          } else if (actions.includes("resolve")) {
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
        const issue =
          issues.find((row) => row.id === targetId) ??
          (selectedIssue?.id === targetId ? selectedIssue : undefined);
        if (issue) {
          const actions = issueWorkflowActions(issue);
          if (actions.includes("unsnooze") && onUnsnooze) {
            event.preventDefault();
            onUnsnooze(targetId);
          } else if (actions.includes("snooze") && onSnooze) {
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
        const issue =
          issues.find((row) => row.id === targetId) ??
          (selectedIssue?.id === targetId ? selectedIssue : undefined);
        if (issue && issueWorkflowActions(issue).includes("ignore")) {
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
      onReopen,
      onSnooze,
      onUnsnooze,
      onToggleSelect,
      selectedIssue,
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
        <IssueListColumnHeader
          compact={compact}
          selectAllChecked={selectAllChecked}
          selectAllIndeterminate={selectAllIndeterminate}
          onToggleSelectAll={onToggleSelectAll}
          windowLabel={windowLabel}
          selectionActive={selectedIds.size > 0}
        />

        <BulkActions
          selectedIds={selectedIds}
          availability={bulkAvailability}
          canMerge={canMerge}
          canSplit={canSplit}
          busy={actionsDisabled}
          className="top-8 z-20 border-b border-border-subtle"
          onResolve={() => onMenuResolve(Array.from(selectedIds))}
          onIgnore={() => onMenuIgnore(Array.from(selectedIds))}
          onReopen={() => onMenuReopen(Array.from(selectedIds))}
          onMarkRead={() => onMenuMarkRead(Array.from(selectedIds))}
          onAskAi={() => onMenuAskAi(selectedIssuesForBulk)}
          onSnooze={async (mode) => {
            onMenuSnooze(mode, Array.from(selectedIds));
          }}
          onUnsnooze={() => onMenuUnsnooze?.(Array.from(selectedIds))}
          onMerge={onMenuMerge}
          onSplit={onBulkSplit ?? onMenuSplit}
          onClear={() => onClearSelection?.()}
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
          const priority = resolveIssuePriority(issue.level, issue.status, issue);
          const lifecycleKinds = issueInboxLifecycleKinds(issue);
          return (
            <div key={issue.id} data-issue-id={issue.id}>
              <IssueRowShell
                id={issue.id}
                bulkSelected={bulkSelected}
                focused={focused}
                detailActive={detailActive}
                tourAnchor={index === 0}
                unread={isIssueUnread?.(issue) ?? false}
                selectionActive={selectedIds.size > 0}
                onSelectChange={() => onToggleSelect(issue.id)}
                escalating={isEscalating}
                priority={priority}
                title={shortTitle}
                subtitle={subtitle}
                lifecycle={
                  lifecycleKinds.length > 0 ? (
                    <IssueInboxLifecycleCue issue={issue} />
                  ) : undefined
                }
                rowActions={
                  <IssueRowActionsMenu
                    issue={issue}
                    issues={issues}
                    selectedIds={selectedIds}
                    busy={actionsDisabled}
                    canMerge={canMerge}
                    canSplit={canSplitForIssueId === issue.id}
                    onResolve={onMenuResolve}
                    onIgnore={onMenuIgnore}
                    onReopen={onMenuReopen}
                    onSnooze={onMenuSnooze}
                    onUnsnooze={(id) => onUnsnooze?.(id)}
                    onUnsnoozeMany={onMenuUnsnooze}
                    onAskAi={onMenuAskAi}
                    onMarkRead={onMenuMarkRead}
                    onDeleteRequest={onMenuDeleteRequest}
                    onMerge={onMenuMerge}
                    onSplit={onMenuSplit}
                    onClearSelection={onClearSelection}
                  />
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
