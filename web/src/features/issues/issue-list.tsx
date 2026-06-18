import { useCallback, useEffect, useRef } from "react";
import type { IssueSummary, ProjectRow, TimelineBucket } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Empty } from "../../ui/empty";
import { IssueFeedRow } from "../../ui/issue-feed-row";
import {
  FEED_CELL_CHECKBOX,
  FEED_CELL_ISSUE,
  FEED_GRID_COMPACT,
  FEED_GRID_FULL,
} from "../../ui/issue-feed-layout";
import { IssueListColumnHeader } from "./issue-list-column-header";
import {
  inferTrendStatus,
  issueLocationHint,
  parseIssueTitle,
  platformLabel,
  projectIssueCode,
} from "./issue-feed-utils";
import { canIgnoreIssue, canResolveIssue } from "./issue-triage-utils";

export interface IssueListProps {
  issues: IssueSummary[];
  projects: ProjectRow[];
  focusedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string, extend?: boolean) => void;
  onToggleSelect: (id: string) => void;
  onResolve: (id: string) => void;
  onIgnore: (id: string) => void;
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
  selectedIds,
  onSelect,
  onToggleSelect,
  onResolve,
  onIgnore,
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

      if (event.altKey && event.key.toLowerCase() === "k") {
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

      if (event.key === "e" && focusedId && !actionsDisabled) {
        const issue = issues.find((row) => row.id === focusedId);
        if (issue && canResolveIssue(issue.status)) {
          event.preventDefault();
          onResolve(focusedId);
        }
        return;
      }

      if (event.key === "i" && focusedId && !actionsDisabled) {
        const issue = issues.find((row) => row.id === focusedId);
        if (issue && canIgnoreIssue(issue.status)) {
          event.preventDefault();
          onIgnore(focusedId);
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
      onFocusQuery,
      onIgnore,
      onMoveSelection,
      onOpenDetail,
      onResolve,
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
  const emptyTitle = filtersActive ? "No results" : "No issues";
  const emptyDescription = filtersActive
    ? "No issues match your current filters."
    : "No unresolved exceptions in this environment.";
  const emptyContent = (
    <Empty
      variant="inset"
      className="w-full items-start text-left"
      title={emptyTitle}
      description={emptyDescription}
    >
      {filtersActive && onResetFilters ? (
        <Button variant="ghost" size="sm" className="mt-3" onClick={onResetFilters}>
          Reset filters
        </Button>
      ) : null}
    </Empty>
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
        <>
          <div
            className={cn(
              "epure-issue-list-empty hidden w-full lg:grid",
              compact ? FEED_GRID_COMPACT : FEED_GRID_FULL,
            )}
          >
            <div className={cn(FEED_CELL_CHECKBOX, "hidden lg:flex")} aria-hidden />
            <div className={cn(FEED_CELL_ISSUE, compact ? "col-span-3" : "col-span-8", "py-5")}>
              {emptyContent}
            </div>
          </div>
          <div className="epure-issue-list-empty w-full px-4 py-5 lg:hidden">{emptyContent}</div>
        </>
      ) : null}

      {issues.map((issue) => {
        const title = issue.title ?? "Untitled issue";
        const { shortTitle, subtitle } = parseIssueTitle(title);
        const checked = selectedIds.has(issue.id);
        const rowSelected = issue.id === focusedId;
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
