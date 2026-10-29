import { useState } from "react";
import { cn } from "../lib/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

export type TrendStatus = "ongoing" | "escalating" | "declining";

export interface SparklinePoint {
  value: number;
  /** ISO timestamp for the bucket start (hover). */
  at?: string;
  /** Optional preformatted hover primary line. */
  label?: string;
}

export interface SparklineProps {
  values?: number[];
  /** Preferred over `values` when timestamps / hover copy matter. */
  points?: SparklinePoint[];
  /** Optional per-bar labels (legacy); prefer `points[].label` / `points[].at`. */
  labels?: string[];
  status?: TrendStatus;
  /** Chart bars only — no status caption under the sparkline. */
  compact?: boolean;
  /**
   * Taller track that always fills container width (no horizontal scroll).
   * Use for occurrence trends (Context) — not the feed-row micro spark.
   */
  prominent?: boolean;
  /**
   * Map the series min to the floor and max to the ceiling so the
   * extremities fill the track (relative range, not zero-based).
   */
  scaleToExtent?: boolean;
  /**
   * Abscissa labels under the track — hours for a 24h window, days otherwise.
   * Prominent charts only.
   */
  xAxis?: "hours" | "days";
  className?: string;
}

function inferTrendStatus(values: number[]): TrendStatus {
  if (values.length < 4) {
    return "ongoing";
  }
  const recent = values.slice(-4).reduce((sum, value) => sum + value, 0);
  const earlier = values.slice(-8, -4).reduce((sum, value) => sum + value, 0);
  if (recent > earlier * 1.35) {
    return "escalating";
  }
  if (recent < earlier * 0.65) {
    return "declining";
  }
  return "ongoing";
}

const STATUS_LABEL: Record<TrendStatus, string> = {
  ongoing: "Ongoing",
  escalating: "Escalating",
  declining: "Declining",
};

