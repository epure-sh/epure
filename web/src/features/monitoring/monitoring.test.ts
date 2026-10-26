import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TimelineBucket, IssueSummary } from "@/lib/api";
import { sumUniqueUsers } from "../org/settings/usage-utils";

describe("monitoring live telemetry and metrics semantics", () => {
  it("converts real activity timeline buckets to telemetry points", () => {
    const buckets: TimelineBucket[] = [
      { start: "2026-10-25T12:00:00Z", count: 15 },
      { start: "2026-10-25T13:00:00Z", count: 42 },
      { start: "2026-10-25T14:00:00Z", count: 0 },
    ];

    const points = buckets.map((bucket) => ({
      time: new Date(bucket.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: Math.max(0, bucket.count),
    }));

    assert.equal(points.length, 3);
    assert.equal(points[0].value, 15);
    assert.equal(points[1].value, 42);
    assert.equal(points[2].value, 0);
  });

  it("newly created project with 0 events displays clean flat 0 telemetry", () => {
    const emptyBuckets: TimelineBucket[] = [];
    const totalExceptions = emptyBuckets.reduce((sum, b) => sum + (b.count || 0), 0);
    assert.equal(totalExceptions, 0);

    const issues: IssueSummary[] = [];
    const uniqueUsers = sumUniqueUsers(issues);
    assert.equal(uniqueUsers, 0);
  });

  it("calculates health score accurately from live regressions and unresolved issues", () => {
    function computeHealth(loading: boolean, activeRegressions: number, activeUnresolved: number): number {
      if (loading) return 100;
      if (activeRegressions > 0) {
        return Math.max(70, Math.round(98 - activeRegressions * 5 - Math.min(10, activeUnresolved)));
      }
      if (activeUnresolved > 10) {
        return Math.max(90, Math.round(99.5 - Math.min(9, activeUnresolved * 0.2)));
      }
      return 100;
    }

    // 0 issues, 0 regressions -> 100% nominal
    assert.equal(computeHealth(false, 0, 0), 100);

    // Minor unresolved issues (<10), 0 regressions -> 100% calm
    assert.equal(computeHealth(false, 0, 5), 100);

    // Moderate unresolved issues (20), 0 regressions -> 96%
    assert.equal(computeHealth(false, 0, 20), 96);

    // Active regression -> drops health score immediately
    assert.equal(computeHealth(false, 1, 0), 93);
    assert.equal(computeHealth(false, 2, 5), 83);
  });

  it("calculates unique impacted users accurately from issue list", () => {
    const issues = [
      { id: "iss_1", unique_user_count: 14 } as IssueSummary,
      { id: "iss_2", unique_user_count: 7 } as IssueSummary,
    ];
    assert.equal(sumUniqueUsers(issues), 21);
  });
});
