import assert from "node:assert/strict";
import type { EventDetail } from "../../lib/api";
import { diffEvents, flattenJson } from "./diff-utils";

function sampleEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: "event-a",
    issue_id: "issue-1",
    occurred_at: "2026-01-01T12:00:00.000Z",
    environment: "production",
    release: "web@1.0.0",
    platform: "javascript",
    runtime_name: null,
    runtime_version: null,
    browser_name: "Chrome",
    os_name: "macOS",
    user_id: "usr_a",
    user_email: "alice@example.com",
    payload_json: { transaction: "/checkout", tags: { feature: "checkout" } },
    stack_frames: null,
    breadcrumbs: null,
    ...overrides,
  };
}

const left = sampleEvent();
const right = sampleEvent({
  id: "event-b",
  release: "web@1.1.0",
  user_email: "bob@example.com",
  payload_json: { transaction: "/checkout?step=2", tags: { feature: "checkout" } },
});

const rows = diffEvents(left, right);
assert.ok(rows.some((row) => row.key === "event.release"));
assert.ok(rows.some((row) => row.key === "event.user"));
assert.ok(rows.some((row) => row.key === "transaction"));
assert.equal(flattenJson({ a: { b: 1 } })["a.b"], "1");

console.log("diff-utils.test.ts passed");