function formatHoverTimestamp(iso: string, unit: "hours" | "days" = "hours"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  if (unit === "days") {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAxisTick(iso: string, unit: "hours" | "days"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  if (unit === "hours") {
    return date.toLocaleTimeString(undefined, { hour: "numeric" });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Evenly spaced tick indices including first and last. */
function axisTickIndices(length: number, maxTicks = 6): Set<number> {
  const ticks = new Set<number>();
  if (length <= 0) {
    return ticks;
  }
  if (length <= maxTicks) {
    for (let i = 0; i < length; i += 1) {
      ticks.add(i);
    }
    return ticks;
  }
  for (let i = 0; i < maxTicks; i += 1) {
    ticks.add(Math.round((i * (length - 1)) / (maxTicks - 1)));
  }
  return ticks;
}

function barHeightPercent(
  value: number,
  values: number[],
  opts: { compact: boolean; prominent: boolean; scaleToExtent: boolean },
): number {
  const max = Math.max(...values, 1);
  const min = opts.scaleToExtent ? Math.min(...values) : 0;
  const range = Math.max(max - min, 1);
  const ratio = (value - min) / range;
  // Zero buckets stay tiny; non-zero use the extent scale.
  if (value <= 0) {
    return opts.prominent ? 6 : 8;
  }
  const floor = opts.prominent ? 14 : opts.compact ? 18 : 14;
  return Math.max(floor, ratio * 100);
}

function resolvePoints(
  points: SparklinePoint[] | undefined,
  values: number[] | undefined,
  labels: string[] | undefined,
): SparklinePoint[] {
  if (points && points.length > 0) {
    return points;
  }
  return (values ?? []).map((value, index) => ({
    value,
    label: labels?.[index],
  }));
}

function barFillClass(
  value: number,
  status: TrendStatus,
  opts: { hovered: boolean },
): string {
  if (value <= 0) {
    return opts.hovered ? "bg-fg-muted/40" : "bg-fg-muted/25";
  }
  if (status === "escalating") {
    return opts.hovered ? "bg-semantic-danger" : "bg-semantic-danger/70";
  }
  return opts.hovered ? "bg-fg-primary" : "bg-fg-primary/80";
}

export function Sparkline({
  values,
  points: pointsProp,
  labels,
  status,
  compact = false,
  prominent = false,
  scaleToExtent = false,
  xAxis,
  className,
}: SparklineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const points = resolvePoints(pointsProp, values, labels);
  const series = points.map((point) => point.value);
  const resolvedStatus = status ?? inferTrendStatus(series);
  const interactive = prominent;
  const tickIndices = xAxis && prominent ? axisTickIndices(points.length) : null;
  const gapClass = prominent ? "gap-1 sm:gap-1.5" : compact ? "gap-0.5" : "gap-0.5";

  const track = (
    <div
      className={cn(
        "relative flex w-full min-w-0 max-w-full items-end",
        gapClass,
        // Keep overflow visible so hover tooltips aren't clipped.
        prominent ? "h-16 overflow-visible sm:h-20" : "overflow-hidden",
        !prominent && (compact ? "h-5" : "h-8"),
      )}
      onMouseLeave={interactive ? () => setHoveredIndex(null) : undefined}
    >
      {points.map((point, index) => {
        const height = `${barHeightPercent(point.value, series, {
          compact,
          prominent,
          scaleToExtent,
        })}%`;
        const isHovered = hoveredIndex === index;
        const dimOthers = hoveredIndex != null && !isHovered;
        const fill = barFillClass(point.value, resolvedStatus, { hovered: isHovered });
        const dateLabel =
          point.label ??
          (point.at ? formatHoverTimestamp(point.at, xAxis ?? "hours") : "—");
        const errorNoun = point.value === 1 ? "error" : "errors";

        const bar = (
          <span
            className={cn(
              "block w-full origin-bottom transition-[opacity,background-color] duration-100",
              prominent ? "rounded-[3px]" : "min-h-[3px] rounded-sm",
              fill,
              isHovered && "opacity-100",
              dimOthers && "opacity-45",
            )}
            style={{ height }}
          />
        );

        if (!interactive) {
          return (
            <span key={point.at ?? index} className="relative flex h-full min-w-0 flex-1 basis-0 items-end">
              {bar}
            </span>
          );
        }

        return (
          <Tooltip key={point.at ?? index} delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="relative flex h-full min-w-0 flex-1 basis-0 cursor-default items-end border-0 bg-transparent p-0 outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={`${dateLabel}: ${point.value.toLocaleString()} ${errorNoun}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex((current) => (current === index ? null : current))}
              >
                {bar}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={6}
              className="z-[90] max-w-[14rem] px-2 py-1.5 text-left"
            >
              <p className="text-[10px] text-fg-muted">{dateLabel}</p>
              <p className="mt-0.5 text-xs font-medium tabular-nums text-fg-primary">
                {point.value.toLocaleString()} {errorNoun}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );

  return (
    <div
      className={cn(
        "epure-sparkline flex min-w-0 flex-col",
        compact || prominent ? "gap-0" : "gap-0.5",
        className,
      )}
      aria-label={STATUS_LABEL[resolvedStatus]}
    >
      {interactive ? (
        <TooltipProvider delayDuration={0}>{track}</TooltipProvider>
      ) : (
        track
      )}

      {xAxis && prominent && tickIndices && points.length > 0 ? (
        <div
          className={cn("mt-1.5 flex w-full min-w-0", gapClass)}
          aria-hidden
        >
          {points.map((point, index) => (
            <span
              key={`tick-${point.at ?? index}`}
              className="min-w-0 flex-1 basis-0 whitespace-nowrap text-center font-mono text-[9px] leading-none text-fg-muted"
            >
              {tickIndices.has(index) && point.at
                ? formatAxisTick(point.at, xAxis)
                : null}
            </span>
          ))}
        </div>
      ) : null}

      {compact || prominent ? null : (
        <span
          className={cn(
            "text-2xs leading-none",
            resolvedStatus === "escalating"
              ? "text-semantic-danger"
              : "text-ink-muted",
          )}
        >
          {STATUS_LABEL[resolvedStatus]}
        </span>
      )}
    </div>
  );
}

/** Fixed bar count for every time window — width stays identical; only interval length changes. */
export const SPARKLINE_BAR_COUNT = 24;

/** @deprecated Always returns `SPARKLINE_BAR_COUNT` — kept for call-site compatibility. */
export function sparklineBarCountForWindow(_window?: string): number {
  return SPARKLINE_BAR_COUNT;
}

function windowDurationMs(window: string): number {
  switch (window) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "14d":
      return 14 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    case "90d":
      return 90 * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Always `SPARKLINE_BAR_COUNT` bars filling the track. The selected window only
 * changes how much real time each bar covers; counts come from real buckets.
 */
export function fillSparklineWindow(
  buckets: ReadonlyArray<{ start: string; count: number }>,
  window: string,
  now = Date.now(),
): SparklinePoint[] {
  const count = SPARKLINE_BAR_COUNT;
  const durationMs = windowDurationMs(window);
  const stepMs = durationMs / count;
  const rangeEnd = now;
  const rangeStart = rangeEnd - durationMs;

  const points: SparklinePoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const slotStart = rangeStart + i * stepMs;
    const slotEnd = slotStart + stepMs;
    let value = 0;
    for (const bucket of buckets) {
      const t = new Date(bucket.start).getTime();
      if (Number.isNaN(t)) continue;
      const inSlot =
        t >= slotStart && (i === count - 1 ? t <= rangeEnd : t < slotEnd);
      if (inSlot) {
        value += bucket.count;
      }
    }
    const at = new Date(slotStart).toISOString();
    points.push({ at, value });
  }
  return points;
}

/** @deprecated Prefer `fillSparklineWindow` — kept for callers that only downsample. */
export function downsampleSparkValues(
  values: number[],
  labels: string[] | undefined,
  target: number,
): { values: number[]; labels?: string[] } {
  if (values.length <= target || target < 1) {
    return { values, labels };
  }

  const nextValues: number[] = [];
  const nextLabels: string[] | undefined = labels ? [] : undefined;

  for (let i = 0; i < target; i += 1) {
    const start = Math.floor((i / target) * values.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / target) * values.length));
    let sum = 0;
    for (let j = start; j < end; j += 1) {
      sum += values[j] ?? 0;
    }
    nextValues.push(sum);
    if (nextLabels && labels) {
      nextLabels.push(labels[start] ?? labels[Math.min(end - 1, labels.length - 1)] ?? "");
    }
  }

  return { values: nextValues, labels: nextLabels };
}
