import { useCallback, useId, useRef, useState } from "react";
import type { TimelineBucket } from "../lib/api";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";
import {
  areaPath,
  buildChartPoints,
  smoothLinePath,
  sparklineScaleFloor,
} from "./occurrence-line-chart-path";

export interface OccurrenceLineChartProps {
  buckets: TimelineBucket[];
  label?: string;
  height?: number;
  interactive?: boolean;
  /** Lift the Y floor when values cluster high so small swings stay visible. */
  emphasizeVariation?: boolean;
  className?: string;
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

function indexAtX(clientX: number, rect: DOMRect, bucketCount: number): number {
  if (bucketCount <= 1) {
    return 0;
  }
  const ratio = (clientX - rect.left) / rect.width;
  return Math.min(bucketCount - 1, Math.max(0, Math.round(ratio * (bucketCount - 1))));
}

function chronologicalBuckets(buckets: TimelineBucket[]): TimelineBucket[] {
  return [...buckets].sort(
    (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime(),
  );
}

export function OccurrenceLineChart({
  buckets,
  label = "Occurrence count",
  height = 56,
  interactive = true,
  emphasizeVariation = false,
  className,
}: OccurrenceLineChartProps) {
  const chartId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const orderedBuckets = chronologicalBuckets(buckets);

  const padding = {
    top: interactive ? 6 : emphasizeVariation ? 3 : 4,
    right: 2,
    bottom: interactive ? 6 : emphasizeVariation ? 3 : 4,
    left: 2,
  };
  const viewWidth = Math.max(orderedBuckets.length * (interactive ? 6 : 4), 80);
  const counts = orderedBuckets.map((bucket) => bucket.count);
  const { minCount, maxCount } = emphasizeVariation
    ? sparklineScaleFloor(counts)
    : { minCount: 0, maxCount: Math.max(...counts, 1) };
  const points = buildChartPoints(
    orderedBuckets,
    viewWidth,
    height,
    padding,
    maxCount,
    minCount,
  );
  const chartBounds = { minY: padding.top, maxY: height - padding.bottom };
  const linePath = smoothLinePath(points, chartBounds);
  const fillPath = areaPath(points, height - padding.bottom, chartBounds);
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
      const index = indexAtX(clientX, rect, orderedBuckets.length);
      setHoveredIndex(index);
      setTooltipX(Math.min(rect.width - 8, Math.max(8, clientX - rect.left)));
    },
    [orderedBuckets.length, interactive],
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
          strokeLinecap="round"
          strokeLinejoin="round"
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
              const segmentWidth = viewWidth / orderedBuckets.length;
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
