import assert from "node:assert/strict";
import browserCheckout from "../../../../fixtures/seed/events/browser-checkout-typeerror.json";
import type { EventDetail, IssueSummary } from "../../lib/api";
import { buildIssueAiClipboard, buildIssueExportMarkdown } from "./export-markdown";

function stackFromPayload(payload: Record<string, unknown>): unknown {
  const exception = payload.exception as
    | { values?: Array<{ stacktrace?: { frames?: unknown[] } }> }
    | undefined;
  const frames = exception?.values?.[0]?.stacktrace?.frames;
  if (!Array.isArray(frames)) {
    return [];
  }
  return [...frames].reverse();
}

function sampleIssue(overrides: Partial<IssueSummary> = {}): IssueSummary {
  return {
    id: "issue-1",
    org_id: "org-1",
    project_id: "project-1",
    fingerprint: "fp-1",
    title: "TypeError: Cannot read properties of undefined (reading 'price')",
    status: "unresolved",
    level: "error",
    environment: "production",
    release: "web@2.14.0",
    event_count: 48,
    unique_user_count: 12,
    last_seen_at: "2026-09-13T12:38:00.000Z",
    first_seen_at: "2026-09-01T08:00:00.000Z",
    resolved_in_release: null,
    snoozed: false,
    snooze_until: null,
    snooze_until_count: null,
    snooze_until_users: null,
    ...overrides,
  };
}

function sampleEvent(payload: Record<string, unknown>): EventDetail {
  const contexts = payload.contexts as
    | {
        browser?: { name?: string };
        os?: { name?: string };
        runtime?: { name?: string; version?: string };
      }
    | undefined;
  const user = payload.user as { id?: string; email?: string } | undefined;

  return {
    id: "event-1",
    issue_id: "issue-1",
    occurred_at: "2026-09-13T12:38:00.000Z",
    environment: (payload.environment as string | undefined) ?? null,
    release: (payload.release as string | undefined) ?? null,
    platform: (payload.platform as string | undefined) ?? null,
    runtime_name: contexts?.runtime?.name ?? null,
    runtime_version: contexts?.runtime?.version ?? null,
    browser_name: contexts?.browser?.name ?? null,
    os_name: contexts?.os?.name ?? null,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    payload_json: payload,
    stack_frames: stackFromPayload(payload),
    breadcrumbs: payload.breadcrumbs ?? null,
  };
}

const issue = sampleIssue();
const event = sampleEvent(browserCheckout as Record<string, unknown>);
const clipboard = buildIssueAiClipboard(issue, event);
const markdown = buildIssueExportMarkdown(issue, event);

assert.match(clipboard, /# Fix this production exception \(one-shot\)/);
assert.match(clipboard, /### Root cause/);
assert.match(clipboard, /### Culprit/);
assert.match(clipboard, /### Patch/);
assert.match(clipboard, /### Regression guard/);
assert.match(clipboard, /## Likely fault location \(start here\)/);
assert.match(clipboard, /calculateTotal/);
assert.match(clipboard, /useCart\.ts/);
assert.match(clipboard, /User flow before crash:/);
assert.match(clipboard, /GET \/api\/cart/);
assert.match(clipboard, /transaction=\/checkout/);
assert.match(clipboard, /\*\*Users affected:\*\* 12/);

assert.match(markdown, /## Application stack \(in-app frames\)/);
assert.match(markdown, /CheckoutForm\.tsx/);
assert.match(markdown, /feature=checkout/);
assert.doesNotMatch(markdown, /react-dom\.production\.min\.js/);

const regressed = buildIssueAiClipboard(
  sampleIssue({
    status: "regressed",
    resolved_in_release: "web@2.13.0",
  }),
  event,
);
assert.match(regressed, /Regression: previously resolved in `web@2\.13\.0`/);

console.log("export-markdown.test.ts passed");
