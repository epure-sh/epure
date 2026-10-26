import type { EventDetail, IssueSummary, IssueTimeline } from "../lib/api";
import { IssueAiCopilotCard } from "./issue-ai-copilot-card";
import { IssueContextSnapshot } from "./issue-context-snapshot";
import {
  IssueOccurrenceTimeline,
  type TimelineWindowValue,
} from "./issue-occurrence-timeline";
import { IssueRecentOccurrences } from "./issue-recent-occurrences";
import { Section } from "./section";

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

function formatOverviewLead(issue: IssueSummary, snoozeBanner: string | null): string | null {
  if (issue.status === "regression") {
    return formatRegressionCopy(issue);
  }
  if (issue.snoozed) {
    return snoozeBanner ?? "Snoozed";
  }
  if (issue.status === "resolved") {
    return "Resolved. Reopen it if it is still happening.";
  }
  if (issue.is_escalating_3d) {
    return "Rising fast. Resolve it or snooze it if you already know the cause.";
  }
  return null;
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
  const overviewLead = formatOverviewLead(issue, snoozeBanner);
  const tags = topTags(event);

  return (
    <div className="epure-overview">
      <Section className="px-4 pt-5 pb-3 md:px-5">
        {overviewLead ? (
          <p className="mb-4 text-base leading-relaxed text-fg-primary">{overviewLead}</p>
        ) : null}
        <IssueContextSnapshot issue={issue} event={event} tags={tags} className="mt-4" />
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

      <div className="px-5 pb-4 pt-1">
        <IssueAiCopilotCard issue={issue} event={event} />
      </div>
    </div>
  );
}
