import type { TimelineBucket } from "../lib/api";

export interface ChartPoint {
  x: number;
  y: number;
  bucket: TimelineBucket;
  index: number;
}

export function buildChartPoints(
  buckets: TimelineBucket[],
  viewWidth: number,
  viewHeight: number,
  padding: { top: number; right: number; bottom: number; left: number },
  maxCount: number,
): ChartPoint[] {
  const innerWidth = viewWidth - padding.left - padding.right;
  const innerHeight = viewHeight - padding.top - padding.bottom;
  const step = buckets.length > 1 ? innerWidth / (buckets.length - 1) : 0;

  return buckets.map((bucket, index) => {
    const x = padding.left + step * index;
    const ratio = maxCount > 0 ? bucket.count / maxCount : 0;
    const y = padding.top + innerHeight * (1 - ratio);
    return { x, y, bucket, index };
  });
}

function clampY(y: number, minY: number, maxY: number): number {
  return Math.min(maxY, Math.max(minY, y));
}

/** Fritsch–Carlson monotone cubic tangents (no overshoot). */
function monotoneTangents(points: ChartPoint[]): number[] {
  const count = points.length;
  const tangents = new Array<number>(count).fill(0);
  if (count < 2) {
    return tangents;
  }

  const slopes: number[] = [];
  for (let index = 0; index < count - 1; index++) {
    const dx = points[index + 1].x - points[index].x;
    slopes.push(dx === 0 ? 0 : (points[index + 1].y - points[index].y) / dx);
  }

  tangents[0] = slopes[0];
  tangents[count - 1] = slopes[count - 2];
  for (let index = 1; index < count - 1; index++) {
    if (slopes[index - 1] * slopes[index] <= 0) {
      tangents[index] = 0;
    } else {
      tangents[index] = (slopes[index - 1] + slopes[index]) / 2;
    }
  }

  for (let index = 0; index < count - 1; index++) {
    if (Math.abs(slopes[index]) < 1e-8) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const alpha = tangents[index] / slopes[index];
    const beta = tangents[index + 1] / slopes[index];
    const sumSquares = alpha * alpha + beta * beta;
    if (sumSquares > 9) {
      const tau = 3 / Math.sqrt(sumSquares);
      tangents[index] = tau * alpha * slopes[index];
      tangents[index + 1] = tau * beta * slopes[index];
    }
  }

  return tangents;
}

/** Monotone cubic (Hermite → cubic Bézier). Control points clamped to the chart bounds. */
export function smoothLinePath(
  points: ChartPoint[],
  bounds?: { minY: number; maxY: number },
): string {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  const minY = bounds?.minY ?? Math.min(...points.map((point) => point.y));
  const maxY = bounds?.maxY ?? Math.max(...points.map((point) => point.y));
  const tangents = monotoneTangents(points);

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const cp1x = start.x + dx / 3;
    const cp1y = clampY(start.y + (tangents[index] * dx) / 3, minY, maxY);
    const cp2x = end.x - dx / 3;
    const cp2y = clampY(end.y - (tangents[index + 1] * dx) / 3, minY, maxY);
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
  }
  return path;
}

export function areaPath(
  points: ChartPoint[],
  baseline: number,
  bounds?: { minY: number; maxY: number },
): string {
  if (points.length === 0) {
    return "";
  }
  const line = smoothLinePath(points, bounds);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

/** Sample cubic-bezier segments to find the maximum Y (lowest on-screen position). */
export function maxPathY(path: string, fallback: number): number {
  const commands = path.match(/[MC][^MC]*/g);
  if (!commands) {
    return fallback;
  }

  let maxY = fallback;
  let cursor = { x: 0, y: 0 };

  for (const command of commands) {
    const parts = command
      .trim()
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    if (command.startsWith("M")) {
      cursor = { x: parts[0], y: parts[1] };
      maxY = Math.max(maxY, cursor.y);
      continue;
    }

    if (command.startsWith("C")) {
      const [, cp1y, , cp2y, , y] = parts;
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const sampleY = cubicBezier(cursor.y, cp1y, cp2y, y, t);
        maxY = Math.max(maxY, sampleY);
      }
      cursor = { x: parts[4], y };
    }
  }

  return maxY;
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const inverse = 1 - t;
  return (
    inverse ** 3 * p0 +
    3 * inverse ** 2 * t * p1 +
    3 * inverse * t ** 2 * p2 +
    t ** 3 * p3
  );
}
