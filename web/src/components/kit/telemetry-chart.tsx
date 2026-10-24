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
}: TelemetryChartProps) {
  const strokeColor = colorMap[color] || colorMap.primary;

  return (
    <div
      data-slot="telemetry-chart"
      className={cn("w-full relative", className)}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
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
              />
              <YAxis
                stroke="var(--fg-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "var(--border-subtle)" }}
                allowDecimals={false}
              />
            </>
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-xs border border-border-strong bg-surface-1 px-2 py-1 text-[11px] shadow-float tabular-nums text-fg-primary">
                    <span className="text-fg-muted font-mono">{label}: </span>
                    <span className="font-semibold">{payload[0].value}</span>
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
