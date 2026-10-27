import type { AlertRow } from "../../lib/api";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/ui/badge";
import { getAlertReadState, getAlertReadStateLabel } from "./alert-utils";

function variantForRead(state: ReturnType<typeof getAlertReadState>): BadgeVariant {
  switch (state) {
    case "unread":
      return "accent";
    case "read":
      return "neutral";
    case "muted":
      return "neutral";
  }
}

export function AlertReadBadge({ alert }: { alert: AlertRow }) {
  const state = getAlertReadState(alert);
  return (
    <Badge variant={variantForRead(state)} size="compact">
      {getAlertReadStateLabel(alert)}
    </Badge>
  );
}
