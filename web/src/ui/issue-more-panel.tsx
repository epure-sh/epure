import { useEffect, useState, type ReactNode } from "react";
import type { EventDetail, IssueSummary, UserFeedback } from "../lib/api";
import { fetchEventFeedback } from "../lib/api";
import { useIssueEventsPage } from "../features/issues/use-issue-events-page";
import { Badge } from "./badge";
import { ActionButton } from "./action-button";
import { IssueOccurrencesTable } from "./issue-occurrences-table";
import { MorePanel } from "./more-panel";
import { Section, SectionHeader } from "./section";

export interface IssueMorePanelProps {
  issue: IssueSummary;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string, event?: EventDetail) => void;
  selectedEvent: EventDetail | null;
  diffSection: ReactNode;
  mergedChildren: IssueSummary[];
  onSplit: (ids: string[]) => void;
  busy?: boolean;
}

function formatTag(label: string, value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return `${label}:${value}`;
}

function runtimeTag(event: EventDetail | null): string | null {
  if (!event?.runtime_name) {
    return null;
  }
  const version = event.runtime_version ? `@${event.runtime_version}` : "";
  return `runtime:${event.runtime_name}${version}`;
}

export function IssueMorePanel({
  issue,
  selectedEventId,
  onSelectEvent,
  selectedEvent,
  diffSection,
  mergedChildren,
  onSplit,
  busy = false,
}: IssueMorePanelProps) {
  const [feedback, setFeedback] = useState<UserFeedback | null>(null);
  const {
    events,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
  } = useIssueEventsPage(issue.id);

  useEffect(() => {
    if (!selectedEvent) {
      setFeedback(null);
      return;
    }

    let cancelled = false;
    void fetchEventFeedback(selectedEvent.id)
      .then((row) => {
        if (!cancelled) {
          setFeedback(row);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFeedback(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEvent?.id]);

  const tags = [
    formatTag("platform", selectedEvent?.platform),
    runtimeTag(selectedEvent),
    formatTag("browser", selectedEvent?.browser_name),
    formatTag("os", selectedEvent?.os_name),
  ].filter((tag): tag is string => Boolean(tag));

  const fingerprintShort = issue.fingerprint
    ? `${issue.fingerprint.slice(0, 12)}…`
    : "—";

  const sectionClass = "px-5 py-2.5";

  return (
    <MorePanel>
      <div className="min-h-0 flex-1 overflow-auto pb-5">
        {error ? (
          <div className="px-5 py-2 text-xs text-semantic-danger">
            {error}
          </div>
        ) : null}

        <IssueOccurrencesTable
          issue={issue}
          events={events}
          total={total}
          hasMore={hasMore}
          loading={loading}
          loadingMore={loadingMore}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          onLoadMore={loadMore}
        />

        <Section className={sectionClass}>
          <SectionHeader title="Compare" className="mb-1.5" />
          {diffSection}
        </Section>

        {tags.length > 0 ? (
          <Section className={sectionClass}>
            <SectionHeader title="Tags & runtime" className="mb-1.5" />
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="env" className="font-mono text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </Section>
        ) : null}

        <Section className={sectionClass}>
          <SectionHeader title="Grouping" className="mb-1.5" />
          <dl className="text-sm">
            <dt className="text-xs text-ink-muted">Fingerprint</dt>
            <dd className="mt-0.5 font-mono text-xs text-ink" title={issue.fingerprint}>
              {fingerprintShort}
            </dd>
          </dl>
        </Section>

        {mergedChildren.length > 0 ? (
          <Section className={sectionClass}>
            <SectionHeader
              title="Merged issues"
              description={`${mergedChildren.length} linked`}
              className="mb-1.5"
            />
            <ul className="space-y-1 text-sm text-ink-muted">
              {mergedChildren.map((child) => (
                <li key={child.id} className="truncate font-mono text-xs">
                  {child.title ?? child.id}
                </li>
              ))}
            </ul>
            <ActionButton
              variant="secondary"
              className="mt-2 text-xs"
              disabled={busy}
              tooltip={busy ? "Saving changes…" : undefined}
              onClick={() => onSplit(mergedChildren.map((child) => child.id))}
            >
              Split all merged
            </ActionButton>
          </Section>
        ) : null}

        {feedback ? (
          <Section className={sectionClass}>
            <SectionHeader title="User feedback" className="mb-1.5" />
            <dl className="space-y-1 text-sm">
              {feedback.name ? (
                <div>
                  <dt className="text-xs text-ink-muted">Name</dt>
                  <dd className="text-ink">{feedback.name}</dd>
                </div>
              ) : null}
              {feedback.email ? (
                <div>
                  <dt className="text-xs text-ink-muted">Email</dt>
                  <dd className="font-mono text-ink">{feedback.email}</dd>
                </div>
              ) : null}
              {feedback.comments ? (
                <div>
                  <dt className="text-xs text-ink-muted">Comments</dt>
                  <dd className="text-ink">{feedback.comments}</dd>
                </div>
              ) : null}
            </dl>
          </Section>
        ) : null}
      </div>
    </MorePanel>
  );
}
