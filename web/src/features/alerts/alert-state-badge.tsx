import type { AlertRow } from "../../lib/api";
import { Badge, type BadgeVariant } from "../../ui/badge";
import { getAlertSignalState, getAlertSignalStateLabel } from "./alert-utils";

function variantForState(state: ReturnType<typeof getAlertSignalState>): BadgeVariant {
  switch (state) {
    case "firing":
      return "info";
    case "fired":
      return "neutral";
    case "acknowledged":
      return "resolved";
    case "muted":
      return "neutral";
  }
}

export function AlertStateBadge({ alert, nowMs }: { alert: AlertRow; nowMs?: number }) {
  const state = getAlertSignalState(alert, nowMs);
  return (
    <Badge variant={variantForState(state)} size="compact">
      {getAlertSignalStateLabel(state)}
    </Badge>
  );
}
