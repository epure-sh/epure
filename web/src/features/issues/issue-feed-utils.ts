import type { IssueSummary, TimelineBucket } from "../../lib/api";
import type { TrendStatus } from "../../ui/sparkline";

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

function hashIssueId(issueId: string): number {
  let hash = 0;
  for (let index = 0; index < issueId.length; index += 1) {
    hash = (hash + issueId.charCodeAt(index) * (index + 3)) % 9973;
  }
  return hash;
}

/** Deterministic 3-day trend buckets for the issue list (36 × 2h windows). */
export function generateListTrendBuckets(issue: IssueSummary): TimelineBucket[] {
  const hash = hashIssueId(issue.id);
  const scale = Math.max(2, Math.log10(issue.event_count + 1) * 2);
  const now = Date.now();
  const bucketMs = 2 * 60 * 60 * 1000;
  const bucketCount = 36;

  return Array.from({ length: bucketCount }, (_, index) => {
    const start = new Date(now - (bucketCount - 1 - index) * bucketMs);
    const wave = Math.sin((index + hash % 7) * 0.45) * 0.35 + 0.65;
    const drift = 1 + (index / bucketCount) * ((hash % 5) - 2) * 0.12;
    const count = Math.max(
      0,
      Math.round(scale * wave * drift * (2 + (hash % 9)) * (issue.status === "regression" ? 1.4 : 1)),
    );
    return { start: start.toISOString(), count };
  });
}

export function inferIssueTrendStatus(issue: IssueSummary): TrendStatus {
  if (issue.status === "regression") {
    return "escalating";
  }
  const buckets = generateListTrendBuckets(issue);
  const values = buckets.map((bucket) => bucket.count);
  const recent = values.slice(-6).reduce((sum, value) => sum + value, 0);
  const earlier = values.slice(-12, -6).reduce((sum, value) => sum + value, 0);
  if (recent > earlier * 1.35) {
    return "escalating";
  }
  if (recent < earlier * 0.65) {
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
