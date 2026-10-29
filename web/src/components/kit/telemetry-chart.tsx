import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

export interface TelemetryPoint {
  time: string;
  value: number;
}

export interface TelemetryChartProps {
  data: TelemetryPoint[];
  height?: number;
  color?: "primary" | "escalating" | "regression" | "healthy" | "info";
  className?: string;
  showAxes?: boolean;
  /** Pin Y min/max to the data extremities (no padded domain). */
  fitYToData?: boolean;
  /** Tooltip / axis value suffix, e.g. "ms". */
  valueSuffix?: string;
}

const colorMap = {
  primary: "var(--intent-primary)",
  escalating: "var(--status-escalating)",
  regression: "var(--status-regression)",
  healthy: "var(--status-healthy)",
  info: "var(--status-info)",
};

export function TelemetryChart({
  data,
  height = 140,
  color = "primary",
  className,
  showAxes = true,
  fitYToData = false,
  valueSuffix = "",
}: TelemetryChartProps) {
  const strokeColor = colorMap[color] || colorMap.primary;
  const yDomain = useMemo((): [number, number] | undefined => {
    if (!fitYToData || data.length === 0) return undefined;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const point of data) {
      if (!Number.isFinite(point.value)) continue;
      min = Math.min(min, point.value);
      max = Math.max(max, point.value);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
    if (min === max) {
      const pad = min === 0 ? 1 : Math.abs(min) * 0.05;
      return [min - pad, max + pad];
    }
    return [min, max];
  }, [data, fitYToData]);

  return (
    <div
      data-slot="telemetry-chart"
      className={cn("w-full relative", className)}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          {showAxes && (
            <>
              <XAxis
                dataKey="time"
                stroke="var(--fg-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "var(--border-subtle)" }}
                minTickGap={28}
              />
              <YAxis
                stroke="var(--fg-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "var(--border-subtle)" }}
                allowDecimals
                domain={yDomain ?? ["auto", "auto"]}
                tickFormatter={(v: number) =>
                  valueSuffix ? `${v}${valueSuffix}` : String(v)
                }
                width={44}
              />
            </>
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-xs border border-border-subtle bg-surface-1 px-2 py-1 text-[11px] tabular-nums text-fg-primary">
                    <span className="font-mono text-fg-muted">{label}: </span>
                    <span className="font-semibold">
                      {payload[0].value}
                      {valueSuffix}
                    </span>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            fillOpacity={1}
            fill={`url(#gradient-${color})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
