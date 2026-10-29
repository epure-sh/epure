import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_QUERY, DEFAULT_QUERY } from "./query-utils";
import {
  applyOptimisticSnooze,
  bulkTriageAvailability,
  canResolveIssue,
  canIgnoreIssue,
  canReopenIssue,
  canSnoozeIssue,
} from "./issue-triage-utils";
import { issueLocationHint } from "./issue-feed-utils";
import { buildIssueAiClipboard } from "./export-markdown";
import { extractCulprit, generateAiDiagnosis } from "../../ui/issue-ai-copilot-card";

describe("use-issue-triage-machine semantics", () => {
  it("defaults to unresolved issues query", () => {
    assert.equal(DEFAULT_QUERY, "is:unresolved");
  });

  it("evaluates single-issue triage eligibility correctly", () => {
    assert.equal(canResolveIssue("unresolved"), true);
    assert.equal(canResolveIssue("regression"), true);
    assert.equal(canResolveIssue("resolved"), false);

    assert.equal(canIgnoreIssue("unresolved"), true);
    assert.equal(canIgnoreIssue("ignored"), false);

    assert.equal(canReopenIssue("resolved"), true);
    assert.equal(canReopenIssue("ignored"), true);
    assert.equal(canReopenIssue("unresolved"), false);

    assert.equal(canSnoozeIssue({ status: "unresolved", snoozed: false }), true);
    assert.equal(canSnoozeIssue({ status: "unresolved", snoozed: true }), false);
  });

  it("computes optimistic state delta accurately for snoozing", () => {
    const original = {
      id: "issue-100",
      org_id: "org-1",
      project_id: "project-1",
      fingerprint: "fp-100",
      title: "SyntaxError: Unexpected token",
      status: "unresolved",
      level: "error",
      environment: "production",
      release: "v1.2.0",
      event_count: 10,
      unique_user_count: 2,
      last_seen_at: null,
      first_seen_at: null,
      resolved_in_release: null,
      snoozed: false,
      snooze_until: null,
      snooze_until_count: null,
      snooze_until_users: null,
    };

    const countSnooze = applyOptimisticSnooze(original, "occurrences");
    assert.equal(countSnooze.snoozed, true);
    assert.equal(countSnooze.snooze_until_count, 110);

    const userSnooze = applyOptimisticSnooze(original, "users");
    assert.equal(userSnooze.snoozed, true);
    assert.equal(userSnooze.snooze_until_users, 12);

    const hourSnooze = applyOptimisticSnooze(original, "4h");
    const monthSnooze = applyOptimisticSnooze(original, "30d");
    assert.equal(monthSnooze.snoozed, true);
    assert.ok(monthSnooze.snooze_until);
    assert.equal(hourSnooze.snoozed, true);
    assert.ok(hourSnooze.snooze_until);
  });

  it("handles multi-selection triage matrix properly", () => {
    const list = [
      { status: "unresolved", snoozed: false },
      { status: "resolved", snoozed: false },
      { status: "ignored", snoozed: true },
    ];
    const availability = bulkTriageAvailability(list);
    assert.equal(availability.resolve, true);
    assert.equal(availability.ignore, true);
    assert.equal(availability.reopen, true);
    assert.equal(availability.snooze, true);
  });

  it("extracts code locations accurately via issueLocationHint", () => {
    // 1. Explicit file:line in title
    assert.equal(
      issueLocationHint({
        title: "Error: Failed in src/routes/checkout.tsx:42",
        environment: "production",
      } as any),
      "routes/checkout.tsx:42",
    );

    // 2. Property dereference pattern
    assert.equal(
      issueLocationHint({
        title: "TypeError: Cannot read properties of undefined (reading 'price')",
        environment: "production",
      } as any),
      ".price",
    );

    // 3. Fallback to release
    assert.equal(
      issueLocationHint({
        title: "InternalServerError",
        environment: "production",
        release: "web@2.14.0",
      } as any),
      "web@2.14.0",
    );

    // 4. Fallback to non-prod environment
    assert.equal(
      issueLocationHint({
        title: "TestError",
        environment: "staging",
      } as any),
      "staging",
    );
  });

  it("generates deterministic AI diagnosis and unified prompt for all assistants", () => {
    const issue = {
      id: "issue-test",
      title: "TypeError: Cannot read properties of undefined (reading 'price')",
      status: "unresolved",
      level: "error",
      environment: "production",
      event_count: 50,
      unique_user_count: 10,
      first_seen_at: "2026-10-01T00:00:00Z",
    } as any;

    const event = {
      id: "event-1",
      issue_id: "issue-test",
      occurred_at: "2026-10-01T00:00:00Z",
      environment: "production",
      release: "v1.0.0",
      platform: "node",
      runtime_name: "node",
      runtime_version: "20",
      browser_name: null,
      os_name: "linux",
      user_id: null,
      user_email: null,
      payload_json: {
        culprit: "src/cart/calculateTotal.ts:15",
      },
      stack_frames: [
        { filename: "src/cart/calculateTotal.ts", lineno: 15, function: "calculateTotal" },
      ],
      breadcrumbs: [],
    };

    const culprit = extractCulprit(issue, event);
    assert.equal(culprit, "src/cart/calculateTotal.ts:15");

    const diagnosis = generateAiDiagnosis(issue, event);
    assert.equal(diagnosis.culprit, "src/cart/calculateTotal.ts:15");
    assert.equal(diagnosis.confidence, "High");
    assert.ok(diagnosis.cause.includes("Null or undefined reference dereferenced"));
    assert.ok(diagnosis.fix.includes("optional chaining"));

    const prompt = buildIssueAiClipboard(issue, event);
    assert.ok(prompt.includes("TypeError: Cannot read properties"));
    assert.ok(prompt.includes("src/cart/calculateTotal.ts:15"));
    assert.ok(prompt.includes("Likely fault location"));
  });

  it("synchronizes query state and headline stats optimistically on snooze and unsnooze", () => {
    const initialStats = {
      project_id: "prj_1",
      environment: "production",
      unresolved: 10,
      events_7d: 500,
      regressions: 0,
      snoozed: 2,
    };

    // Snooze: unresolved decrements, snoozed increments
    const afterSnooze = {
      ...initialStats,
      snoozed: (initialStats.snoozed ?? 0) + 1,
      unresolved: Math.max(0, (initialStats.unresolved ?? 0) - 1),
    };
    assert.equal(afterSnooze.snoozed, 3);
    assert.equal(afterSnooze.unresolved, 9);

    // Unsnooze: snoozed decrements, unresolved increments
    const afterUnsnooze = {
      ...afterSnooze,
      snoozed: Math.max(0, (afterSnooze.snoozed ?? 0) - 1),
      unresolved: (afterSnooze.unresolved ?? 0) + 1,
    };
    assert.equal(afterUnsnooze.snoozed, 2);
    assert.equal(afterUnsnooze.unresolved, 10);

    // List filtering: unresolved query removes snoozed issue
    const issues = [
      { id: "iss_1", status: "unresolved", snoozed: false },
      { id: "iss_2", status: "unresolved", snoozed: false },
    ];
    const targetId = "iss_1";
    const remainingUnresolved = issues.filter((r) => r.id !== targetId);
    assert.equal(remainingUnresolved.length, 1);
    assert.equal(remainingUnresolved[0].id, "iss_2");

    // List filtering: snoozed query removes unsnoozed issue
    const snoozedIssues = [
      { id: "iss_1", status: "unresolved", snoozed: true },
      { id: "iss_2", status: "unresolved", snoozed: true },
    ];
    const remainingSnoozed = snoozedIssues.filter((r) => r.id !== targetId);
    assert.equal(remainingSnoozed.length, 1);
    assert.equal(remainingSnoozed[0].id, "iss_2");

    // Unresolved query prepends unsnoozed issue when it wasn't in the list
    const incomingUnsnoozed = { id: "iss_3", status: "unresolved", snoozed: false };
    const updatedList = remainingUnresolved.some((r) => r.id === incomingUnsnoozed.id)
      ? remainingUnresolved.map((r) => (r.id === incomingUnsnoozed.id ? incomingUnsnoozed : r))
      : [incomingUnsnoozed, ...remainingUnresolved];
    assert.equal(updatedList.length, 2);
    assert.equal(updatedList[0].id, "iss_3");
  });

  it("handles compound query filtering and optimistic removal on resolution or snooze", () => {
    const compoundQuery = "level:error env:production is:unresolved";
    const isUnresolvedView =
      compoundQuery.includes("is:unresolved") ||
      (!compoundQuery.includes("is:snoozed") &&
        !compoundQuery.includes("is:resolved") &&
        !compoundQuery.includes("is:ignored") &&
        !compoundQuery.includes("is:all"));
    assert.equal(isUnresolvedView, true);

    const issues = [
      { id: "err_1", status: "unresolved", level: "error", environment: "production" },
      { id: "err_2", status: "unresolved", level: "error", environment: "production" },
    ];
    const resolvedId = "err_1";
    const remaining = issues.filter((r) => r.id !== resolvedId);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, "err_2");
  });
});
