import type { AlertRow, IssueSummary } from "./api";

/** Shared lifecycle labels for issue + alert feeds (not inbox read/unread). */
export type InboxLifecycleKind = "snoozed" | "came_back" | "resolved" | "ignored";

const LABEL: Record<InboxLifecycleKind, string> = {
  snoozed: "Snoozed",
  came_back: "Came back",
  resolved: "Resolved",
  ignored: "Ignored",
};

export function inboxLifecycleLabel(kind: InboxLifecycleKind): string {
  return LABEL[kind];
}

export function issueInboxLifecycleKinds(issue: Pick<IssueSummary, "status" | "snoozed" | "came_back">): InboxLifecycleKind[] {
  const kinds: InboxLifecycleKind[] = [];
  if (issue.snoozed || issue.status === "snoozed") {
    kinds.push("snoozed");
  }
  if (issue.status === "regression" || issue.came_back) {
    kinds.push("came_back");
  }
  if (issue.status === "resolved") {
    kinds.push("resolved");
  }
  if (issue.status === "ignored") {
    kinds.push("ignored");
  }
  return kinds;
}

export function alertInboxLifecycleKinds(
  alert: Pick<AlertRow, "kind" | "ignored">,
): InboxLifecycleKind[] {
  const kinds: InboxLifecycleKind[] = [];
  if (alert.ignored) {
    kinds.push("snoozed");
  }
  if (alert.kind === "regression") {
    kinds.push("came_back");
  }
  return kinds;
}
