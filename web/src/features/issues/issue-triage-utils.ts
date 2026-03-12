import type { IssueSummary, SnoozeMode } from "../../lib/api";

export type IssueStatus = "unresolved" | "resolved" | "ignored" | "regression";

export function canResolveIssue(status: string): boolean {
  return status === "unresolved" || status === "regression";
}

export function canIgnoreIssue(status: string): boolean {
  return status === "unresolved" || status === "regression";
}

export function canReopenIssue(status: string): boolean {
  return status === "resolved" || status === "ignored";
}

export function canSnoozeIssue(issue: Pick<IssueSummary, "status" | "snoozed">): boolean {
  return (
    (canResolveIssue(issue.status) || issue.status === "ignored") && !issue.snoozed
  );
}

export function applyOptimisticSnooze(issue: IssueSummary, mode: SnoozeMode): IssueSummary {
  switch (mode) {
    case "hours":
      return {
        ...issue,
        snoozed: true,
        snooze_until: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        snooze_until_count: null,
        snooze_until_users: null,
      };
    case "occurrences":
      return {
        ...issue,
        snoozed: true,
        snooze_until: null,
        snooze_until_count: issue.event_count + 100,
        snooze_until_users: null,
      };
    case "users":
      return {
        ...issue,
        snoozed: true,
        snooze_until: null,
        snooze_until_count: null,
        snooze_until_users: issue.unique_user_count + 10,
      };
  }
}

export interface BulkTriageAvailability {
  resolve: boolean;
  ignore: boolean;
  reopen: boolean;
  snooze: boolean;
}

export function bulkTriageAvailability(
  issues: Pick<IssueSummary, "status" | "snoozed">[],
): BulkTriageAvailability {
  if (issues.length === 0) {
    return { resolve: false, ignore: false, reopen: false, snooze: false };
  }

  return {
    resolve: issues.some((issue) => canResolveIssue(issue.status)),
    ignore: issues.some((issue) => canIgnoreIssue(issue.status)),
    reopen: issues.some((issue) => canReopenIssue(issue.status)),
    snooze: issues.some((issue) => canSnoozeIssue(issue)),
  };
}
