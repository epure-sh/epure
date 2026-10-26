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

const LIST_STATUSES = new Set(["unresolved", "resolved", "ignored", "regression"]);

/**
 * Mirrors the server's `is:` filter: `is:snoozed` matches snoozed issues of any status,
 * any other known status matches that exact status and excludes snoozed issues.
 */
export function issueMatchesStatusFilter(
  issue: Pick<IssueSummary, "status" | "snoozed">,
  status: string | undefined,
): boolean {
  if (!status) {
    return true;
  }
  if (status === "snoozed") {
    return issue.snoozed;
  }
  if (!LIST_STATUSES.has(status)) {
    return true;
  }
  return issue.status === status && !issue.snoozed;
}

export interface HeadlineStatsDelta {
  unresolved: number;
  regressions: number;
  snoozed: number;
}

function statsBucket(
  issue: Pick<IssueSummary, "status" | "snoozed"> | null,
): keyof HeadlineStatsDelta | null {
  if (!issue) return null;
  if (issue.snoozed) return "snoozed";
  if (issue.status === "unresolved") return "unresolved";
  if (issue.status === "regression") return "regressions";
  return null;
}

/** How the headline counters move when an issue goes from `before` to `after` (null = deleted). */
export function headlineStatsDelta(
  before: Pick<IssueSummary, "status" | "snoozed"> | null,
  after: Pick<IssueSummary, "status" | "snoozed"> | null,
): HeadlineStatsDelta {
  const delta: HeadlineStatsDelta = { unresolved: 0, regressions: 0, snoozed: 0 };
  const from = statsBucket(before);
  const to = statsBucket(after);
  if (from === to) return delta;
  if (from) delta[from] -= 1;
  if (to) delta[to] += 1;
  return delta;
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
