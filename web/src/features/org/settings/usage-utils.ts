import type { IssueSummary, ProjectRow, TimelineBucket } from "../../../lib/api";
import type { TimeWindowValue } from "../../issues/query-utils";

export type UsageTimeWindow = "7d" | "30d" | "90d";

export const USAGE_TIME_WINDOWS: ReadonlyArray<{
  value: UsageTimeWindow;
  label: string;
}> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const AVG_EVENT_BYTES = 4_096;

export function usageWindowDays(window: UsageTimeWindow): number {
  switch (window) {
    case "30d":
      return 30;
    case "90d":
      return 90;
    default:
      return 7;
  }
}

export function estimateStorageBytes(eventCount: number): number {
  return eventCount * AVG_EVENT_BYTES;
}

export function formatStorage(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0).replace(/\.0$/, "")} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10_485_760 ? 1 : 0).replace(/\.0$/, "")} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, "")} GB`;
}

export function sumUniqueUsers(issues: IssueSummary[]): number {
  return issues.reduce((sum, issue) => sum + issue.unique_user_count, 0);
}

export function buildActivityBuckets(
  issues: IssueSummary[],
  days: number,
): TimelineBucket[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets: TimelineBucket[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayStart = new Date(now - offset * dayMs);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = dayStart.getTime() + dayMs;

    const count = issues.reduce((sum, issue) => {
      if (!issue.last_seen_at) {
        return sum;
      }
      const seen = new Date(issue.last_seen_at).getTime();
      if (seen >= dayStart.getTime() && seen < dayEnd) {
        return sum + issue.event_count;
      }
      return sum;
    }, 0);

    buckets.push({
      start: dayStart.toISOString(),
      count,
    });
  }

  return buckets;
}

export function ingestUtilization(
  events: number,
  capPerHour: number,
  window: UsageTimeWindow,
): number {
  if (capPerHour <= 0) {
    return 0;
  }
  const hours = usageWindowDays(window) * 24;
  const ceiling = capPerHour * hours;
  return ceiling > 0 ? Math.min(1, events / ceiling) : 0;
}

export function quotaTone(percent: number): "ok" | "warn" | "danger" {
  if (percent >= 90) {
    return "danger";
  }
  if (percent >= 75) {
    return "warn";
  }
  return "ok";
}

export function monthlyEventProjection(eventsInWindow: number, window: UsageTimeWindow): number {
  const days = usageWindowDays(window);
  return Math.round((eventsInWindow / days) * 30);
}

export interface ProjectUsageRow {
  project: ProjectRow;
  events: number;
  uniqueUsers: number;
  unresolved: number;
  regressions: number;
  storageBytes: number;
  ingestUtilization: number;
  trendBuckets: TimelineBucket[];
}

export interface UsageTotals {
  events: number;
  uniqueUsers: number;
  unresolved: number;
  regressions: number;
  storageBytes: number;
  maxRetentionDays: number;
  avgRetentionDays: number;
  monthlyEventProjection: number;
}

export function buildUsageTotals(rows: ProjectUsageRow[], window: UsageTimeWindow): UsageTotals {
  const events = rows.reduce((sum, row) => sum + row.events, 0);
  const retentionDays = rows.map((row) => row.project.retention_days);

  return {
    events,
    uniqueUsers: rows.reduce((sum, row) => sum + row.uniqueUsers, 0),
    unresolved: rows.reduce((sum, row) => sum + row.unresolved, 0),
    regressions: rows.reduce((sum, row) => sum + row.regressions, 0),
    storageBytes: rows.reduce((sum, row) => sum + row.storageBytes, 0),
    maxRetentionDays: retentionDays.length > 0 ? Math.max(...retentionDays) : 0,
    avgRetentionDays:
      retentionDays.length > 0
        ? Math.round(retentionDays.reduce((sum, days) => sum + days, 0) / retentionDays.length)
        : 0,
    monthlyEventProjection: monthlyEventProjection(events, window),
  };
}

export function buildUsageSummaryText(input: {
  deployment: string;
  window: UsageTimeWindow;
  windowLabel: string;
  totals: UsageTotals;
  rows: ProjectUsageRow[];
}): string {
  const lines = [
    `Epure usage summary (${input.deployment})`,
    `Period: ${input.windowLabel}`,
    "",
    "Organization totals",
    `- Events ingested: ${input.totals.events.toLocaleString()}`,
    `- Unique users (issue-level sum): ${input.totals.uniqueUsers.toLocaleString()}`,
    `- Estimated storage: ${formatStorage(input.totals.storageBytes)}`,
    `- Unresolved issues: ${input.totals.unresolved.toLocaleString()}`,
    `- Regressions: ${input.totals.regressions.toLocaleString()}`,
    `- Avg retention: ${input.totals.avgRetentionDays}d`,
    `- Projected monthly events: ${input.totals.monthlyEventProjection.toLocaleString()}`,
    "",
    "By project",
  ];

  for (const row of input.rows) {
    lines.push(
      `- ${row.project.name}: ${row.events.toLocaleString()} events, ${row.uniqueUsers.toLocaleString()} users, ${formatStorage(row.storageBytes)} est., ${row.project.retention_days}d retention`,
    );
  }

  lines.push(
    "",
    "Note: unique users are summed per issue (may overlap across issues). Storage is estimated at ~4 KB per event.",
  );

  return lines.join("\n");
}

export function toUsageTimeWindow(value: TimeWindowValue): UsageTimeWindow {
  if (value === "30d" || value === "90d") {
    return value;
  }
  return "7d";
}
