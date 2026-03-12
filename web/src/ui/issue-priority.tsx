import { cn } from "../lib/cn";

export type IssuePriority = "critical" | "high" | "medium" | "low";

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_BARS: Record<IssuePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function resolveIssuePriority(
  level?: string | null,
  status?: string | null,
): IssuePriority {
  if (status === "regression") {
    return "critical";
  }

  switch (level?.toLowerCase()) {
    case "fatal":
      return "critical";
    case "error":
      return "high";
    case "warning":
      return "medium";
    case "info":
    case "debug":
      return "low";
    default:
      return "low";
  }
}

function priorityColorClass(priority: IssuePriority): string {
  switch (priority) {
    case "critical":
      return "text-semantic-danger";
    case "high":
      return "text-semantic-danger/90";
    case "medium":
      return "text-semantic-warning";
    default:
      return "text-ink-muted";
  }
}

/** Four ascending bars — industry-standard priority meter (Sentry/PagerDuty style). */
function PriorityBars({
  priority,
  size = 16,
  className,
}: {
  priority: IssuePriority;
  size?: number;
  className?: string;
}) {
  const activeBars = PRIORITY_BARS[priority];
  const heights = [5, 8, 11, 14];
  const barWidth = 2.5;
  const gap = 1.5;
  const viewWidth = barWidth * 4 + gap * 3;
  const viewHeight = 14;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      className={cn("shrink-0", priorityColorClass(priority), className)}
      aria-hidden
    >
      {heights.map((height, index) => {
        const x = index * (barWidth + gap);
        const y = viewHeight - height;
        const active = index < activeBars;
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={height}
            rx={0.75}
            fill="currentColor"
            opacity={active ? 1 : 0.18}
          />
        );
      })}
    </svg>
  );
}

export interface IssuePriorityIconProps {
  level?: string | null;
  status?: string | null;
  size?: number;
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
}

export function IssuePriorityIcon({
  level,
  status,
  size = 16,
  className,
  showLabel = false,
  labelClassName,
}: IssuePriorityIconProps) {
  const priority = resolveIssuePriority(level, status);
  const label = PRIORITY_LABEL[priority];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={`${label} priority`}
    >
      <PriorityBars priority={priority} size={size} />
      {showLabel ? (
        <span className={cn("text-sm font-medium text-ink", labelClassName)}>
          {label}
        </span>
      ) : (
        <span className="sr-only">{label} priority</span>
      )}
    </span>
  );
}

export interface IssuePriorityBadgeProps {
  level?: string | null;
  status?: string | null;
  compact?: boolean;
  className?: string;
}

/** Overview / header chip with icon + level name */
export function IssuePriorityBadge({
  level,
  status,
  compact = false,
  className,
}: IssuePriorityBadgeProps) {
  const priority = resolveIssuePriority(level, status);

  return (
    <span
      className={cn(
        "epure-priority-badge inline-flex items-center rounded-md border font-medium",
        compact ? "h-4 gap-1 px-1.5 text-2xs leading-none" : "gap-1.5 px-2 py-0.5 text-xs",
        priority === "critical" && "border-semantic-danger/30 bg-semantic-danger/10 text-semantic-danger",
        priority === "high" && "border-semantic-danger/20 bg-semantic-danger/5 text-semantic-danger",
        priority === "medium" && "border-semantic-warning/30 bg-semantic-warning/10 text-semantic-warning",
        priority === "low" && "border-border bg-bg-subtle text-ink-muted",
        className,
      )}
    >
      <PriorityBars priority={priority} size={compact ? 10 : 14} />
      {PRIORITY_LABEL[priority]}
      {!compact && level ? (
        <span className="font-normal opacity-80">· {level}</span>
      ) : null}
    </span>
  );
}

export function getIssuePriorityLabel(
  level?: string | null,
  status?: string | null,
): string {
  return PRIORITY_LABEL[resolveIssuePriority(level, status)];
}
