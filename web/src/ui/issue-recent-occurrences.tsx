import type { EventDetail, IssueSummary } from "../lib/api";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";
import { Section, SectionHeader } from "./section";

const MAX_ROWS = 5;

export interface IssueRecentOccurrencesProps {
  issue: IssueSummary;
  events: EventDetail[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string, event?: EventDetail) => void;
  spacious?: boolean;
}

function formatUser(event: EventDetail): string {
  return event.user_email ?? event.user_id ?? "—";
}

export function IssueRecentOccurrences({
  issue,
  events,
  selectedEventId,
  onSelectEvent,
  spacious = false,
}: IssueRecentOccurrencesProps) {
  const recent = events.slice(0, MAX_ROWS);
  const effectiveSelectedId = selectedEventId ?? events[0]?.id ?? null;
  const storedCount = events.length;
  const totalCount = issue.event_count;
  const hasStoredGap = totalCount > storedCount;
  const sectionClass = spacious ? "px-6 py-5" : "px-5 py-3";

  if (recent.length === 0) {
    return (
      <Section className={sectionClass}>
        <SectionHeader title="Recent occurrences" className={spacious ? "mb-4" : "mb-2"} />
        <p className={spacious ? "text-base text-ink-muted" : "text-sm text-ink-muted"}>
          Occurrence details not available — counter may reflect pruned history.
        </p>
      </Section>
    );
  }

  const description = hasStoredGap
    ? `Showing last ${storedCount} stored of ${totalCount.toLocaleString()} total`
    : undefined;

  return (
    <Section className={sectionClass}>
      <SectionHeader
        title="Recent occurrences"
        description={description}
        className={spacious ? "mb-4" : undefined}
      />
      <div className="epure-inset-well overflow-hidden">
        <ul>
          {recent.map((event, index) => {
            const selected = event.id === effectiveSelectedId;
            return (
              <li
                key={event.id}
                className={cn(index > 0 && "border-t border-border")}
              >
                <button
                  type="button"
                  className={cn(
                    "epure-occurrence-list-item flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 text-left transition-colors duration-fast focus-ring",
                    spacious ? "px-3 py-3 text-base" : "px-2 py-1 text-sm",
                    selected
                      ? "bg-state-selected"
                      : "hover:bg-state-hover",
                  )}
                  onClick={() => onSelectEvent(event.id, event)}
                >
                <span
                  className="shrink-0 text-ink-muted"
                  title={new Date(event.occurred_at).toLocaleString()}
                >
                  {formatRelativeTime(event.occurred_at)}
                </span>
                <span className="min-w-0 truncate font-mono text-ink">{formatUser(event)}</span>
                <span className="font-mono text-ink-muted">
                  {event.environment ?? issue.environment ?? "—"}
                </span>
                <span className="font-mono-slash text-ink-muted">
                  {event.release ?? "—"}
                </span>
              </button>
            </li>
          );
        })}
        </ul>
      </div>
    </Section>
  );
}
