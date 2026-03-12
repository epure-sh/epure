import type { IssueSummary } from "../../lib/api";

const CSV_COLUMNS = [
  "title",
  "status",
  "count",
  "users",
  "env",
  "release",
  "last_seen",
  "first_seen",
  "fingerprint",
] as const;

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

export function issuesToCsv(issues: IssueSummary[]): string {
  const lines = [
    CSV_COLUMNS.join(","),
    ...issues.map((issue) =>
      [
        csvCell(issue.title),
        csvCell(issue.status),
        csvCell(issue.event_count),
        csvCell(issue.unique_user_count),
        csvCell(issue.environment),
        csvCell(issue.release),
        csvCell(issue.last_seen_at),
        csvCell(issue.first_seen_at),
        csvCell(issue.fingerprint),
      ].join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export function downloadIssuesCsv(issues: IssueSummary[], filename = "epure-issues.csv"): void {
  const blob = new Blob([issuesToCsv(issues)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
