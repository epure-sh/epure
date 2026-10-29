import { useCallback, useId, useRef, useState } from "react";
import type { TimelineBucket } from "../lib/api";
import { cn } from "../lib/cn";
import {
  areaPath,
  buildChartPoints,
  fitExtremesScale,
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
  /** Stretch Y so series min/max sit on the chart edges. */
  fitExtremes?: boolean;
  className?: string;
}

function formatBucketTooltip(start: string): { when: string; detail: string } {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) {
    return { when: "—", detail: "" };
  }
  const when = date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const detail = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return { when, detail };
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
  fitExtremes = false,
  className,
}: OccurrenceLineChartProps) {
  const chartId = useId().replace(/:/g, "");
  const gradientId = `${chartId}-fill`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const orderedBuckets = chronologicalBuckets(buckets);

  // Fit extremes to the plot: bottom flush, small top inset so peaks clear the card header.
  const padding = fitExtremes
    ? { top: 10, right: 0, bottom: 0, left: 0 }
    : {
        top: interactive ? 6 : emphasizeVariation ? 3 : 4,
        right: 2,
        bottom: interactive ? 6 : emphasizeVariation ? 3 : 4,
        left: 2,
      };
  const viewWidth = Math.max(orderedBuckets.length * (interactive ? 6 : 4), 80);
  const viewHeight = height;
  const counts = orderedBuckets.map((bucket) => bucket.count);
  const { minCount, maxCount } = fitExtremes
    ? fitExtremesScale(counts)
    : emphasizeVariation
      ? sparklineScaleFloor(counts)
      : { minCount: 0, maxCount: Math.max(...counts, 1) };
  const points = buildChartPoints(
    orderedBuckets,
    viewWidth,
    viewHeight,
    padding,
    maxCount,
    minCount,
  );
  const chartBounds = { minY: padding.top, maxY: viewHeight - padding.bottom };
  const linePath = smoothLinePath(points, chartBounds);
  // Always close the area against the true SVG bottom so the wash fills the card.
  const fillBaseline = viewHeight;
  const fillPath = areaPath(points, fillBaseline, chartBounds);
  const gridY = [0.25, 0.5, 0.75].map(
    (ratio) => padding.top + (viewHeight - padding.top - padding.bottom) * ratio,
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
  const tipCopy = hovered ? formatBucketTooltip(hovered.bucket.start) : null;
  const hoverLeftPct = hovered ? (hovered.x / viewWidth) * 100 : 0;
  const hoverTopPct = hovered ? (hovered.y / viewHeight) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn("epure-line-chart relative w-full overflow-hidden", className)}
      style={{ height }}
      onMouseMove={interactive ? (event) => updateHover(event.clientX) : undefined}
      onMouseLeave={interactive ? clearHover : undefined}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={chartId}
      >
        <title id={chartId}>{label}</title>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fg-primary, currentColor)" stopOpacity="0.16" />
            <stop offset="55%" stopColor="var(--fg-primary, currentColor)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--fg-primary, currentColor)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {interactive
          ? gridY.map((y) => (
              <line
                key={y}
                x1={padding.left}
                y1={y}
                x2={viewWidth - padding.right}
                y2={y}
                className="stroke-border-subtle/35"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}
        {fillPath ? <path d={fillPath} fill={`url(#${gradientId})`} /> : null}
        <path
          d={linePath}
          fill="none"
          className="stroke-fg-primary"
          strokeWidth={interactive ? 1.5 : 1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {interactive
          ? points.map((point) => {
              const segmentWidth = viewWidth / Math.max(orderedBuckets.length, 1);
              return (
                <rect
                  key={`hit-${point.bucket.start}`}
                  x={point.x - segmentWidth / 2}
                  y={0}
                  width={segmentWidth}
                  height={viewHeight}
                  fill="transparent"
                  className="cursor-crosshair"
                />
              );
            })
          : null}
        {interactive && hovered ? (
          <line
            x1={hovered.x}
            y1={0}
            x2={hovered.x}
            y2={viewHeight}
            className="stroke-fg-primary/25"
            strokeWidth={1}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      {interactive && hovered ? (
        <span
          aria-hidden
          className="pointer-events-none absolute z-[5] block size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-primary ring-[1.5px] ring-surface-1"
          style={{ left: `${hoverLeftPct}%`, top: `${hoverTopPct}%` }}
        />
      ) : null}

      {interactive && hovered && tipCopy ? (
        <div
          className="epure-line-chart-tooltip pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border border-border-subtle bg-surface-1 px-2.5 py-1.5 shadow-tactile"
          style={{ left: tooltipX }}
        >
          <p className="font-mono text-[11px] tabular-nums text-fg-primary">
            {hovered.bucket.count.toLocaleString()}{" "}
            <span className="font-sans text-fg-muted">
              error{hovered.bucket.count === 1 ? "" : "s"}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">{tipCopy.when}</p>
        </div>
      ) : null}
    </div>
  );
}
