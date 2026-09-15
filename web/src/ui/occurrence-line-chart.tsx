import { useCallback, useId, useRef, useState } from "react";
import type { TimelineBucket } from "../lib/api";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";

export interface OccurrenceLineChartProps {
  buckets: TimelineBucket[];
  label?: string;
  height?: number;
  interactive?: boolean;
  className?: string;
}

interface ChartPoint {
  x: number;
  y: number;
  bucket: TimelineBucket;
  index: number;
}

function formatBucketTime(start: string): string {
  const relative = formatRelativeTime(start);
  if (relative === new Date(start).toLocaleDateString()) {
    return new Date(start).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return relative;
}

function buildChartPoints(
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

function smoothLinePath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function areaPath(points: ChartPoint[], baseline: number): string {
  if (points.length === 0) {
    return "";
  }
  const line = smoothLinePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

function indexAtX(clientX: number, rect: DOMRect, bucketCount: number): number {
  if (bucketCount <= 1) {
    return 0;
  }
  const ratio = (clientX - rect.left) / rect.width;
  return Math.min(bucketCount - 1, Math.max(0, Math.round(ratio * (bucketCount - 1))));
}

export function OccurrenceLineChart({
  buckets,
  label = "Occurrence count",
  height = 56,
  interactive = true,
  className,
}: OccurrenceLineChartProps) {
  const chartId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);

  const padding = {
    top: interactive ? 6 : 4,
    right: 2,
    bottom: interactive ? 6 : 4,
    left: 2,
  };
  const viewWidth = Math.max(buckets.length * (interactive ? 6 : 4), 80);
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const points = buildChartPoints(buckets, viewWidth, height, padding, maxCount);
  const linePath = smoothLinePath(points);
  const fillPath = areaPath(points, height - padding.bottom);
  const gridY = [0.25, 0.5, 0.75].map(
    (ratio) => padding.top + (height - padding.top - padding.bottom) * ratio,
  );

  const updateHover = useCallback(
    (clientX: number) => {
      if (!interactive) {
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const index = indexAtX(clientX, rect, buckets.length);
      setHoveredIndex(index);
      setTooltipX(Math.min(rect.width - 8, Math.max(8, clientX - rect.left)));
    },
    [buckets.length, interactive],
  );

  const clearHover = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  const hovered = hoveredIndex != null ? points[hoveredIndex] : null;

  return (
    <div
      ref={containerRef}
      className={cn("epure-line-chart relative w-full", className)}
      style={{ height }}
      onMouseMove={interactive ? (event) => updateHover(event.clientX) : undefined}
      onMouseLeave={interactive ? clearHover : undefined}
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${viewWidth} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={chartId}
      >
        <title id={chartId}>{label}</title>
        {interactive
          ? gridY.map((y) => (
              <line
                key={y}
                x1={padding.left}
                y1={y}
                x2={viewWidth - padding.right}
                y2={y}
                className="stroke-border/30"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}
        {fillPath ? (
          <path d={fillPath} className="fill-accent/10" vectorEffect="non-scaling-stroke" />
        ) : null}
        <path
          d={linePath}
          fill="none"
          className="stroke-accent"
          strokeWidth={interactive ? 1.5 : 1.25}
          vectorEffect="non-scaling-stroke"
        />
        {interactive
          ? points.map((point) => (
              <circle
                key={point.bucket.start}
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === point.index ? 3 : 0}
                className="fill-accent"
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}
        {interactive
          ? points.map((point) => {
              const segmentWidth = viewWidth / buckets.length;
              return (
                <rect
                  key={`hit-${point.bucket.start}`}
                  x={point.x - segmentWidth / 2}
                  y={0}
                  width={segmentWidth}
                  height={height}
                  fill="transparent"
                  className="cursor-crosshair"
                />
              );
            })
          : null}
        {interactive && hovered ? (
          <line
            x1={hovered.x}
            y1={padding.top}
            x2={hovered.x}
            y2={height - padding.bottom}
            className="stroke-accent/40"
            strokeWidth={1}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {interactive && hovered ? (
        <div
          className="epure-line-chart-tooltip epure-tooltip-content pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-xs"
          style={{ left: tooltipX }}
        >
          <span className="text-ink-muted">{formatBucketTime(hovered.bucket.start)}</span>
          <span className="mx-1 text-ink-muted">·</span>
          <span className="font-medium text-ink">
            {hovered.bucket.count.toLocaleString()}
          </span>
        </div>
      ) : null}
    </div>
  );
}
