import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IssueSummary } from "../../lib/api";
import { inferTrendStatus } from "./issue-feed-utils";

function sampleIssue(overrides: Partial<IssueSummary> = {}): IssueSummary {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    org_id: "00000000-0000-0000-0000-000000000001",
    project_id: "660e8400-e29b-41d4-a716-446655440001",
    fingerprint: "fp",
    title: "Error",
    status: "unresolved",
    level: "error",
    environment: "production",
    release: null,
    event_count: 10,
    unique_user_count: 1,
    last_seen_at: null,
    first_seen_at: null,
    resolved_in_release: null,
    snoozed: false,
    snooze_until: null,
    snooze_until_count: null,
    snooze_until_users: null,
    ...overrides,
  };
}

describe("inferTrendStatus", () => {
  it("flags regression issues as escalating", () => {
    const status = inferTrendStatus(
      sampleIssue({ status: "regression" }),
      [{ start: "2026-09-16T00:00:00.000Z", count: 1 }],
    );
    assert.equal(status, "escalating");
  });

  it("detects escalating counts from real buckets", () => {
    const buckets = Array.from({ length: 12 }, (_, index) => ({
      start: `2026-09-16T${String(index).padStart(2, "0")}:00:00.000Z`,
      count: index < 6 ? 1 : 10,
    }));
    assert.equal(inferTrendStatus(sampleIssue(), buckets), "escalating");
  });

  it("detects declining counts from real buckets", () => {
    const buckets = Array.from({ length: 12 }, (_, index) => ({
      start: `2026-09-16T${String(index).padStart(2, "0")}:00:00.000Z`,
      count: index < 6 ? 10 : 1,
    }));
    assert.equal(inferTrendStatus(sampleIssue(), buckets), "declining");
  });
});
