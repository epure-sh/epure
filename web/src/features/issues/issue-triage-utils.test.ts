import assert from "node:assert/strict";
import {
  applyOptimisticSnooze,
  bulkTriageAvailability,
  canIgnoreIssue,
  canReopenIssue,
  canResolveIssue,
  canSnoozeIssue,
} from "./issue-triage-utils";

assert.equal(canResolveIssue("unresolved"), true);
assert.equal(canResolveIssue("regression"), true);
assert.equal(canResolveIssue("resolved"), false);
assert.equal(canIgnoreIssue("ignored"), false);

assert.equal(canReopenIssue("resolved"), true);
assert.equal(canReopenIssue("ignored"), true);
assert.equal(canReopenIssue("unresolved"), false);

assert.equal(canSnoozeIssue({ status: "unresolved", snoozed: false }), true);
assert.equal(canSnoozeIssue({ status: "unresolved", snoozed: true }), false);
assert.equal(canSnoozeIssue({ status: "ignored", snoozed: false }), true);

assert.deepEqual(
  bulkTriageAvailability([
    { status: "unresolved", snoozed: false },
    { status: "resolved", snoozed: false },
  ]),
  { resolve: true, ignore: true, reopen: true, snooze: true },
);
assert.deepEqual(bulkTriageAvailability([{ status: "resolved", snoozed: false }]), {
  resolve: false,
  ignore: false,
  reopen: true,
  snooze: false,
});
assert.deepEqual(
  bulkTriageAvailability([{ status: "unresolved", snoozed: true }]),
  { resolve: true, ignore: true, reopen: false, snooze: false },
);

const baseIssue = {
  id: "issue-1",
  org_id: "org-1",
  project_id: "project-1",
  fingerprint: "fp",
  title: "Error",
  status: "unresolved",
  level: "error",
  environment: "production",
  release: "v1",
  event_count: 42,
  unique_user_count: 7,
  last_seen_at: null,
  first_seen_at: null,
  resolved_in_release: null,
  snoozed: false,
  snooze_until: null,
  snooze_until_count: null,
  snooze_until_users: null,
};

const snoozedForOccurrences = applyOptimisticSnooze(baseIssue, "occurrences");
assert.equal(snoozedForOccurrences.snoozed, true);
assert.equal(snoozedForOccurrences.snooze_until_count, 142);
assert.equal(snoozedForOccurrences.snooze_until_users, null);
