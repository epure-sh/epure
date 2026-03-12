import type { EventDetail, IssueSummary, IssueTimeline } from "../lib/api";
import { cn } from "../lib/cn";
import { Badge } from "./badge";
import { IssueImpactMetrics } from "./issue-impact-strip";
import { IssuePriorityIcon } from "./issue-priority";
import {
  IssueOccurrenceTimeline,
  type TimelineWindowValue,
} from "./issue-occurrence-timeline";
import { IssueRecentOccurrences } from "./issue-recent-occurrences";
import { Section, SectionHeader } from "./section";

export interface IssueOverviewPanelProps {
  issue: IssueSummary;
  event: EventDetail | null;
  events: EventDetail[];
  timeline: IssueTimeline | null;
  timelineLoading?: boolean;
  timelineWindow: TimelineWindowValue;
  onTimelineWindowChange: (window: TimelineWindowValue) => void;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string, event?: EventDetail) => void;
  spacious?: boolean;
}

function formatSnoozeBanner(issue: IssueSummary): string | null {
  if (!issue.snoozed) {
    return null;
  }

  if (issue.snooze_until) {
    return `Snoozed until ${new Date(issue.snooze_until).toLocaleString()}`;
  }

  if (issue.snooze_until_count != null) {
    const remaining = Math.max(0, issue.snooze_until_count - issue.event_count);
    return remaining === 1
      ? "Snoozed — 1 more event before alerts resume"
      : `Snoozed — ${remaining} more events before alerts resume`;
  }

  if (issue.snooze_until_users != null) {
    const remaining = Math.max(0, issue.snooze_until_users - issue.unique_user_count);
    return remaining === 1
      ? "Snoozed — 1 more user before alerts resume"
      : `Snoozed — ${remaining} more users before alerts resume`;
  }

  return "Snoozed";
}

function formatRegressionCopy(issue: IssueSummary): string {
  if (issue.resolved_in_release && issue.release) {
    return `Resolved in ${issue.resolved_in_release}, came back in ${issue.release}`;
  }
  if (issue.release) {
    return `Came back in ${issue.release}`;
  }
  return "This exception returned after resolve";
}

function topTags(event: EventDetail | null): string[] {
  if (!event) {
    return [];
  }
  const tags: string[] = [];
  if (event.platform) tags.push(event.platform);
  if (event.browser_name) tags.push(event.browser_name);
  if (event.os_name) tags.push(event.os_name);
  return tags.slice(0, 3);
}

function formatLatestUser(event: EventDetail | null): string {
  if (!event) {
    return "—";
  }
  return event.user_email ?? event.user_id ?? "—";
}

function ContextFields({
  issue,
  event,
  tags,
}: {
  issue: IssueSummary;
  event: EventDetail | null;
  tags: string[];
}) {
  const environment = issue.environment ?? event?.environment ?? "—";
  const release = issue.release ?? event?.release ?? "—";
  const user = formatLatestUser(event);

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">Priority</dt>
        <dd className="mt-0.5 flex items-center gap-1">
          <IssuePriorityIcon level={issue.level} status={issue.status} size={14} showLabel />
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">Environment</dt>
        <dd className="mt-0.5 truncate font-mono text-ink">{environment}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">Release</dt>
        <dd className="mt-0.5 truncate font-mono-slash text-ink">{release}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">Latest user</dt>
        <dd className="mt-0.5 truncate font-mono text-ink">{user}</dd>
      </div>
      {tags.length > 0 ? (
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs text-ink-muted">Runtime</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="env" size="compact">{tag}</Badge>
            ))}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function IssueOverviewPanel({
  issue,
  event,
  events,
  timeline,
  timelineLoading = false,
  timelineWindow,
  onTimelineWindowChange,
  selectedEventId,
  onSelectEvent,
}: IssueOverviewPanelProps) {
  const snoozeBanner = formatSnoozeBanner(issue);
  const tags = topTags(event);

  return (
    <div className="epure-overview">
      {snoozeBanner ? (
        <div className="border-b border-border bg-surface-inset px-5 py-2.5 border-l-4 border-l-semantic-info">
          <p className="text-sm text-ink">{snoozeBanner}</p>
        </div>
      ) : null}

      {issue.status === "regression" ? (
        <div
          className={cn(
            "border-b border-border bg-surface-inset px-5 py-2.5 border-l-4 border-l-semantic-warning bg-semantic-warning/5",
          )}
        >
          <p className="text-sm text-ink">{formatRegressionCopy(issue)}</p>
        </div>
      ) : null}

      <Section className="px-5 py-2.5">
        <SectionHeader title="Context" className="mb-2" />
        <div className="epure-inset-well px-4 py-3">
          <IssueImpactMetrics issue={issue} />
          <div className="mt-3 border-t border-border pt-3">
            <ContextFields issue={issue} event={event} tags={tags} />
          </div>
        </div>
      </Section>

      <IssueOccurrenceTimeline
        timeline={timeline}
        loading={timelineLoading}
        window={timelineWindow}
        onWindowChange={onTimelineWindowChange}
        spacious={false}
      />

      <IssueRecentOccurrences
        issue={issue}
        events={events}
        selectedEventId={selectedEventId}
        onSelectEvent={onSelectEvent}
        spacious={false}
      />
    </div>
  );
}
