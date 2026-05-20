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

  it("uses cubic bezier segments instead of a polyline", () => {
    const buckets = [
      bucket(2, "2026-09-16T10:00:00Z"),
      bucket(8, "2026-09-16T11:00:00Z"),
      bucket(5, "2026-09-16T12:00:00Z"),
      bucket(14, "2026-09-16T13:00:00Z"),
    ];
    const points = buildChartPoints(buckets, 240, height, padding, 14);
    const path = smoothLinePath(points, { minY: padding.top, maxY: baseline });

    assert.match(path, /^M /);
    assert.match(path, / C /);
    assert.equal(path.includes(" L "), false);
  });

  it("expands mid-range swings when a floor is supplied", () => {
    const buckets = [
      bucket(80, "2026-09-16T10:00:00Z"),
      bucket(90, "2026-09-16T11:00:00Z"),
      bucket(85, "2026-09-16T12:00:00Z"),
      bucket(95, "2026-09-16T13:00:00Z"),
    ];
    const fromZero = buildChartPoints(buckets, 240, height, padding, 95, 0);
    const fromFloor = buildChartPoints(buckets, 240, height, padding, 95, 70);
    const zeroSpread = Math.abs(fromZero[1].y - fromZero[0].y);
    const floorSpread = Math.abs(fromFloor[1].y - fromFloor[0].y);
    assert.ok(floorSpread > zeroSpread);
  });
});
