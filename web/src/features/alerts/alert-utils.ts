import type { AlertRow } from "../../lib/api";
import { projectPath, projectSettingsPath } from "../../lib/paths";

const RECENT_DAYS = 7;
const VELOCITY_WINDOW_MINUTES = 15;
const VELOCITY_SPIKE_RATIO = 4;
const PREFS_STORAGE_KEY = "epure.alerts.preferences";

export type AlertKindFilter =
  | "all"
  | "new_issue"
  | "velocity_spike"
  | "regression"
  | "event_milestone"
  | "users_affected"
  | "ingest_cap_hit";
export type AlertSort = "newest" | "oldest" | "severity";
export type AlertTimeWindow = "24h" | "7d" | "30d" | "all";
export type AlertSeverity = "warning" | "danger";

export interface AlertRuleDefinition {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  threshold: string;
  firesWhen: string;
  pausable: boolean;
  pauseHint: string;
  webhookEvent: string;
}

export interface AlertsPreferences {
  compactRows: boolean;
  defaultKindFilter: AlertKindFilter;
  defaultSort: AlertSort;
  defaultTimeWindow: AlertTimeWindow;
}

export const DEFAULT_ALERTS_PREFERENCES: AlertsPreferences = {
  compactRows: false,
  defaultKindFilter: "all",
  defaultSort: "newest",
  defaultTimeWindow: "7d",
};

export const ALERT_RULES: AlertRuleDefinition[] = [
  {
    id: "velocity_spike",
    name: "Velocity spike",
    description:
      "Fires when an issue's event rate jumps sharply in a rolling window — often the first sign of a bad deploy or traffic surge.",
    severity: "warning",
    threshold: `>${Math.round((VELOCITY_SPIKE_RATIO - 1) * 100)}% vs prior ${VELOCITY_WINDOW_MINUTES}m`,
    firesWhen: `Current ${VELOCITY_WINDOW_MINUTES}-minute window exceeds ${VELOCITY_SPIKE_RATIO}× the previous window (minimum 1 event in baseline).`,
    pausable: true,
    pauseHint: "Snooze the issue on Issues to pause velocity alerts for that exception.",
    webhookEvent: "Not dispatched — velocity spikes appear in Alerts only.",
  },
  {
    id: "regression",
    name: "Came back",
    description:
      "Fires when a resolved exception reappears in a newer release — a deploy may have reintroduced a fixed bug.",
    severity: "danger",
    threshold: "Resolved issue receives a new event in a later release",
    firesWhen: "Issue status was resolved and a new event arrives with a different release version.",
    pausable: true,
    pauseHint: "Snooze the issue on Issues to pause regression alerts for that exception.",
    webhookEvent: "regression",
  },
  {
    id: "new_issue",
    name: "New issue",
    description:
      "Fires the first time a fingerprint is seen — a brand-new exception entered your project.",
    severity: "warning",
    threshold: "First event for a new fingerprint",
    firesWhen: "A never-before-seen error group is created from ingest.",
    pausable: false,
    pauseHint: "Not pausable — every new exception is worth knowing about.",
    webhookEvent: "issue_created",
  },
  {
    id: "event_milestone",
    name: "High volume",
    description:
      "Fires when an issue crosses 100, 500, 1,000, or 5,000 total events — signals a widespread or chronic problem.",
    severity: "warning",
    threshold: "100 · 500 · 1K · 5K events",
    firesWhen: "Issue event count crosses the next milestone on ingest.",
    pausable: true,
    pauseHint: "Snooze the issue to pause milestone alerts for that exception.",
    webhookEvent: "Not dispatched — appears in Alerts only.",
  },
  {
    id: "users_affected",
    name: "Users affected",
    description:
      "Fires when distinct users hitting an issue cross 10, 50, or 100 — helps prioritize customer-facing impact.",
    severity: "warning",
    threshold: "10 · 50 · 100 unique users",
    firesWhen: "A new distinct user is recorded and the count crosses the next milestone.",
    pausable: true,
    pauseHint: "Snooze the issue to pause user-impact alerts for that exception.",
    webhookEvent: "Not dispatched — appears in Alerts only.",
  },
  {
    id: "ingest_cap_hit",
    name: "Ingest cap reached",
    description:
      "Fires when a project hits its hourly ingest limit — new events are rejected until the next hour.",
    severity: "danger",
    threshold: "Project hourly ingest cap",
    firesWhen: "Ingest is rejected because the project cap for the current hour is full.",
    pausable: false,
    pauseHint: "Raise the cap in Project settings → General, or wait for the hourly window to reset.",
    webhookEvent: "Not dispatched — appears in Alerts only.",
  },
];

export const ALERT_KIND_FILTERS: { value: AlertKindFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "new_issue", label: "New issue" },
  { value: "velocity_spike", label: "Velocity spike" },
  { value: "regression", label: "Came back" },
  { value: "event_milestone", label: "High volume" },
  { value: "users_affected", label: "Users affected" },
  { value: "ingest_cap_hit", label: "Ingest cap" },
];

