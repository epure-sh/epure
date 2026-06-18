import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChartPoints,
  maxPathY,
  smoothLinePath,
} from "./occurrence-line-chart-path";

const padding = { top: 6, right: 2, bottom: 6, left: 2 };
const height = 140;
const baseline = height - padding.bottom;

function bucket(count: number, start = "2026-09-16T12:00:00Z") {
  return { start, count };
}

describe("occurrence-line-chart-path", () => {
  it("does not dip below the zero baseline when rising from flat zeros", () => {
    const buckets = [
      bucket(0, "2026-09-16T10:00:00Z"),
      bucket(0, "2026-09-16T11:00:00Z"),
      bucket(12, "2026-09-16T12:00:00Z"),
      bucket(0, "2026-09-16T13:00:00Z"),
    ];
    const viewWidth = 240;
    const points = buildChartPoints(buckets, viewWidth, height, padding, 12);
    const path = smoothLinePath(points, { minY: padding.top, maxY: baseline });

    assert.ok(maxPathY(path, padding.top) <= baseline + 0.01);
  });

  it("does not overshoot downward on monotonic increases", () => {
    const buckets = [
      bucket(0, "2026-09-16T10:00:00Z"),
      bucket(5, "2026-09-16T11:00:00Z"),
      bucket(15, "2026-09-16T12:00:00Z"),
      bucket(20, "2026-09-16T13:00:00Z"),
    ];
    const viewWidth = 240;
    const points = buildChartPoints(buckets, viewWidth, height, padding, 20);
    const path = smoothLinePath(points, { minY: padding.top, maxY: baseline });

    assert.ok(maxPathY(path, padding.top) <= baseline + 0.01);
  });
});
