import type { AlertRow } from "../../lib/api";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/ui/badge";
import { cn } from "../../lib/cn";
import {
  getAlertOpenDurationLabel,
  getAlertSignalState,
  getAlertSignalStateLabel,
} from "./alert-utils";

function variantForState(state: ReturnType<typeof getAlertSignalState>): BadgeVariant {
  switch (state) {
    case "firing":
      return "escalating";
    case "fired":
      return "info";
    case "acknowledged":
      return "resolved";
    case "muted":
      return "neutral";
  }
}

export function AlertStateBadge({
  alert,
  nowMs,
  showOpenDuration,
  className,
}: {
  alert: AlertRow;
  nowMs?: number;
  /** Append open duration for firing / fired (detail header). */
  showOpenDuration?: boolean;
  className?: string;
}) {
  const state = getAlertSignalState(alert, nowMs);
  const duration = showOpenDuration ? getAlertOpenDurationLabel(alert, nowMs) : null;
  const showDuration =
    showOpenDuration && duration && (state === "firing" || state === "fired");

  return (
    <Badge variant={variantForState(state)} size="compact" className={cn("gap-1", className)}>
      {state === "firing" ? (
        <span className="size-1.5 rounded-full bg-semantic-danger motion-safe:animate-pulse" aria-hidden />
      ) : null}
      {getAlertSignalStateLabel(state)}
      {showDuration ? (
        <>
          <span className="text-fg-muted/50" aria-hidden>
            ·
          </span>
          <span className="tabular-nums">{duration}</span>
        </>
      ) : null}
    </Badge>
  );
}
