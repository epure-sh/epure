import type { IssueTimeline } from "../lib/api";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { OccurrenceLineChart } from "./occurrence-line-chart";
import { Section, SectionHeader } from "./section";

export type TimelineWindowValue = "7d" | "14d" | "30d";

export const TIMELINE_WINDOW_OPTIONS: { value: TimelineWindowValue; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" },
];

export interface IssueOccurrenceTimelineProps {
  timeline: IssueTimeline | null;
  loading?: boolean;
  window: TimelineWindowValue;
  onWindowChange: (window: TimelineWindowValue) => void;
  spacious?: boolean;
}

function windowLabel(window: TimelineWindowValue): string {
  switch (window) {
    case "14d":
      return "Last 14 days";
    case "30d":
      return "Last 30 days";
    default:
      return "Last 7 days";
  }
}

function formatSummaryText(summary: IssueTimeline["summary"], window: TimelineWindowValue): string {
  const parts: string[] = [];

  if (summary.last_1h > 0) {
    parts.push(`${summary.last_1h} in the last hour`);
  }
  if (summary.last_24h > 0) {
    parts.push(`${summary.last_24h} in the last 24 hours`);
  }
  if (window === "7d" && summary.last_7d > 0) {
    parts.push(`${summary.last_7d} in the last 7 days`);
  }

  if (parts.length === 0) {
    return `No occurrences in ${windowLabel(window).toLowerCase()}`;
  }

  return parts.join(" · ");
}

export function IssueOccurrenceTimeline({
  timeline,
  loading = false,
  window,
  onWindowChange,
  spacious = false,
}: IssueOccurrenceTimelineProps) {
  if (loading) {
    return (
      <Section className={spacious ? "px-6 py-5" : "px-5 py-3"}>
        <p className="text-sm text-ink-muted">Loading timeline…</p>
      </Section>
    );
  }

  if (!timeline) {
    return null;
  }

  const showChart = timeline.buckets.length > 1;

  const windowActions = (
    <>
      {TIMELINE_WINDOW_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={window === option.value ? "secondary" : "ghost"}
          className={spacious ? "h-8 text-sm" : "h-7 text-xs"}
          onClick={() => onWindowChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </>
  );

  return (
    <Section className={spacious ? "px-6 py-5" : "px-5 py-3"}>
      <SectionHeader
        title="When it happened"
        actions={windowActions}
        className={spacious ? "mb-4" : "mb-2"}
      />

      {showChart ? (
        <div className="epure-inset-well p-2">
          <OccurrenceLineChart
            buckets={timeline.buckets}
            label={`Occurrence count over ${windowLabel(window).toLowerCase()}`}
            height={spacious ? 180 : 140}
            interactive
          />
        </div>
      ) : null}

      <p className={cn("text-ink-muted", spacious ? "mt-4 text-sm" : "mt-2 text-xs")}>
        {formatSummaryText(timeline.summary, window)}
      </p>
    </Section>
  );
}
