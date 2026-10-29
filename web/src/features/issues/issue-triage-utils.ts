import type { IssueSummary, SnoozeMode } from "../../lib/api";
import type { ParsedQuery } from "./query-utils";

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

export function isIssueSnoozed(issue: Pick<IssueSummary, "status" | "snoozed">): boolean {
  return issue.snoozed || issue.status === "snoozed";
}

export function canSnoozeIssue(issue: Pick<IssueSummary, "status" | "snoozed">): boolean {
  return (
    (canResolveIssue(issue.status) || issue.status === "ignored") && !isIssueSnoozed(issue)
  );
}

export type IssueWorkflowAction = "resolve" | "ignore" | "reopen" | "snooze" | "unsnooze";

/** Actions the screen should offer for this issue right now. */
export function issueWorkflowActions(
  issue: Pick<IssueSummary, "status" | "snoozed">,
): IssueWorkflowAction[] {
  const actions: IssueWorkflowAction[] = [];
  if (isIssueSnoozed(issue)) {
    actions.push("unsnooze");
  } else if (canSnoozeIssue(issue)) {
    actions.push("snooze");
  }
  if (!isIssueSnoozed(issue) && canResolveIssue(issue.status)) {
    actions.push("resolve");
  }
  if (!isIssueSnoozed(issue) && canIgnoreIssue(issue.status)) {
    actions.push("ignore");
  }
  if (canReopenIssue(issue.status)) {
    actions.push("reopen");
  }
  return actions;
}

export function issueStateBadge(issue: Pick<IssueSummary, "status" | "snoozed">): {
  label: string;
  variant: "resolved" | "warning" | "info" | "env";
} {
  if (isIssueSnoozed(issue)) {
    return { label: "Snoozed", variant: "info" };
  }
  switch (issue.status) {
    case "resolved":
      return { label: "Resolved", variant: "resolved" };
    case "ignored":
      return { label: "Ignored", variant: "env" };
    case "regression":
      return { label: "Came back", variant: "warning" };
    default:
      return { label: "Unresolved", variant: "env" };
  }
}

/** Status change as the server will store it, including clearing a snooze overlay. */
export function applyIssueStatus(
  issue: IssueSummary,
  status: string,
  resolvedInRelease?: string | null,
): IssueSummary {
  const reopening = status === "unresolved" || status === "regression";
  const resolving = status === "resolved";
  return {
    ...issue,
    status,
    snoozed: false,
    snooze_until: null,
    snooze_until_count: null,
    snooze_until_users: null,
    resolved_in_release: resolving
      ? (resolvedInRelease ?? issue.release ?? null)
      : reopening
        ? null
        : issue.resolved_in_release,
    resolved_at: resolving ? new Date().toISOString() : reopening ? null : issue.resolved_at,
    came_back: status === "regression",
  };
}

export function applyIssueUnsnooze(issue: IssueSummary): IssueSummary {
  return {
    ...issue,
    status: issue.status === "snoozed" ? "unresolved" : issue.status,
    snoozed: false,
    snooze_until: null,
    snooze_until_count: null,
    snooze_until_users: null,
  };
}

const SNOOZE_HOURS: Record<Exclude<SnoozeMode, "occurrences" | "users">, number> = {
  "1h": 1,
  "4h": 4,
  "1d": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
};

export function applyOptimisticSnooze(issue: IssueSummary, mode: SnoozeMode): IssueSummary {
  if (mode === "occurrences") {
    return {
      ...issue,
      snoozed: true,
      snooze_until: null,
      snooze_until_count: issue.event_count + 100,
      snooze_until_users: null,
    };
  }
  if (mode === "users") {
    return {
      ...issue,
      snoozed: true,
      snooze_until: null,
      snooze_until_count: null,
      snooze_until_users: issue.unique_user_count + 10,
    };
  }
  return {
    ...issue,
    snoozed: true,
    snooze_until: new Date(Date.now() + SNOOZE_HOURS[mode] * 60 * 60 * 1000).toISOString(),
    snooze_until_count: null,
    snooze_until_users: null,
  };
}

/** Closest menu duration for an undo after someone unsnoozes. */
export function snoozeModeFromIssue(issue: Pick<IssueSummary, "snooze_until" | "snooze_until_count" | "snooze_until_users">): SnoozeMode {
  if (issue.snooze_until_count != null) {
    return "occurrences";
  }
  if (issue.snooze_until_users != null) {
    return "users";
  }
  const until = issue.snooze_until ? Date.parse(issue.snooze_until) : Number.NaN;
  const hours = Number.isFinite(until) ? (until - Date.now()) / 3_600_000 : 4;
  if (hours <= 2) return "1h";
  if (hours <= 8) return "4h";
  if (hours <= 36) return "1d";
  if (hours <= 24 * 10) return "7d";
  if (hours <= 24 * 45) return "30d";
  return "90d";
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
  if (status === "unresolved") {
    return (
      (issue.status === "unresolved" || issue.status === "regression") && !issue.snoozed
    );
  }
  if (!LIST_STATUSES.has(status)) {
    return true;
  }
  return issue.status === status && !issue.snoozed;
}

/** Client + API filter: primary lifecycle scope plus optional view modifier. */
export function issueMatchesParsedQuery(
  issue: Pick<IssueSummary, "status" | "snoozed">,
  parsed: Pick<ParsedQuery, "lifecycle" | "viewModifier">,
): boolean {
  if (parsed.viewModifier === "snoozed") {
    if (!issue.snoozed) {
      return false;
    }
    if (parsed.lifecycle === "resolved") {
      return issue.status === "resolved";
    }
    if (parsed.lifecycle === "ignored") {
      return issue.status === "ignored";
    }
    if (parsed.lifecycle === "unresolved") {
      return issue.status === "unresolved" || issue.status === "regression";
    }
    return true;
  }

  if (parsed.viewModifier === "regression") {
    if (issue.status !== "regression" || issue.snoozed) {
      return false;
    }
    if (parsed.lifecycle === "resolved" || parsed.lifecycle === "ignored") {
      return false;
    }
    return true;
  }

  if (parsed.lifecycle) {
    return issueMatchesStatusFilter(issue, parsed.lifecycle);
  }

  return true;
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
  unsnooze: boolean;
}

export function bulkTriageAvailability(
  issues: Pick<IssueSummary, "status" | "snoozed">[],
): BulkTriageAvailability {
  if (issues.length === 0) {
    return { resolve: false, ignore: false, reopen: false, snooze: false, unsnooze: false };
  }

  const actions = issues.map((issue) => issueWorkflowActions(issue));
  return {
    resolve: actions.some((row) => row.includes("resolve")),
    ignore: actions.some((row) => row.includes("ignore")),
    reopen: actions.some((row) => row.includes("reopen")),
    snooze: actions.some((row) => row.includes("snooze")),
    unsnooze: actions.some((row) => row.includes("unsnooze")),
  };
}