export const ALERT_SORT_OPTIONS: { value: AlertSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "severity", label: "Severity" },
];

export const ALERT_TIME_WINDOW_OPTIONS: { value: AlertTimeWindow; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export function getAlertRuleName(kind: string): string {
  const rule = ALERT_RULES.find((entry) => entry.id === kind);
  if (rule) {
    return rule.name;
  }
  return kind.replace(/_/g, " ");
}

export function getAlertSeverity(kind: string): AlertSeverity {
  const normalizedKind = kind === "velocity" ? "velocity_spike" : kind;
  if (normalizedKind === "regression" || normalizedKind === "ingest_cap_hit") {
    return "danger";
  }
  return "warning";
}

export function getAlertSeverityForAlert(alert: AlertRow): AlertSeverity {
  if (alert.kind === "users_affected") {
    const threshold =
      typeof alert.payload_json.threshold === "number" ? alert.payload_json.threshold : 0;
    return threshold >= 100 ? "danger" : "warning";
  }
  return getAlertSeverity(alert.kind);
}

export function getAlertTitle(alert: AlertRow): string {
  if (alert.kind === "ingest_cap_hit") {
    const projectName =
      typeof alert.payload_json.project_name === "string"
        ? alert.payload_json.project_name
        : null;
    return projectName ? `${projectName} ingest cap reached` : "Ingest cap reached";
  }
  const title = alert.payload_json.title;
  if (typeof title === "string" && title.trim()) {
    return title;
  }
  return getAlertRuleName(alert.kind);
}

export function formatVelocityDetail(payload: Record<string, unknown>): string {
  const ratio = typeof payload.ratio === "number" ? payload.ratio : null;
  const current =
    typeof payload.current_window === "number" ? payload.current_window : null;
  const previous =
    typeof payload.previous_window === "number" ? payload.previous_window : null;

  if (ratio !== null && current !== null && previous !== null) {
    const pct = Math.round((ratio - 1) * 100);
    const eventNoun = current === 1 ? "event" : "events";
    return `${current} ${eventNoun} in ${VELOCITY_WINDOW_MINUTES}m · +${pct}% vs prior ${VELOCITY_WINDOW_MINUTES}m (${previous})`;
  }

  return `Event rate jumped more than ${Math.round((VELOCITY_SPIKE_RATIO - 1) * 100)}% in ${VELOCITY_WINDOW_MINUTES} minutes`;
}

export function formatRegressionDetail(payload: Record<string, unknown>): string {
  const release = typeof payload.release === "string" ? payload.release : null;
  const resolvedIn =
    typeof payload.resolved_in_release === "string"
      ? payload.resolved_in_release
      : null;

  if (release && resolvedIn) {
    return `Reappeared in ${release} after resolving in ${resolvedIn}`;
  }
  if (release) {
    return `Reappeared in release ${release}`;
  }
  return "Exception came back after you marked it resolved";
}

export function formatNewIssueDetail(payload: Record<string, unknown>): string {
  const release = typeof payload.release === "string" ? payload.release : null;
  if (release) {
    return `First seen in release ${release}`;
  }
  return "New exception group created";
}

export function formatEventMilestoneDetail(payload: Record<string, unknown>): string {
  const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
  const eventCount = typeof payload.event_count === "number" ? payload.event_count : null;
  if (threshold !== null && eventCount !== null) {
    return `Crossed ${threshold.toLocaleString()} events (${eventCount.toLocaleString()} total)`;
  }
  if (threshold !== null) {
    return `Crossed ${threshold.toLocaleString()} events`;
  }
  return "Issue crossed a high-volume milestone";
}

export function formatUsersAffectedDetail(payload: Record<string, unknown>): string {
  const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
  const userCount =
    typeof payload.unique_user_count === "number" ? payload.unique_user_count : null;
  if (threshold !== null && userCount !== null) {
    return `${userCount.toLocaleString()} distinct users affected (milestone: ${threshold})`;
  }
  return "More distinct users are hitting this issue";
}

export function getAlertDetail(alert: AlertRow): string {
  if (alert.kind === "velocity_spike" || alert.kind === "velocity") {
    return formatVelocityDetail(alert.payload_json);
  }
  if (alert.kind === "regression") {
    return formatRegressionDetail(alert.payload_json);
  }
  if (alert.kind === "new_issue") {
    return formatNewIssueDetail(alert.payload_json);
  }
  if (alert.kind === "event_milestone") {
    return formatEventMilestoneDetail(alert.payload_json);
  }
  if (alert.kind === "users_affected") {
    return formatUsersAffectedDetail(alert.payload_json);
  }
  const message = alert.payload_json.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }
  return getAlertRuleName(alert.kind);
}

