import {
  alertInboxLifecycleKinds,
  inboxLifecycleLabel,
  issueInboxLifecycleKinds,
  type InboxLifecycleKind,
} from "@/lib/inbox-lifecycle";
import type { AlertRow, IssueSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

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
    <p
      className={cn(
        "mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-fg-muted",
        className,
      )}
      aria-label={kinds.map(inboxLifecycleLabel).join(", ")}
    >
      {kinds.map(inboxLifecycleLabel).join(" · ")}
    </p>
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
