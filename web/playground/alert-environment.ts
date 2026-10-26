import type { AlertRow, IssueSummary } from "../src/lib/api";

function parseAlertPayload(alert: AlertRow): Record<string, unknown> {
  const raw = alert.payload_json;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return {};
}

/** Mirrors Postgres `list_alerts` environment predicate in `crates/storage/src/alerts.rs`. */
export function alertMatchesEnvironmentFilter(
  alert: AlertRow,
  environment: string,
  resolveIssue: (issueId: string) => IssueSummary | undefined,
): boolean {
  const issue = alert.issue_id ? resolveIssue(alert.issue_id) : undefined;
  const payload = parseAlertPayload(alert);
  const payloadEnv =
    typeof payload.environment === "string" ? payload.environment : null;
  const coalesced = payloadEnv ?? issue?.environment ?? null;
  if (coalesced === environment) {
    return true;
  }
  if (!issue?.environment && (payloadEnv === null || payloadEnv === "")) {
    return true;
  }
  return false;
}
