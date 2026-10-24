import { useCallback, useEffect, useRef } from "react";
import type { IssueSummary, ProjectRow, TimelineBucket } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Button } from "@/components/ui/button";
import { Empty } from "../../ui/empty";
import { IssueRowShell } from "@/components/kit/issue-row-shell";
import { IssueListColumnHeader } from "./issue-list-column-header";
import { IssuePriorityIcon } from "../../ui/issue-priority";
import { OccurrenceLineChart } from "../../ui/occurrence-line-chart";
import { formatCompactCount } from "../../lib/format-count";
import { formatAge } from "../../lib/format-time";
import { copyText } from "../../lib/copy-text";
import { toast } from "@/components/ui/sonner";
import { Check, Clock, Sparkles } from "lucide-react";
import {
  inferTrendStatus,
  issueLocationHint,
  parseIssueTitle,
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
  onIgnore: (id: string) => void;
  onSnooze?: (id: string) => void;
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
  isIssueUnread?: (issue: IssueSummary) => boolean;
  trendBucketsByIssueId?: Record<string, TimelineBucket[]>;
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
  onIgnore,
  onSnooze,
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
  isIssueUnread: _isIssueUnread,
  trendBucketsByIssueId = {},
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

      // R or E: Resolve
      if (
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        (event.key.toLowerCase() === "r" || event.key === "e") &&
        targetId &&
        !actionsDisabled
      ) {
        const issue = issues.find((row) => row.id === targetId);
        if (issue && canResolveIssue(issue.status)) {
          event.preventDefault();
          onResolve(targetId);
        }
        return;
      }

      // S: Snooze
      if (
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        event.key.toLowerCase() === "s" &&
        targetId &&
        !actionsDisabled &&
        onSnooze
      ) {
        const issue = issues.find((row) => row.id === targetId);
        if (issue && canSnoozeIssue(issue)) {
          event.preventDefault();
          onSnooze(targetId);
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
        "mb-3 w-full",
        isEmpty ? "shrink-0" : "flex min-h-0 min-w-0 flex-1 flex-col",
      )}
    >
      <div
        ref={listRef}
        data-slot="issue-feed-list"
        className={cn(
          "epure-issue-list flex flex-col rounded-lg border border-border bg-surface-1 shadow-xs",
          isEmpty
            ? "shrink-0 overflow-hidden"
            : "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
        )}
      >
        <IssueListColumnHeader
          compact={compact}
          selectAllChecked={selectAllChecked}
          selectAllIndeterminate={selectAllIndeterminate}
          onToggleSelectAll={onToggleSelectAll}
        />

        {isEmpty ? (
          <div className="epure-issue-list-empty px-4 py-6">
            {emptyContent}
          </div>
        ) : null}

        {issues.map((issue) => {
          const title = issue.title ?? "Untitled issue";
          const { shortTitle, subtitle } = parseIssueTitle(title);
          const checked = selectedIds.has(issue.id);
          const rowSelected = issue.id === (selectedId ?? focusedId);
          const buckets = trendBucketsByIssueId[issue.id] ?? [];
          const trendStatus = inferTrendStatus(issue, buckets);
          const isEscalating = Boolean(issue.is_escalating_3d || trendStatus === "escalating");

          // Quick Action buttons on hover/focus (Sprint 4: Resolve, Snooze, Ask Agent)
          const quickActions = (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {canResolveIssue(issue.status) && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6 p-0 text-fg-muted hover:text-healthy hover:bg-healthy/10"
                  title="Resolve (R)"
                  onClick={() => onResolve(issue.id)}
                >
                  <Check className="size-3.5" />
                </Button>
              )}
              {canSnoozeIssue(issue) && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6 p-0 text-fg-muted hover:text-fg-primary hover:bg-surface-3"
                  title="Snooze (S)"
                  onClick={() => onSnooze?.(issue.id)}
                >
                  <Clock className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-6 w-6 p-0 text-fg-muted hover:text-accent hover:bg-accent/10"
                title="Ask Agent to Fix (C)"
                onClick={() => handleCopyAgentPrompt(issue)}
              >
                <Sparkles className="size-3.5" />
              </Button>
            </div>
          );

          return (
            <div key={issue.id} data-issue-id={issue.id}>
              <IssueRowShell
                id={issue.id}
                selected={checked || rowSelected}
                onSelectChange={() => onToggleSelect(issue.id)}
                escalating={isEscalating}
                statusBadge={
                  <IssuePriorityIcon
                    level={issue.level}
                    status={issue.status}
                    size={14}
                  />
                }
                title={shortTitle}
                subtitle={subtitle || issueLocationHint(issue)}
                sparkline={
                  <OccurrenceLineChart
                    buckets={buckets}
                    height={18}
                    className="w-[72px]"
                  />
                }
                eventsCount={formatCompactCount(issue.event_count)}
                usersCount={formatCompactCount(issue.unique_user_count)}
                timeAgo={issue.last_seen_at ? formatAge(issue.last_seen_at) : "—"}
                onClick={() => onSelect(issue.id)}
                actions={quickActions}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
