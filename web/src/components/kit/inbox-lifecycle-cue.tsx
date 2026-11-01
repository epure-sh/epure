import {
  alertInboxLifecycleKinds,
  inboxLifecycleLabel,
  issueInboxLifecycleKinds,
  type InboxLifecycleKind,
} from "@/lib/inbox-lifecycle";
import type { AlertRow, IssueSummary } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function lifecycleBadgeVariant(
  kind: InboxLifecycleKind,
): "warning" | "info" | "healthy" | "neutral" {
  switch (kind) {
    case "came_back":
      return "warning";
    case "snoozed":
      return "info";
    case "resolved":
      return "healthy";
    default:
      return "neutral";
  }
}

export function InboxLifecycleCue({
  kinds,
  className,
}: {
  kinds: InboxLifecycleKind[];
  className?: string;
}) {
  if (kinds.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}
      aria-label={kinds.map(inboxLifecycleLabel).join(", ")}
    >
      {kinds.map((kind) => (
        <Badge
          key={kind}
          variant={lifecycleBadgeVariant(kind)}
          size="compact"
          className="shrink-0 font-medium"
        >
          {inboxLifecycleLabel(kind)}
        </Badge>
      ))}
    </div>
  );
}

export function IssueInboxLifecycleCue({
  issue,
  className,
}: {
  issue: Pick<IssueSummary, "status" | "snoozed" | "came_back">;
  className?: string;
}) {
  return <InboxLifecycleCue kinds={issueInboxLifecycleKinds(issue)} className={className} />;
}

export function AlertInboxLifecycleCue({
  alert,
  className,
}: {
  alert: Pick<AlertRow, "kind" | "ignored">;
  className?: string;
}) {
  return <InboxLifecycleCue kinds={alertInboxLifecycleKinds(alert)} className={className} />;
}
