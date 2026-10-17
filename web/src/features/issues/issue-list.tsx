import { useCallback, useEffect, useRef } from "react";
import type { IssueSummary, ProjectRow, TimelineBucket } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Empty } from "../../ui/empty";
import { IssueFeedRow } from "../../ui/issue-feed-row";
import { IssueListColumnHeader } from "./issue-list-column-header";
import {
  inferTrendStatus,
  issueLocationHint,
  parseIssueTitle,
  platformLabel,
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

function projectForIssue(projects: ProjectRow[], issue: IssueSummary): ProjectRow | undefined {
  return projects.find((project) => project.id === issue.project_id);
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
  isIssueUnread,
  trendBucketsByIssueId = {},
}: IssueListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const targetId = selectedId ?? focusedId;

      if (
        (event.altKey && event.key.toLowerCase() === "k") ||
        (!event.altKey && !event.metaKey && !event.ctrlKey && (event.key === "Enter" || event.key === "o"))
      ) {
        event.preventDefault();
        onOpenDetail();
        return;
      }

      if (
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        event.key === "j"
      ) {
        event.preventDefault();
        onMoveSelection("down");
        return;
      }

      if (
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        event.key === "k"
      ) {
        event.preventDefault();
        onMoveSelection("up");
        return;
      }

      if (event.key === "e" && targetId && !actionsDisabled) {
        const issue = issues.find((row) => row.id === targetId);
        if (issue && canResolveIssue(issue.status)) {
          event.preventDefault();
          onResolve(targetId);
        }
        return;
      }

      if (event.key === "i" && targetId && !actionsDisabled) {
        const issue = issues.find((row) => row.id === targetId);
        if (issue && canIgnoreIssue(issue.status)) {
          event.preventDefault();
          onIgnore(targetId);
        }
        return;
      }

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

      if (event.key === "x" && focusedId) {
        event.preventDefault();
        onToggleSelect(focusedId);
        return;
      }

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
        className={cn(
          "epure-issue-list flex flex-col rounded-lg border border-border bg-surface",
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
        const project = projectForIssue(projects, issue);
        const platform = platformLabel(
          project?.slug?.includes("api")
            ? issue.title?.toLowerCase().includes("timeout")
              ? "python"
              : "node"
            : "javascript",
        );

        return (
          <div key={issue.id} data-issue-id={issue.id}>
            <IssueFeedRow
              shortTitle={shortTitle}
              subtitle={subtitle}
              lastSeen={issue.last_seen_at ?? undefined}
              firstSeen={issue.first_seen_at ?? undefined}
              eventCount={issue.event_count}
              userCount={issue.unique_user_count}
              level={issue.level ?? undefined}
              status={issue.status}
              projectCode={
                project?.slug ? projectIssueCode(project.slug, issue.id) : undefined
              }
              platform={platform}
              location={issueLocationHint(issue)}
              trendBuckets={trendBucketsByIssueId[issue.id] ?? []}
              trendStatus={inferTrendStatus(
                issue,
                trendBucketsByIssueId[issue.id] ?? [],
              )}
              regression={issue.status === "regression"}
              unhandled={issue.status === "unresolved" && issue.level === "error"}
              snoozed={issue.snoozed}
              selected={rowSelected}
              bulkSelected={checked}
              unread={isIssueUnread ? isIssueUnread(issue) : false}
              compact={compact}
              checkbox={
                <Checkbox
                  checked={checked}
                  aria-label={`Select ${title}`}
                  title="Select (x)"
                  onCheckedChange={() => onToggleSelect(issue.id)}
                />
              }
              onClick={(event) => onSelect(issue.id, event.shiftKey)}
            />
          </div>
        );
      })}
      </div>
    </div>
  );
}
