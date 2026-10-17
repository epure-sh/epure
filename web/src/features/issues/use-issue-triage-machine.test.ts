import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_QUERY } from "./use-issue-triage-machine";
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

    const hourSnooze = applyOptimisticSnooze(original, "hours");
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
});
