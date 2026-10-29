import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

export interface VelocityPoint {
  time: string;
  handled: number;
  unhandled: number;
}

export interface VelocityReleaseMarker {
  time: string;
  label: string;
}

export interface VelocityChartProps {
  data: VelocityPoint[];
  height?: number;
  markers?: VelocityReleaseMarker[];
  className?: string;
}

export function VelocityChart({
  data,
  height = 200,
  markers = [],
  className,
}: VelocityChartProps) {
  return (
    <div data-slot="velocity-chart" className={cn("w-full relative", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 12, right: 8, left: -20, bottom: 0 }} barCategoryGap="10%" barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            stroke="var(--fg-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "var(--border-subtle)" }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            stroke="var(--fg-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", opacity: 0.55 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const handled = Number(payload.find((p) => p.dataKey === "handled")?.value ?? 0);
              const unhandled = Number(payload.find((p) => p.dataKey === "unhandled")?.value ?? 0);
              return (
                <div className="rounded-xs border border-border-strong bg-surface-1 px-2.5 py-1.5 text-[11px] shadow-float tabular-nums">
                  <p className="font-mono text-fg-muted">{label}</p>
                  <p className="mt-0.5 text-fg-primary">
                    <span className="text-fg-secondary">Handled</span> {handled.toLocaleString()}
                  </p>
                  <p className="text-escalating">
                    <span className="text-fg-secondary">Unhandled</span> {unhandled.toLocaleString()}
                  </p>
                </div>
              );
            }}
          />
          {markers.map((marker) => (
            <ReferenceLine
              key={`${marker.time}-${marker.label}`}
              x={marker.time}
              stroke="var(--fg-muted)"
              strokeDasharray="3 3"
              label={{
                value: marker.label,
                position: "top",
                fill: "var(--fg-muted)",
                fontSize: 10,
              }}
            />
          ))}
          <Bar
            dataKey="handled"
            stackId="velocity"
            fill="var(--fg-primary)"
            radius={[0, 0, 6, 6]}
            isAnimationActive={false}
            maxBarSize={28}
          />
          <Bar
            dataKey="unhandled"
            stackId="velocity"
            fill="var(--status-escalating)"
            radius={[6, 6, 0, 0]}
            isAnimationActive={false}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
