import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPARKLINE_BAR_COUNT,
  fillSparklineWindow,
  sparklineBarCountForWindow,
} from "./sparkline";

describe("fillSparklineWindow", () => {
  it("always returns the same bar count for every window", () => {
    const now = Date.parse("2026-10-29T15:30:00.000Z");
    const buckets = [
      { start: "2026-10-28T08:00:00.000Z", count: 4 },
      { start: "2026-10-29T10:00:00.000Z", count: 9 },
    ];

    for (const window of ["24h", "7d", "14d", "30d"] as const) {
      const points = fillSparklineWindow(buckets, window, now);
      assert.equal(points.length, SPARKLINE_BAR_COUNT);
      assert.equal(points.length, sparklineBarCountForWindow(window));
    }
  });

  it("aggregates real counts into fixed slots across the window", () => {
    const now = Date.parse("2026-10-29T12:00:00.000Z");
    const points = fillSparklineWindow(
      [
        { start: "2026-10-28T08:00:00.000Z", count: 4 },
        { start: "2026-10-29T10:00:00.000Z", count: 9 },
      ],
      "7d",
      now,
    );

    assert.equal(points.length, SPARKLINE_BAR_COUNT);
    assert.equal(points.reduce((sum, point) => sum + point.value, 0), 13);
    assert.ok(points.every((point) => typeof point.at === "string"));
  });

  it("keeps quiet slots as zero instead of dropping them", () => {
    const now = Date.parse("2026-10-29T12:00:00.000Z");
    const points = fillSparklineWindow(
      [{ start: "2026-10-29T01:00:00.000Z", count: 2 }],
      "7d",
      now,
    );
    assert.equal(points.length, SPARKLINE_BAR_COUNT);
    assert.equal(points.filter((point) => point.value === 0).length, SPARKLINE_BAR_COUNT - 1);
    assert.equal(points.reduce((sum, point) => sum + point.value, 0), 2);
  });
});
