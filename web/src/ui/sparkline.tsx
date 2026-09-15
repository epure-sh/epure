import { cn } from "../lib/cn";

export type TrendStatus = "ongoing" | "escalating" | "declining";

export interface SparklineProps {
  values: number[];
  status?: TrendStatus;
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

export function Sparkline({ values, status, className }: SparklineProps) {
  const resolvedStatus = status ?? inferTrendStatus(values);
  const max = Math.max(...values, 1);

  return (
    <div className={cn("epure-sparkline flex min-w-0 flex-col gap-0.5", className)}>
      <div className="flex h-7 items-end gap-px" aria-hidden>
        {values.map((value, index) => (
          <span
            key={index}
            className={cn(
              "w-[3px] min-h-[2px] rounded-[1px]",
              resolvedStatus === "escalating"
                ? "bg-semantic-danger/70"
                : "bg-ink-muted/35",
            )}
            style={{ height: `${Math.max(12, (value / max) * 100)}%` }}
          />
        ))}
      </div>
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
    </div>
  );
}
