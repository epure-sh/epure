import type { EventDetail, IssueSummary } from "../lib/api";
import { cn } from "../lib/cn";
import { IssueContextFields } from "./issue-context-fields";
import { IssueImpactMetrics } from "./issue-impact-strip";

export interface IssueContextSnapshotProps {
  issue: IssueSummary;
  event: EventDetail | null;
  tags: string[];
  className?: string;
}

/** At-a-glance impact + environment block for issue detail Context tab. */
export function IssueContextSnapshot({ issue, event, tags, className }: IssueContextSnapshotProps) {
  return (
    <section
      className={cn(
        "epure-issue-context overflow-hidden rounded-md border border-border bg-surface-1 shadow-xs",
        className,
      )}
      aria-label="Issue context"
    >
      <IssueImpactMetrics issue={issue} className="border-b border-border-subtle bg-surface-1" />
      <div className="px-3 py-3 sm:px-4">
        <IssueContextFields issue={issue} event={event} tags={tags} />
      </div>
    </section>
  );
}
