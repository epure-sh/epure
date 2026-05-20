import type { IssueSummary, TimelineBucket } from "../../lib/api";
import type { TrendStatus } from "../../ui/sparkline";

// Keep in sync with crates/storage/src/events.rs LIST_TREND_* (30d × daily).
export const LIST_TREND_BUCKET_COUNT = 30;
const LIST_TREND_BUCKET_MS = 24 * 60 * 60 * 1000;

export interface ParsedIssueTitle {
  shortTitle: string;
  subtitle: string | null;
}

export function parseIssueTitle(title: string | null): ParsedIssueTitle {
  if (!title) {
    return { shortTitle: "Untitled issue", subtitle: null };
  }

  const colonIndex = title.indexOf(": ");
  if (colonIndex > 0 && colonIndex < 48) {
    return {
      shortTitle: title.slice(0, colonIndex),
      subtitle: title.slice(colonIndex + 2).trim() || null,
    };
  }

  return { shortTitle: title, subtitle: null };
}

export function projectIssueCode(projectSlug: string, issueId: string): string {
  const prefix = projectSlug
    .split("-")
    .map((part) => part.slice(0, 4))
    .join("")
    .toUpperCase()
    .slice(0, 6);
  const suffix = issueId.replace(/-/g, "").slice(-3);
  const numeric = Number.parseInt(suffix, 16) % 1000;
  return `${prefix || "ISSUE"}-${numeric}`;
}

export function platformLabel(platform: string | null | undefined): string {
  switch (platform?.toLowerCase()) {
    case "javascript":
    case "node":
      return "JS";
    case "python":
      return "PY";
    case "go":
      return "GO";
    case "java":
      return "JV";
    case "ruby":
      return "RB";
    case "php":
      return "PHP";
    case "dotnet":
      return "NET";
    default:
      return platform?.slice(0, 3).toUpperCase() ?? "APP";
  }
}

export function emptyListTrendBuckets(): TimelineBucket[] {
  const now = Date.now();
  return Array.from({ length: LIST_TREND_BUCKET_COUNT }, (_, index) => {
    const start = new Date(
      now - (LIST_TREND_BUCKET_COUNT - 1 - index) * LIST_TREND_BUCKET_MS,
    );
    start.setUTCHours(0, 0, 0, 0);
    return {
      start: start.toISOString(),
      count: 0,
    };
  });
}

export function inferTrendStatus(
  issue: IssueSummary,
  buckets: TimelineBucket[],
): TrendStatus {
  if (issue.status === "regression") {
    return "escalating";
  }
  if (buckets.length === 0) {
    return "ongoing";
  }
  const values = buckets.map((bucket) => bucket.count);
  // Compare last ~1 week vs prior week (daily buckets).
  const recent = values.slice(-7).reduce((sum, value) => sum + value, 0);
  const earlier = values.slice(-14, -7).reduce((sum, value) => sum + value, 0);
  if (recent > earlier * 1.35) {
    return "escalating";
  }
  if (earlier > 0 && recent < earlier * 0.65) {
    return "declining";
  }
  return "ongoing";
}

export function issueLocationHint(issue: IssueSummary): string | null {
  if (issue.environment) {
    return issue.environment === "production" ? null : issue.environment;
  }
  return null;
}
