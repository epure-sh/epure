// web/src/ui/components/issue-priority.tsx
// Tier 2 Component: Issue Priority Indicator, Badge & Resolvers

import { cn } from "@/lib/cn";
import { Badge, type BadgeProps } from "../primitives";

export type BadgeVariant = BadgeProps["variant"];
export type IssuePriority = "critical" | "high" | "medium" | "low";

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_SET = new Set<IssuePriority>(["critical", "high", "medium", "low"]);

function isIssuePriority(value: string | null | undefined): value is IssuePriority {
  return PRIORITY_SET.has(value as IssuePriority);
}

/** Prefer the score stored on the issue. Fall back to level and status for rows not scored yet. */
export function resolveIssuePriority(
  level?: string | null,
  status?: string | null,
  stored?: { priority?: string | null; priority_score?: number | null },
): IssuePriority {
  if (isIssuePriority(stored?.priority) && (stored?.priority_score ?? 0) > 0) {
    return stored.priority;
  }

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

/** Color per priority — keep high ≠ critical (escalating aliases danger). */
function priorityColorClass(priority: IssuePriority): string {
  switch (priority) {
    case "critical":
      return "text-semantic-danger";
    case "high":
      return "text-semantic-warning";
    case "medium":
      return "text-fg-secondary";
    default:
      return "text-fg-muted";
  }
}

const PRIORITY_ACTIVE_BARS: Record<IssuePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Four stepped bars; only the active count is filled so states read apart at 14–16px. */
const BAR_HEIGHTS = [4, 7, 10, 13] as const;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const VIEW_W = BAR_WIDTH * 4 + BAR_GAP * 3;
const VIEW_H = 14;

function PriorityBarsSvg({
  priority,
  size = 14,
  className,
}: {
  priority: IssuePriority;
  size?: number;
  className?: string;
}) {
  const activeCount = PRIORITY_ACTIVE_BARS[priority];
  const colorClass = priorityColorClass(priority);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={size ? (size * VIEW_W) / VIEW_H : VIEW_W}
      height={size ?? VIEW_H}
      className={cn("shrink-0", colorClass, className)}
      aria-hidden="true"
      data-priority-bars={activeCount}
    >
      {BAR_HEIGHTS.map((height, i) => {
        const isActive = i < activeCount;
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = VIEW_H - height;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={BAR_WIDTH}
            height={height}
            rx={0.75}
            fill="currentColor"
            opacity={isActive ? 1 : 0.14}
          />
        );
      })}
    </svg>
  );
}

export interface IssuePriorityIconProps {
  level?: string | null;
  status?: string | null;
  priority?: IssuePriority | string | null;
  priorityScore?: number | null;
  size?: number;
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
  /** @deprecated Bars are the only glyph; kept for call-site compatibility. */
  glyph?: "bars" | "silhouette";
}

export function IssuePriorityIcon({
  level,
  status,
  priority: priorityProp,
  priorityScore,
  size = 14,
  className,
  showLabel = false,
  labelClassName,
}: IssuePriorityIconProps) {
  const priority = isIssuePriority(priorityProp)
    ? priorityProp
    : resolveIssuePriority(level, status, {
        priority: priorityProp,
        priority_score: priorityScore,
      });
  const label = PRIORITY_LABEL[priority];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={`${label} priority`}
      data-priority={priority}
    >
      <PriorityBarsSvg priority={priority} size={size} />
      {showLabel ? (
        <span className={cn("text-sm font-medium text-ink", labelClassName)}>{label}</span>
      ) : (
        <span className="sr-only">{label} priority</span>
      )}
    </span>
  );
}

export interface IssuePriorityBadgeProps {
  level?: string | null;
  status?: string | null;
  priority?: string | null;
  priorityScore?: number | null;
  compact?: boolean;
  className?: string;
}

function priorityBadgeVariant(priority: IssuePriority): BadgeVariant {
  switch (priority) {
    case "critical":
      return "error";
    case "high":
      return "warning";
    case "medium":
      return "neutral";
    default:
      return "neutral";
  }
}

export function IssuePriorityBadge({
  level,
  status,
  priority: storedPriority,
  priorityScore,
  compact = false,
  className,
}: IssuePriorityBadgeProps) {
  const priority = resolveIssuePriority(level, status, {
    priority: storedPriority,
    priority_score: priorityScore,
  });

  return (
    <Badge
      variant={priorityBadgeVariant(priority)}
      size={compact ? "compact" : "sm"}
      className={cn("epure-priority-badge font-medium", className)}
    >
      <PriorityBarsSvg priority={priority} size={compact ? 11 : 14} />
      {PRIORITY_LABEL[priority]}
      {!compact && level ? (
        <span className="font-normal text-fg-secondary">· {level}</span>
      ) : null}
    </Badge>
  );
}

export function getIssuePriorityLabel(
  level?: string | null,
  status?: string | null,
): string {
  return PRIORITY_LABEL[resolveIssuePriority(level, status)];
}
