// web/src/ui/block/issue-occurrence-timeline.tsx
// Tier 3 Block: Occurrence Timeline Block with Time-Window Controls

import type { IssueTimeline } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Button } from "../primitives/elements/button";
import { OccurrenceLineChart } from "./occurrence-line-chart";
import { Section, SectionHeader } from "../components/section";

export type TimelineWindowValue = "24h" | "7d" | "14d" | "30d";

export const TIMELINE_WINDOW_OPTIONS: { value: TimelineWindowValue; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
];

export interface IssueOccurrenceTimelineProps {
  timeline?: IssueTimeline | null;
  series?: number[];
  loading?: boolean;
  window?: TimelineWindowValue;
  range?: TimelineWindowValue;
  onWindowChange?: (window: TimelineWindowValue) => void;
  spacious?: boolean;
}

function windowLabel(window: TimelineWindowValue): string {
  switch (window) {
    case "24h":
      return "Last 24 hours";
    case "14d":
      return "Last 14 days";
    case "30d":
      return "Last 30 days";
    default:
      return "Last 7 days";
  }
}

function formatSummaryText(
  summary: IssueTimeline["summary"],
  window: TimelineWindowValue,
): string {
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
  series,
  loading = false,
  window: windowProp,
  range,
  onWindowChange = () => {},
  spacious = false,
}: IssueOccurrenceTimelineProps) {
  const activeWindow: TimelineWindowValue = windowProp ?? range ?? "24h";

  if (loading) {
    return (
      <Section className={spacious ? "px-6 py-5" : "px-5 py-3"}>
        <p className="text-sm text-ink-muted">Loading timeline…</p>
      </Section>
    );
  }

  const resolvedTimeline: IssueTimeline | null =
    timeline ??
    (series
      ? {
          issue_id: "",
          event_count: series.reduce((a, b) => a + b, 0),
          stored_event_count: series.reduce((a, b) => a + b, 0),
          buckets: series.map((count, i) => ({
            start: new Date(Date.now() - (series.length - i) * 3600000).toISOString(),
            count,
          })),
          summary: {
            last_1h: series[series.length - 1] ?? 0,
            last_24h: series.reduce((a, b) => a + b, 0),
            last_7d: series.reduce((a, b) => a + b, 0),
          },
        }
      : null);

  if (!resolvedTimeline) {
    return null;
  }

  const showChart = resolvedTimeline.buckets.length > 1;

  const windowActions = (
    <>
      {TIMELINE_WINDOW_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={activeWindow === option.value ? "secondary" : "ghost"}
          className={spacious ? "h-8 text-sm" : "h-7 text-xs"}
          onClick={() => onWindowChange(option.value)}
        >
          {option.value}
        </Button>
      ))}
    </>
  );

  return (
    <div data-slot="issue-occurrence-timeline" className="epure-issue-occurrence-timeline">
      <Section className={spacious ? "px-6 py-5" : "px-5 py-3"}>
        <SectionHeader
          title="When it happened"
          actions={windowActions}
          className={spacious ? "mb-4" : "mb-2"}
        />

        {showChart ? (
          <div className="epure-inset-well p-2">
            <OccurrenceLineChart
              buckets={resolvedTimeline.buckets}
              label={`Occurrence count over ${windowLabel(activeWindow).toLowerCase()}`}
              height={spacious ? 180 : 140}
              interactive
            />
          </div>
        ) : null}

        <p className={cn("text-ink-muted", spacious ? "mt-4 text-sm" : "mt-2 text-xs")}>
          {formatSummaryText(resolvedTimeline.summary, activeWindow)}
        </p>
      </Section>
    </div>
  );
}
