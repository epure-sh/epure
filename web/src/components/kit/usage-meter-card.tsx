import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface UsageMeterCardProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  warningThreshold?: number; // 0..1 default 0.8
  criticalThreshold?: number; // 0..1 default 0.95
  className?: string;
}

export function UsageMeterCard({
  label,
  used,
  limit,
  unit = "events",
  warningThreshold = 0.8,
  criticalThreshold = 0.95,
  className,
}: UsageMeterCardProps) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  const percent = Math.round(ratio * 100);

  let status: "healthy" | "regression" | "escalating" = "healthy";
  let statusText = "Normal";

  if (ratio >= criticalThreshold) {
    status = "escalating";
    statusText = "Exceeded";
  } else if (ratio >= warningThreshold) {
    status = "regression";
    statusText = "Near Limit";
  }

  const fillClass =
    status === "escalating"
      ? "bg-escalating"
      : status === "regression"
        ? "bg-regression"
        : "bg-healthy";

  return (
    <div
      data-slot="usage-meter-card"
      className={cn(
        "rounded-panel border border-border-subtle bg-surface-1 p-4 shadow-tactile flex flex-col gap-2.5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-primary">{label}</span>
        <Badge variant={status} size="sm">
          {statusText}
        </Badge>
      </div>

      <div className="flex items-baseline justify-between font-mono text-[11px] tabular-nums">
        <span className="text-fg-primary font-medium">
          {used.toLocaleString()}{" "}
          <span className="text-fg-muted font-normal">/ {limit.toLocaleString()} {unit}</span>
        </span>
        <span className="text-fg-secondary">{percent}%</span>
      </div>

      <Progress value={percent} indicatorClassName={fillClass} />
    </div>
  );
}