export function getIssueLink(alert: AlertRow, projectId: string): string {
  if (alert.kind === "ingest_cap_hit") {
    return projectSettingsPath(projectId, "general");
  }
  const params = new URLSearchParams();
  if (alert.kind === "regression") {
    params.set("q", "is:regression");
  }
  if (alert.kind === "new_issue") {
    params.set("q", "is:unresolved");
  }
  if (alert.issue_id) {
    params.set("issue", alert.issue_id);
  }
  const suffix = params.toString();
  const base = projectPath(projectId, "issues");
  return suffix ? `${base}?${suffix}` : base;
}

export function getAlertRule(alert: AlertRow): AlertRuleDefinition | undefined {
  const normalizedKind = alert.kind === "velocity" ? "velocity_spike" : alert.kind;
  return ALERT_RULES.find((rule) => rule.id === normalizedKind);
}

function timeWindowCutoff(window: AlertTimeWindow): number | null {
  switch (window) {
    case "24h":
      return Date.now() - 24 * 60 * 60 * 1000;
    case "7d":
      return Date.now() - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return Date.now() - 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function filterAlerts(
  alerts: AlertRow[],
  options: {
    kind?: AlertKindFilter;
    timeWindow?: AlertTimeWindow;
  },
): AlertRow[] {
  const kind = options.kind ?? "all";
  const cutoff = timeWindowCutoff(options.timeWindow ?? "7d");

  return alerts.filter((alert) => {
    const normalizedKind = alert.kind === "velocity" ? "velocity_spike" : alert.kind;
    if (kind !== "all" && normalizedKind !== kind) {
      return false;
    }
    if (cutoff !== null && new Date(alert.fired_at).getTime() < cutoff) {
      return false;
    }
    return true;
  });
}

export function sortAlerts(alerts: AlertRow[], sort: AlertSort): AlertRow[] {
  const rows = [...alerts];
  switch (sort) {
    case "oldest":
      return rows.sort(
        (left, right) => new Date(left.fired_at).getTime() - new Date(right.fired_at).getTime(),
      );
    case "severity":
      return rows.sort((left, right) => {
        const severityDelta =
          (getAlertSeverityForAlert(right) === "danger" ? 1 : 0) -
          (getAlertSeverityForAlert(left) === "danger" ? 1 : 0);
        if (severityDelta !== 0) {
          return severityDelta;
        }
        return new Date(right.fired_at).getTime() - new Date(left.fired_at).getTime();
      });
    default:
      return rows.sort(
        (left, right) => new Date(right.fired_at).getTime() - new Date(left.fired_at).getTime(),
      );
  }
}

export function countRecentAlerts(
  alerts: AlertRow[],
  timeWindow: AlertTimeWindow = "7d",
): number {
  const cutoff = timeWindowCutoff(timeWindow);
  if (cutoff === null) {
    return alerts.length;
  }
  return alerts.filter((alert) => new Date(alert.fired_at).getTime() >= cutoff).length;
}

export function countAlertsByKind(alerts: AlertRow[]): {
  velocity: number;
  regression: number;
  newIssue: number;
} {
  return alerts.reduce(
    (counts, alert) => {
      const normalizedKind = alert.kind === "velocity" ? "velocity_spike" : alert.kind;
      if (normalizedKind === "velocity_spike") {
        counts.velocity += 1;
      } else if (normalizedKind === "regression") {
        counts.regression += 1;
      } else if (normalizedKind === "new_issue") {
        counts.newIssue += 1;
      }
      return counts;
    },
    { velocity: 0, regression: 0, newIssue: 0 },
  );
}

export function countUniqueIssueAlerts(alerts: AlertRow[]): number {
  const issueIds = new Set(
    alerts.map((alert) => alert.issue_id).filter((issueId): issueId is string => Boolean(issueId)),
  );
  return issueIds.size;
}

export function getAlertsPageSubtitle(
  alerts: AlertRow[],
  loading: boolean,
  environment?: string,
): string {
  if (loading) {
    return "Loading alerts…";
  }

  const recent = countRecentAlerts(alerts);
  const noun = recent === 1 ? "alert" : "alerts";
  const parts = [`${recent} ${noun} in the last ${RECENT_DAYS} days`];

  if (environment) {
    parts.push(environment);
  }

  return parts.join(" · ");
}

export function formatAlertSummary(alerts: AlertRow[]): string | null {
  const { velocity, regression, newIssue } = countAlertsByKind(alerts);
  const parts: string[] = [];

  if (newIssue > 0) {
    parts.push(`${newIssue} new issue${newIssue === 1 ? "" : "s"}`);
  }
  if (velocity > 0) {
    parts.push(`${velocity} velocity spike${velocity === 1 ? "" : "s"}`);
  }
  if (regression > 0) {
    parts.push(`${regression} came back`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function loadAlertsPreferences(): AlertsPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_ALERTS_PREFERENCES;
    }
    const parsed = JSON.parse(raw) as Partial<AlertsPreferences>;
    return {
      ...DEFAULT_ALERTS_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_ALERTS_PREFERENCES;
  }
}

export function saveAlertsPreferences(preferences: AlertsPreferences): void {
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences));
}
