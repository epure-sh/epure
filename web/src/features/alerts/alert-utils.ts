import type { AlertRow } from "../../lib/api";
import { projectPath, projectSettingsPath } from "../../lib/paths";
import { formatRelativeTime } from "@/lib/format-time";
import { TIME_WINDOW_OPTIONS, timeWindowCutoffMs, type TimeWindowValue } from "@/lib/time-window";
import { getSearchText, parseQuery, type IssueSortValue } from "../issues/query-utils";

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
  | "ingest_cap_hit"
  | "noise_spike"
  | "custom";
export type AlertViewMode = "all" | "unread" | "resolved" | "ignored";
export type AlertSort = "newest" | "oldest" | "severity";

export type AlertTimeWindow = TimeWindowValue | "all";
export type AlertSeverity = "warning" | "danger";

export interface AlertDayGroup {
  key: string;
  label: string;
  alerts: AlertRow[];
}

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
  defaultViewMode: AlertViewMode;
  defaultTimeWindow: AlertTimeWindow;
}

export const DEFAULT_ALERTS_PREFERENCES: AlertsPreferences = {
  defaultViewMode: "unread",
  defaultTimeWindow: "7d",
};

export const ALERT_VIEW_MODES: {
  value: AlertViewMode;
  label: string;
  description: string;
}[] = [
  {
    value: "all",
    label: "All",
    description: "Every signal in the selected time range",
  },
  {
    value: "unread",
    label: "Unresolved",
    description: "Alerts waiting for review",
  },
  {
    value: "resolved",
    label: "Resolved",
    description: "Alerts you have resolved",
  },
  {
    value: "ignored",
    label: "Snoozed",
    description: "Snoozed for this issue. No repeat notifications.",
  },
];

export const ALERT_RULES: AlertRuleDefinition[] = [
  {
    id: "velocity_spike",
    name: "Velocity spike",
    description:
      "Fires when an issue's event rate jumps sharply in a rolling window. Often the first sign of a bad deploy or traffic surge.",
    severity: "warning",
    threshold: `>${Math.round((VELOCITY_SPIKE_RATIO - 1) * 100)}% vs prior ${VELOCITY_WINDOW_MINUTES}m`,
    firesWhen: `Current ${VELOCITY_WINDOW_MINUTES}-minute window exceeds ${VELOCITY_SPIKE_RATIO}× the previous window (minimum 1 event in baseline).`,
    pausable: true,
    pauseHint: "Snooze the issue on Issues to pause velocity alerts for that exception.",
    webhookEvent: "velocity_spike",
  },
  {
    id: "regression",
    name: "Came back",
    description:
      "Fires when a resolved exception reappears in a newer release. A deploy may have reintroduced a fixed bug.",
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
      "Fires the first time a fingerprint is seen. A brand-new exception entered your project.",
    severity: "warning",
    threshold: "First event for a new fingerprint",
    firesWhen: "A never-before-seen error group is created from ingest.",
    pausable: false,
    pauseHint: "Not pausable. Every new exception is worth knowing about.",
    webhookEvent: "issue_created",
  },
  {
    id: "event_milestone",
    name: "High volume",
    description:
      "Fires when an issue crosses 100, 500, 1,000, or 5,000 total events. Signals a widespread or chronic problem.",
    severity: "warning",
    threshold: "100 · 500 · 1K · 5K events",
    firesWhen: "Issue event count crosses the next milestone on ingest.",
    pausable: true,
    pauseHint: "Snooze the issue to pause milestone alerts for that exception.",
    webhookEvent: "Not dispatched. Appears in Alerts only.",
  },
  {
    id: "users_affected",
    name: "Users affected",
    description:
      "Fires when distinct users hitting an issue cross 10, 50, or 100. Helps prioritize customer-facing impact.",
    severity: "warning",
    threshold: "10 · 50 · 100 unique users",
    firesWhen: "A new distinct user is recorded and the count crosses the next milestone.",
    pausable: true,
    pauseHint: "Snooze the issue to pause user-impact alerts for that exception.",
    webhookEvent: "Not dispatched. Appears in Alerts only.",
  },
  {
    id: "ingest_cap_hit",
    name: "Ingest cap reached",
    description:
      "Fires when a project hits its hourly ingest limit. New events are rejected until the next hour.",
    severity: "danger",
    threshold: "Project hourly ingest cap",
    firesWhen: "Ingest is rejected because the project cap for the current hour is full.",
    pausable: false,
    pauseHint: "Raise the cap in Project settings → General, or wait for the hourly window to reset.",
    webhookEvent: "Not dispatched. Appears in Alerts only.",
  },
  {
    id: "noise_spike",
    name: "Suppressed noise spiked",
    description:
      "Fires when a noise rule that is normally quiet jumps. The events stay suppressed, but the jump is visible.",
    severity: "warning",
    threshold: "30 events in a minute, or 6× the previous minute",
    firesWhen: "A server-side noise preset or message pattern suddenly matches many more events.",
    pausable: false,
    pauseHint: "Open Project settings → Inbound filters and review the rule before turning it off.",
    webhookEvent: "Not dispatched. Appears in Alerts only.",
  },
  {
    id: "custom",
    name: "Custom rule",
    description: "A project rule you created under Settings → Alert rules.",
    severity: "warning",
    threshold: "Defined on the rule",
    firesWhen: "The custom rule’s type, environment, and threshold match.",
    pausable: true,
    pauseHint: "Ignore this alert to stop the custom rule for that issue.",
    webhookEvent: "custom_rule",
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
  { value: "noise_spike", label: "Noise spike" },
  { value: "custom", label: "Custom rule" },
];

export const ALERT_SORT_OPTIONS: { value: AlertSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "severity", label: "Severity" },
];

export const ALERT_TIME_WINDOW_OPTIONS: { value: AlertTimeWindow; label: string }[] = [
  ...TIME_WINDOW_OPTIONS,
  { value: "all", label: "All time" },
];

export function getAlertRuleName(kind?: string | null): string {
  if (!kind) {
    return "Unknown alert";
  }
  const rule = ALERT_RULES.find((entry) => entry.id === kind);
  if (rule) {
    return rule.name;
  }
  return kind.replace(/_/g, " ");
}

export function getAlertSeverity(kind?: string | null): AlertSeverity {
  const normalizedKind = kind === "velocity" ? "velocity_spike" : (kind ?? "");
  if (normalizedKind === "regression" || normalizedKind === "ingest_cap_hit") {
    return "danger";
  }
  return "warning";
}

export function getAlertPayload(alert?: AlertRow | null): Record<string, unknown> {
  if (!alert) {
    return {};
  }
  return parsePayload(alert.payload_json);
}

function parsePayload(payloadJson: unknown): Record<string, unknown> {
  if (!payloadJson) return {};
  if (typeof payloadJson === "string") {
    try {
      const parsed = JSON.parse(payloadJson);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof payloadJson === "object") {
    return payloadJson as Record<string, unknown>;
  }
  return {};
}

export function getAlertPriorityLabel(severity: AlertSeverity): string {
  return severity === "danger" ? "High" : "Medium";
}

export function getAlertPriorityChip(severity: AlertSeverity): string {
  return severity === "danger" ? "P1" : "P2";
}

export function getAlertKindChipLabel(kind?: string | null): string {
  const normalized =
    kind === "velocity"
      ? "velocity_spike"
      : kind === "issue_created"
        ? "new_issue"
        : (kind ?? "");
  const match = ALERT_KIND_FILTERS.find((entry) => entry.value === normalized);
  if (match) {
    return match.label;
  }
  return getAlertRuleName(kind);
}

/** Custom alert_rules row id when present in payload (History → Edit rule). */
export function getAlertEditableRuleId(alert?: AlertRow | null): string | null {
  if (!alert || alert.kind !== "custom") {
    return null;
  }
  const payload = parsePayload(alert.payload_json);
  const ruleId = payload.rule_id;
  return typeof ruleId === "string" && ruleId.trim() ? ruleId.trim() : null;
}

/** Impact block for History detail — snapshot at fire time. */
export function getAlertDetailImpactLines(alert?: AlertRow | null): { label: string; value: string }[] {
  if (!alert) {
    return [];
  }
  const { events, users } = getAlertImpactMetrics(alert);
  const hero = getAlertDetailHeroMetric(alert);
  const lines: { label: string; value: string }[] = [];
  if (hero.label && hero.value && hero.value !== "None") {
    lines.push({ label: hero.label, value: hero.value });
  }
  if (events !== null && !lines.some((line) => line.value === events.toLocaleString())) {
    lines.push({ label: getAlertEventsStatLabel(alert), value: events.toLocaleString() });
  }
  if (users !== null) {
    lines.push({ label: "Users affected", value: users.toLocaleString() });
  }
  return lines;
}

export function getAlertImpactMetrics(alert?: AlertRow | null): {
  events: number | null;
  users: number | null;
} {
  if (!alert) {
    return { events: null, users: null };
  }
  const payload = parsePayload(alert.payload_json);
  let events: number | null =
    typeof payload.event_count === "number" ? payload.event_count : null;
  if (events === null && typeof payload.current_window === "number") {
    events = payload.current_window;
  }
  if (events === null && typeof payload.threshold === "number" && alert.kind === "event_milestone") {
    events = payload.threshold;
  }
  const users =
    typeof payload.unique_user_count === "number" ? payload.unique_user_count : null;
  return { events, users };
}

export interface AlertDetailHeroMetric {
  label: string;
  value: string;
  subtext?: string | null;
  delta?: string | null;
}

function dedupeHeroDelta(value: string, delta: string | null | undefined): string | null {
  if (!delta) {
    return null;
  }
  if (value.trim() === delta.trim()) {
    return null;
  }
  return delta;
}

/** Compare issue ids regardless of hyphen formatting. */
export function normalizeIssueIdForCompare(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

function stripAlertRulePrefixFromTitle(title: string, ruleName: string): string {
  const trimmedRule = ruleName.trim();
  if (!trimmedRule) {
    return title;
  }
  const escaped = trimmedRule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutPrefix = title
    .replace(new RegExp(`^${escaped}\\s*[—–-]\\s*`, "i"), "")
    .replace(new RegExp(`^${escaped}\\s*:\\s*`, "i"), "")
    .trim();
  return withoutPrefix || title;
}

/** Detail pane H2 — issue title without redundant rule-name prefix. */
export function getAlertDetailHeadline(alert?: AlertRow | null): string {
  if (!alert) {
    return "Unknown alert";
  }
  if (alert.kind === "ingest_cap_hit") {
    return getAlertTitle(alert);
  }
  const payload = parsePayload(alert.payload_json);
  const ruleName =
    typeof payload.rule_name === "string" ? payload.rule_name.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (title) {
    return ruleName ? stripAlertRulePrefixFromTitle(title, ruleName) : title;
  }
  return getAlertTitle(alert);
}

/** Single kind-aware headline number for History detail (replaces generic stat grid). */
export function getAlertDetailHeroMetric(alert?: AlertRow | null): AlertDetailHeroMetric {
  if (!alert) {
    return { label: "Signal", value: "None" };
  }
  const payload = parsePayload(alert.payload_json);
  const ruleKind =
    alert.kind === "custom" && typeof payload.rule_kind === "string"
      ? payload.rule_kind
      : normalizeAlertKind(alert.kind);
  const extras = getAlertImpactStatExtras(alert);

  if (ruleKind === "velocity_spike" || ruleKind === "velocity") {
    const ratio = typeof payload.ratio === "number" ? payload.ratio : null;
    const current =
      typeof payload.current_window === "number" ? payload.current_window : null;
    const previous =
      typeof payload.previous_window === "number" ? payload.previous_window : null;
    if (ratio !== null) {
      const value = `+${Math.round((ratio - 1) * 100)}%`;
      return {
        label: "Velocity vs prior 15m",
        value,
        delta: dedupeHeroDelta(value, extras.eventsDelta),
        subtext:
          current !== null && previous !== null
            ? `${current.toLocaleString()} events now · ${previous.toLocaleString()} prior`
            : extras.eventsBaseline,
      };
    }
    const { events } = getAlertImpactMetrics(alert);
    return {
      label: getAlertEventsStatLabel(alert),
      value: events != null ? events.toLocaleString() : "None",
      subtext: extras.eventsBaseline,
    };
  }

  if (ruleKind === "users_affected" || alert.kind === "users_affected") {
    const users =
      typeof payload.unique_user_count === "number" ? payload.unique_user_count : null;
    const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
    return {
      label: "Distinct users",
      value: users != null ? users.toLocaleString() : "None",
      subtext:
        threshold !== null ? `Milestone ${threshold.toLocaleString()} users` : extras.usersSubtext,
    };
  }

  if (ruleKind === "event_milestone" || alert.kind === "event_milestone") {
    const eventCount = typeof payload.event_count === "number" ? payload.event_count : null;
    const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
    return {
      label: "Event volume",
      value:
        eventCount != null
          ? eventCount.toLocaleString()
          : threshold != null
            ? threshold.toLocaleString()
            : "None",
      subtext:
        threshold !== null && eventCount !== null
          ? `Crossed ${threshold.toLocaleString()} milestone`
          : null,
    };
  }

  if (ruleKind === "regression" || alert.kind === "regression") {
    const release = typeof payload.release === "string" ? payload.release : null;
    const resolvedIn =
      typeof payload.resolved_in_release === "string" ? payload.resolved_in_release : null;
    return {
      label: "Regression",
      value: release ?? "Reopened",
      subtext: resolvedIn ? `Resolved previously in ${resolvedIn}` : null,
    };
  }

  if (
    ruleKind === "new_issue" ||
    ruleKind === "issue_created" ||
    alert.kind === "new_issue" ||
    alert.kind === "issue_created"
  ) {
    const release = typeof payload.release === "string" ? payload.release : null;
    return {
      label: "First seen",
      value: release ?? "New group",
      subtext: "New fingerprint in scope",
    };
  }

  if (alert.kind === "ingest_cap_hit") {
    const cap = typeof payload.cap_per_hour === "number" ? payload.cap_per_hour : null;
    const projectName =
      typeof payload.project_name === "string" ? payload.project_name.trim() : null;
    return {
      label: "Ingest cap",
      value: cap != null ? `${cap.toLocaleString()} / hr` : "Limit hit",
      subtext: projectName,
    };
  }

  const { events, users } = getAlertImpactMetrics(alert);
  if (users != null) {
    return {
      label: "Users impacted",
      value: users.toLocaleString(),
      subtext: extras.usersSubtext,
    };
  }
  const value = events != null ? events.toLocaleString() : "None";
  return {
    label: getAlertEventsStatLabel(alert),
    value,
    subtext: extras.eventsBaseline,
    delta: dedupeHeroDelta(value, extras.eventsDelta),
  };
}

export function getAlertCorrelatedIssueIds(alert?: AlertRow | null): string[] {
  if (!alert) {
    return [];
  }
  const payload = parsePayload(alert.payload_json);
  const primaryNorm = alert.issue_id ? normalizeIssueIdForCompare(alert.issue_id) : null;
  const ids: string[] = [];
  if (Array.isArray(payload.issue_ids)) {
    for (const entry of payload.issue_ids) {
      if (typeof entry !== "string" || !entry) {
        continue;
      }
      if (primaryNorm && normalizeIssueIdForCompare(entry) === primaryNorm) {
        continue;
      }
      if (!ids.some((id) => normalizeIssueIdForCompare(id) === normalizeIssueIdForCompare(entry))) {
        ids.push(entry);
      }
    }
  }
  return ids;
}

export function getAlertRuleDisplayName(alert?: AlertRow | null): string {
  if (!alert) {
    return "Alert";
  }
  const payload = parsePayload(alert.payload_json);
  if (alert.kind === "custom") {
    const ruleName =
      typeof payload.rule_name === "string" ? payload.rule_name.trim() : "";
    if (ruleName) {
      return ruleName;
    }
  }
  return getAlertRuleName(alert.kind);
}

/** Notification list primary line — rule / alert name (not the linked issue title). */
export function getAlertListRuleName(alert?: AlertRow | null): string {
  if (!alert) {
    return "Alert";
  }
  if (alert.kind === "ingest_cap_hit") {
    return getAlertTitle(alert);
  }
  return getAlertRuleDisplayName(alert);
}

/** Notification list secondary line — issue title or short context, cropped in UI. */
/** Compact mono proof for History list scan line (hero numbers stay in detail). */
export function getAlertListProofSnippet(alert?: AlertRow | null): string | null {
  if (!alert) {
    return null;
  }
  const payload = parsePayload(alert.payload_json);
  const ruleKind =
    alert.kind === "custom" && typeof payload.rule_kind === "string"
      ? normalizeAlertKind(payload.rule_kind)
      : normalizeAlertKind(alert.kind);

  if (ruleKind === "velocity_spike" || ruleKind === "velocity") {
    const ratio = typeof payload.ratio === "number" ? payload.ratio : null;
    if (ratio !== null) {
      return `+${Math.round((ratio - 1) * 100)}%`;
    }
    return null;
  }
  if (ruleKind === "regression") {
    const release = typeof payload.release === "string" ? payload.release.trim() : "";
    return release || null;
  }
  if (ruleKind === "event_milestone") {
    const eventCount = typeof payload.event_count === "number" ? payload.event_count : null;
    if (eventCount !== null) {
      return eventCount.toLocaleString();
    }
    const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
    if (threshold !== null) {
      return `${threshold.toLocaleString()}+`;
    }
    return null;
  }
  if (ruleKind === "users_affected") {
    const users = typeof payload.unique_user_count === "number" ? payload.unique_user_count : null;
    if (users !== null) {
      return `${users.toLocaleString()} users`;
    }
    return null;
  }
  if (alert.kind === "ingest_cap_hit") {
    const cap = typeof payload.cap_per_hour === "number" ? payload.cap_per_hour : null;
    if (cap !== null) {
      return `${cap.toLocaleString()}/h cap`;
    }
    return null;
  }
  return null;
}

/** Read-only Rule · env · threshold line for detail header. */
export function getAlertDetailScopeKv(alert?: AlertRow | null): string | null {
  if (!alert || alert.kind === "ingest_cap_hit") {
    return null;
  }
  const payload = parsePayload(alert.payload_json);
  const parts: string[] = [];
  const rule = getAlertListRuleName(alert);
  if (rule) {
    parts.push(rule);
  }
  const env = typeof payload.environment === "string" ? payload.environment.trim() : "";
  if (env) {
    parts.push(env);
  }
  const condition = getAlertConditionChip(alert);
  if (condition) {
    parts.push(condition);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function getAlertListIssueLine(alert?: AlertRow | null): string | null {
  if (!alert) {
    return null;
  }
  const payload = parsePayload(alert.payload_json);
  if (alert.kind === "ingest_cap_hit") {
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    return message || "Check project ingest settings";
  }
  const title = payload.title;
  if (typeof title === "string" && title.trim()) {
    return title.trim();
  }
  const culprit = typeof payload.culprit === "string" ? payload.culprit.trim() : "";
  if (culprit) {
    return culprit;
  }
  if (alert.kind === "custom") {
    const detail = getAlertDetail(alert);
    return detail.trim() || null;
  }
  return null;
}

export type AlertOutputChannel = {
  id: string;
  label: string;
  detail: string;
};

export function getAlertOutputChannels(
  alert?: AlertRow | null,
  webhookCount?: number | null,
): AlertOutputChannel[] {
  if (!alert) {
    return [];
  }
  const channels: AlertOutputChannel[] = [
    { id: "feed", label: "Alerts feed", detail: "In-app history" },
  ];
  const rule = getAlertRule(alert);
  const webhookEvent = rule?.webhookEvent ?? "";
  const dispatchesWebhooks =
    webhookEvent.length > 0 && !webhookEvent.toLowerCase().includes("not dispatched");
  if (dispatchesWebhooks) {
    let detail = "Subscribed endpoints";
    if (webhookCount === 0) {
      detail = "No endpoints configured";
    } else if (typeof webhookCount === "number" && webhookCount > 0) {
      detail = `${webhookCount} endpoint${webhookCount === 1 ? "" : "s"}`;
    } else if (webhookCount === null) {
      detail = "Checking endpoints…";
    }
    channels.push({ id: "webhooks", label: "Webhooks", detail });
  }
  return channels;
}

export function formatAlertDetailTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isoTimestampHasSubsecondPrecision(iso: string): boolean {
  return /\.\d{1,9}(?:Z|[+-]\d{2}:?\d{2})?$/i.test(iso.trim());
}

export interface AlertTimestampPrecise {
  absolute: string;
  relative: string;
  isoSubline: string | null;
}

/** History detail — absolute locale time, relative age, optional ISO subline when source has ms. */
export function formatAlertTimestampPrecise(iso: string, nowMs: number = Date.now()): AlertTimestampPrecise {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { absolute: iso, relative: "—", isoSubline: null };
  }
  const hasMs = isoTimestampHasSubsecondPrecision(iso);
  const absolute = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...(hasMs ? { fractionalSecondDigits: 3 as const } : {}),
  });
  return {
    absolute,
    relative: formatRelativeTime(iso, nowMs),
    isoSubline: hasMs ? iso : null,
  };
}

export type AlertDetailKvRow = { label: string; value: string; mono?: boolean };

export interface AlertDetailVelocityStats {
  current: number;
  previous: number;
  ratio: number | null;
  windowMinutes: number;
  boundaryRows: AlertDetailKvRow[];
}

export interface AlertDetailStructuredFields {
  timestamp: AlertTimestampPrecise;
  lifecycle: {
    state: AlertSignalState;
    label: string;
    openDuration: string | null;
  };
  kindChip: string;
  triggerExplanation: string;
  triggerRows: AlertDetailKvRow[];
  impactRows: AlertDetailKvRow[];
  velocityStats: AlertDetailVelocityStats | null;
  linkedIssue: {
    issueId: string;
    issueShort: string;
    rows: AlertDetailKvRow[];
    correlatedIssueIds: string[];
  } | null;
}

function readPayloadStringField(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function formatWindowBoundaryLabel(iso: string): string {
  return formatAlertTimestampPrecise(iso).absolute;
}

function buildVelocityBoundaryRows(payload: Record<string, unknown>): AlertDetailKvRow[] {
  const rows: AlertDetailKvRow[] = [];
  const currentStart = readPayloadStringField(payload, [
    "current_window_start",
    "current_window_start_at",
    "current_window_starts_at",
  ]);
  const currentEnd = readPayloadStringField(payload, [
    "current_window_end",
    "current_window_end_at",
    "current_window_ends_at",
  ]);
  const previousStart = readPayloadStringField(payload, [
    "previous_window_start",
    "previous_window_start_at",
    "previous_window_starts_at",
  ]);
  const previousEnd = readPayloadStringField(payload, [
    "previous_window_end",
    "previous_window_end_at",
    "previous_window_ends_at",
  ]);
  if (currentStart && currentEnd) {
    rows.push({
      label: "Current window",
      value: `${formatWindowBoundaryLabel(currentStart)} → ${formatWindowBoundaryLabel(currentEnd)}`,
      mono: true,
    });
  } else if (currentStart) {
    rows.push({ label: "Current window from", value: formatWindowBoundaryLabel(currentStart), mono: true });
  }
  if (previousStart && previousEnd) {
    rows.push({
      label: "Prior window",
      value: `${formatWindowBoundaryLabel(previousStart)} → ${formatWindowBoundaryLabel(previousEnd)}`,
      mono: true,
    });
  } else if (previousStart) {
    rows.push({ label: "Prior window from", value: formatWindowBoundaryLabel(previousStart), mono: true });
  }
  return rows;
}

function buildTriggerRows(alert: AlertRow): AlertDetailKvRow[] {
  const payload = parsePayload(alert.payload_json);
  const rows: AlertDetailKvRow[] = [];
  const thresholdCaption = getAlertThresholdCaption(alert);
  if (thresholdCaption) {
    rows.push({ label: "Threshold", value: thresholdCaption, mono: true });
  }
  const ratio = typeof payload.ratio === "number" ? payload.ratio : null;
  if (ratio !== null) {
    rows.push({
      label: "Observed ratio",
      value: `${ratio.toFixed(2)}× (+${Math.round((ratio - 1) * 100)}%)`,
      mono: true,
    });
  }
  const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
  if (threshold !== null && alert.kind === "custom") {
    rows.push({ label: "Rule threshold", value: threshold.toLocaleString(), mono: true });
  }
  const env = typeof payload.environment === "string" ? payload.environment.trim() : "";
  if (env) {
    rows.push({ label: "Environment", value: env, mono: true });
  }
  const condition = getAlertConditionChip(alert);
  if (condition && !rows.some((row) => row.value === condition)) {
    rows.push({ label: "Condition", value: condition, mono: true });
  }
  return rows;
}

function buildImpactRows(alert: AlertRow): AlertDetailKvRow[] {
  const lines = getAlertDetailImpactLines(alert);
  return lines.map((line) => ({
    label: line.label,
    value: line.value,
    mono: true,
  }));
}

function isVelocityKindAlert(alert: AlertRow): boolean {
  const payload = parsePayload(alert.payload_json);
  const ruleKind =
    alert.kind === "custom" && typeof payload.rule_kind === "string"
      ? normalizeAlertKind(payload.rule_kind)
      : normalizeAlertKind(alert.kind);
  return ruleKind === "velocity_spike" || alert.kind === "velocity";
}

/** Structured KV blocks for History detail cards (right pane). */
export function getAlertDetailStructuredFields(
  alert?: AlertRow | null,
  nowMs: number = Date.now(),
): AlertDetailStructuredFields | null {
  if (!alert) {
    return null;
  }
  const payload = parsePayload(alert.payload_json);
  const state = getAlertSignalState(alert, nowMs);
  const openDuration =
    state === "firing" || state === "fired" ? getAlertOpenDurationLabel(alert, nowMs) : null;

  let velocityStats: AlertDetailVelocityStats | null = null;
  if (isVelocityKindAlert(alert)) {
    const { current, previous } = getAlertVelocityWindowPair(alert);
    if (current !== null && previous !== null) {
      const ratio = typeof payload.ratio === "number" ? payload.ratio : null;
      velocityStats = {
        current,
        previous,
        ratio,
        windowMinutes: VELOCITY_WINDOW_MINUTES,
        boundaryRows: buildVelocityBoundaryRows(payload),
      };
    }
  }

  if (velocityStats) {
    const extraRows: AlertDetailKvRow[] = [
      {
        label: `Events (${velocityStats.windowMinutes}m current)`,
        value: velocityStats.current.toLocaleString(),
        mono: true,
      },
      {
        label: `Events (prior ${velocityStats.windowMinutes}m)`,
        value: velocityStats.previous.toLocaleString(),
        mono: true,
      },
    ];
    if (velocityStats.ratio !== null) {
      extraRows.push({
        label: "Velocity change",
        value: `+${Math.round((velocityStats.ratio - 1) * 100)}%`,
        mono: true,
      });
    }
    const impactRows = [...buildImpactRows(alert)];
    for (const row of extraRows) {
      if (!impactRows.some((existing) => existing.label === row.label)) {
        impactRows.push(row);
      }
    }
    if (velocityStats.boundaryRows.length > 0) {
      impactRows.push(...velocityStats.boundaryRows);
    }
    return {
      timestamp: formatAlertTimestampPrecise(alert.fired_at, nowMs),
      lifecycle: { state, label: getAlertSignalStateLabel(state), openDuration },
      kindChip: getAlertKindChipLabel(alert.kind),
      triggerExplanation: getAlertTriggerExplanation(alert),
      triggerRows: buildTriggerRows(alert),
      impactRows,
      velocityStats,
      linkedIssue: buildLinkedIssueStructured(alert),
    };
  }

  return {
    timestamp: formatAlertTimestampPrecise(alert.fired_at, nowMs),
    lifecycle: { state, label: getAlertSignalStateLabel(state), openDuration },
    kindChip: getAlertKindChipLabel(alert.kind),
    triggerExplanation: getAlertTriggerExplanation(alert),
    triggerRows: buildTriggerRows(alert),
    impactRows: buildImpactRows(alert),
    velocityStats: null,
    linkedIssue: buildLinkedIssueStructured(alert),
  };
}

function buildLinkedIssueStructured(alert: AlertRow): AlertDetailStructuredFields["linkedIssue"] {
  if (alert.kind === "ingest_cap_hit" || !alert.issue_id) {
    return null;
  }
  const linked = getAlertLinkedIssueMeta(alert);
  const issueShort = `#${alert.issue_id.replace(/-/g, "").slice(0, 8)}`;
  const rows: AlertDetailKvRow[] = [
    { label: "Issue", value: issueShort, mono: true },
  ];
  if (linked.release) {
    rows.push({ label: "Release", value: linked.release, mono: true });
  }
  if (linked.culprit) {
    rows.push({ label: "Culprit", value: linked.culprit, mono: true });
  }
  if (linked.fingerprintShort) {
    rows.push({ label: "Fingerprint", value: `#${linked.fingerprintShort}`, mono: true });
  }
  return {
    issueId: alert.issue_id,
    issueShort,
    rows,
    correlatedIssueIds: getAlertCorrelatedIssueIds(alert),
  };
}

export function getAlertSeverityForAlert(alert?: AlertRow | null): AlertSeverity {
  if (!alert) {
    return "warning";
  }
  const payload = parsePayload(alert.payload_json);
  if (alert.kind === "users_affected") {
    const threshold =
      typeof payload.threshold === "number" ? payload.threshold : 0;
    return threshold >= 100 ? "danger" : "warning";
  }
  return getAlertSeverity(alert.kind);
}

export function getAlertTitle(alert?: AlertRow | null): string {
  if (!alert) {
    return "Unknown alert";
  }
  const payload = parsePayload(alert.payload_json);
  if (alert.kind === "ingest_cap_hit") {
    const projectName =
      typeof payload.project_name === "string"
        ? payload.project_name
        : null;
    return projectName ? `${projectName} ingest cap reached` : "Ingest cap reached";
  }
  if (alert.kind === "custom") {
    const ruleName =
      typeof payload.rule_name === "string" ? payload.rule_name : null;
    const title = payload.title;
    if (ruleName && typeof title === "string" && title.trim()) {
      return `${ruleName}: ${title}`;
    }
    if (ruleName) {
      return ruleName;
    }
  }
  const title = payload.title;
  if (typeof title === "string" && title.trim()) {
    return title;
  }
  return getAlertRuleName(alert.kind);
}

export function formatVelocityDetail(payload?: Record<string, unknown> | null): string {
  const p = payload && typeof payload === "object" ? payload : {};
  const ratio = typeof p.ratio === "number" ? p.ratio : null;
  const current =
    typeof p.current_window === "number" ? p.current_window : null;
  const previous =
    typeof p.previous_window === "number" ? p.previous_window : null;

  if (ratio !== null && current !== null && previous !== null) {
    const pct = Math.round((ratio - 1) * 100);
    const eventNoun = current === 1 ? "event" : "events";
    return `${current} ${eventNoun} in ${VELOCITY_WINDOW_MINUTES}m · +${pct}% vs prior ${VELOCITY_WINDOW_MINUTES}m (${previous})`;
  }

  return `Event rate jumped more than ${Math.round((VELOCITY_SPIKE_RATIO - 1) * 100)}% in ${VELOCITY_WINDOW_MINUTES} minutes`;
}

export function formatRegressionDetail(payload?: Record<string, unknown> | null): string {
  const p = payload && typeof payload === "object" ? payload : {};
  const release = typeof p.release === "string" ? p.release : null;
  const resolvedIn =
    typeof p.resolved_in_release === "string"
      ? p.resolved_in_release
      : null;

  if (release && resolvedIn) {
    return `Reappeared in ${release} after resolving in ${resolvedIn}`;
  }
  if (release) {
    return `Reappeared in release ${release}`;
  }
  return "Exception came back after you marked it resolved";
}

export function formatNewIssueDetail(payload?: Record<string, unknown> | null): string {
  const p = payload && typeof payload === "object" ? payload : {};
  const release = typeof p.release === "string" ? p.release : null;
  if (release) {
    return `First seen in release ${release}`;
  }
  return "New exception group created";
}

export function formatEventMilestoneDetail(payload?: Record<string, unknown> | null): string {
  const p = payload && typeof payload === "object" ? payload : {};
  const threshold = typeof p.threshold === "number" ? p.threshold : null;
  const eventCount = typeof p.event_count === "number" ? p.event_count : null;
  if (threshold !== null && eventCount !== null) {
    return `Crossed ${threshold.toLocaleString()} events (${eventCount.toLocaleString()} total)`;
  }
  if (threshold !== null) {
    return `Crossed ${threshold.toLocaleString()} events`;
  }
  return "Issue crossed a high-volume milestone";
}

export function formatUsersAffectedDetail(payload?: Record<string, unknown> | null): string {
  const p = payload && typeof payload === "object" ? payload : {};
  const threshold = typeof p.threshold === "number" ? p.threshold : null;
  const userCount =
    typeof p.unique_user_count === "number" ? p.unique_user_count : null;
  if (threshold !== null && userCount !== null) {
    return `${userCount.toLocaleString()} distinct users affected (milestone: ${threshold})`;
  }
  return "More distinct users are hitting this issue";
}

export function getAlertDetail(alert?: AlertRow | null): string {
  if (!alert) {
    return "";
  }
  const payload = parsePayload(alert.payload_json);
  if (alert.kind === "velocity_spike" || alert.kind === "velocity") {
    return formatVelocityDetail(payload);
  }
  if (alert.kind === "regression") {
    return formatRegressionDetail(payload);
  }
  if (alert.kind === "new_issue") {
    return formatNewIssueDetail(payload);
  }
  if (alert.kind === "event_milestone") {
    return formatEventMilestoneDetail(payload);
  }
  if (alert.kind === "users_affected") {
    return formatUsersAffectedDetail(payload);
  }
  if (alert.kind === "custom") {
    return formatCustomRuleTriggerDetail(payload);
  }
  if (alert.kind === "ingest_cap_hit") {
    const message = payload.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    const cap = typeof payload.cap_per_hour === "number" ? payload.cap_per_hour : null;
    if (cap !== null) {
      return `Hourly ingest cap (${cap.toLocaleString()} events) was reached`;
    }
    return "Project ingest cap reached";
  }
  const message = payload.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }
  return getAlertRuleName(alert.kind);
}

function formatCustomRuleTriggerDetail(payload: Record<string, unknown>): string {
  const ruleName =
    typeof payload.rule_name === "string" ? payload.rule_name : "Custom rule";
  const ruleKind =
    typeof payload.rule_kind === "string" ? payload.rule_kind : null;
  const env = typeof payload.environment === "string" ? payload.environment : null;
  const parts: string[] = [];

  if (ruleKind === "velocity_spike") {
    parts.push(
      `Rule “${ruleName}” matched: velocity spike vs prior ${VELOCITY_WINDOW_MINUTES}m window`,
    );
  } else if (ruleKind === "regression") {
    parts.push(`Rule “${ruleName}” matched: issue regressed after resolve`);
  } else if (ruleKind === "issue_created") {
    parts.push(`Rule “${ruleName}” matched: new issue in scope`);
  } else {
    parts.push(`Rule “${ruleName}” matched`);
  }

  if (env) {
    parts.push(`environment ${env}`);
  }
  const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
  if (threshold !== null) {
    parts.push(`threshold ${threshold.toLocaleString()}`);
  }
  return parts.join(" · ");
}

/** Human explanation of why this alert fired (detail pane). */
export function getAlertTriggerExplanation(alert?: AlertRow | null): string {
  return getAlertDetailTriggerSummary(alert);
}

export function getAlertOpenDurationLabel(alert: AlertRow, nowMs: number = Date.now()): string {
  const firedMs = new Date(alert.fired_at).getTime();
  if (!Number.isFinite(firedMs)) {
    return "—";
  }
  const minutes = Math.max(1, Math.round((nowMs - firedMs) / 60_000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function getAlertConditionKindLabel(ruleKind: string): string {
  const normalized = normalizeAlertKind(ruleKind);
  if (normalized === "velocity_spike") {
    return "Velocity";
  }
  if (normalized === "regression") {
    return "Regression";
  }
  if (normalized === "new_issue" || normalized === "issue_created") {
    return "New issue";
  }
  if (normalized === "event_milestone") {
    return "Volume";
  }
  if (normalized === "users_affected") {
    return "Users";
  }
  if (normalized === "ingest_cap_hit") {
    return "Ingest cap";
  }
  if (normalized === "noise_spike") {
    return "Noise spike";
  }
  return normalized.replace(/_/g, " ");
}

function shortenAlertConditionThreshold(ruleKind: string, threshold: string): string {
  const normalized = normalizeAlertKind(ruleKind);
  if (normalized === "regression") {
    return "Later release";
  }
  if (normalized === "new_issue" || normalized === "issue_created") {
    return "First event";
  }
  if (normalized === "event_milestone") {
    const match = threshold.match(/([\d][\d,]*)/);
    return match ? `${match[1]} events` : "Milestone";
  }
  if (threshold.length > 28) {
    return `${threshold.slice(0, 25)}…`;
  }
  return threshold;
}

/** Mono condition for detail header (Stitch). */
export function getAlertConditionChip(alert?: AlertRow | null): string {
  if (!alert) {
    return "";
  }
  const payload = parsePayload(alert.payload_json);
  const ruleKind =
    alert.kind === "custom" && typeof payload.rule_kind === "string"
      ? payload.rule_kind
      : normalizeAlertKind(alert.kind);
  const kindLabel = getAlertConditionKindLabel(ruleKind);
  const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
  if (normalizeAlertKind(ruleKind) === "velocity_spike" && threshold !== null) {
    return alert.kind === "custom" ? `${kindLabel} > ${threshold}%` : `${kindLabel} > ${threshold}`;
  }
  if (normalizeAlertKind(ruleKind) === "velocity_spike") {
    return `${kindLabel} > ${Math.round((VELOCITY_SPIKE_RATIO - 1) * 100)}%`;
  }
  const rule = getAlertRule(alert);
  if (rule?.threshold) {
    return `${kindLabel} · ${shortenAlertConditionThreshold(ruleKind, rule.threshold)}`;
  }
  return kindLabel;
}

export function getAlertThresholdCaption(alert?: AlertRow | null): string {
  if (!alert) {
    return "";
  }
  const payload = parsePayload(alert.payload_json);
  const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
  const ruleKind =
    alert.kind === "custom" && typeof payload.rule_kind === "string"
      ? payload.rule_kind
      : normalizeAlertKind(alert.kind);
  if (ruleKind === "velocity_spike" || ruleKind === "velocity") {
    if (threshold !== null && alert.kind === "custom") {
      return `>${threshold}% vs prior ${VELOCITY_WINDOW_MINUTES}m`;
    }
    const ratio = typeof payload.ratio === "number" ? payload.ratio : null;
    if (ratio !== null) {
      return `+${Math.round((ratio - 1) * 100)}% vs prior ${VELOCITY_WINDOW_MINUTES}m`;
    }
    return `>${Math.round((VELOCITY_SPIKE_RATIO - 1) * 100)}% vs prior ${VELOCITY_WINDOW_MINUTES}m`;
  }
  if (threshold !== null) {
    return `milestone ${threshold.toLocaleString()} events`;
  }
  const rule = getAlertRule(alert);
  if (rule?.threshold) {
    return rule.threshold;
  }
  return `${VELOCITY_WINDOW_MINUTES}m evaluation window`;
}

function getAlertTriggerContext(alert: AlertRow): {
  title: string;
  envSuffix: string;
  ruleKind: string;
  payload: Record<string, unknown>;
} {
  const payload = parsePayload(alert.payload_json);
  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : getAlertTitle(alert);
  const env =
    typeof payload.environment === "string" && payload.environment.trim()
      ? payload.environment.trim()
      : null;
  const ruleKind =
    alert.kind === "custom" && typeof payload.rule_kind === "string"
      ? payload.rule_kind
      : alert.kind;
  return {
    title,
    envSuffix: env ? ` in ${env}` : "",
    ruleKind,
    payload,
  };
}

/** Single sans-serif sentence for History detail header. */
export function getAlertDetailTriggerSummary(alert?: AlertRow | null): string {
  if (!alert) {
    return "";
  }
  const { title, envSuffix, ruleKind, payload } = getAlertTriggerContext(alert);
  const normalizedKind = normalizeAlertKind(ruleKind);

  if (normalizedKind === "velocity_spike" || alert.kind === "velocity") {
    return `Event rate jumped vs the prior ${VELOCITY_WINDOW_MINUTES}m window on “${title}”${envSuffix}.`;
  }
  if (alert.kind === "regression" || normalizedKind === "regression") {
    return `Resolved issue came back on “${title}”${envSuffix}.`;
  }
  if (
    alert.kind === "new_issue" ||
    alert.kind === "issue_created" ||
    normalizedKind === "issue_created"
  ) {
    return `New issue “${title}”${envSuffix}.`;
  }
  if (alert.kind === "event_milestone" || normalizedKind === "event_milestone") {
    const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
    if (threshold !== null) {
      return `Event volume crossed ${threshold.toLocaleString()} on “${title}”${envSuffix}.`;
    }
    return `Event volume milestone on “${title}”${envSuffix}.`;
  }
  if (alert.kind === "users_affected" || normalizedKind === "users_affected") {
    const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
    if (threshold !== null) {
      return `Distinct users crossed ${threshold.toLocaleString()} on “${title}”${envSuffix}.`;
    }
    return `More users affected on “${title}”${envSuffix}.`;
  }
  if (alert.kind === "ingest_cap_hit") {
    const detail = getAlertDetail(alert);
    return detail ? (detail.endsWith(".") ? detail : `${detail}.`) : "Project ingest cap reached.";
  }
  if (alert.kind === "custom") {
    const detail = getAlertDetail(alert);
    if (detail) {
      return detail.endsWith(".") ? detail : `${detail}.`;
    }
    return `Custom rule matched on “${title}”${envSuffix}.`;
  }
  const detail = getAlertDetail(alert);
  if (detail) {
    return detail.endsWith(".") ? detail : `${detail}.`;
  }
  return `Alert fired on “${title}”${envSuffix}.`;
}

export function getAlertTriggerAnalysisCallout(alert?: AlertRow | null): string {
  if (!alert) {
    return "";
  }
  return getAlertDetailTriggerSummary(alert);
}

export function getAlertImpactStatExtras(alert?: AlertRow | null): {
  eventsDelta: string | null;
  eventsBaseline: string | null;
  usersSubtext: string | null;
  severitySubtext: string | null;
} {
  if (!alert) {
    return { eventsDelta: null, eventsBaseline: null, usersSubtext: null, severitySubtext: null };
  }
  const payload = parsePayload(alert.payload_json);
  const ratio = typeof payload.ratio === "number" ? payload.ratio : null;
  const previous =
    typeof payload.previous_window === "number" ? payload.previous_window : null;
  const eventsDelta =
    ratio !== null ? `+${Math.round((ratio - 1) * 100)}%` : null;
  const eventsBaseline =
    previous !== null
      ? `Baseline: ~${previous >= 1000 ? `${Math.round(previous / 1000)}k` : previous} / ${VELOCITY_WINDOW_MINUTES}m`
      : typeof payload.baseline_label === "string"
        ? `Baseline: ${payload.baseline_label} / ${VELOCITY_WINDOW_MINUTES}m`
        : null;
  const usersSubtext =
    typeof payload.traffic_share === "string"
      ? payload.traffic_share
      : alert.issue_id
        ? null
        : null;
  const severitySubtext = alert.read_at ? "Marked resolved in History" : "Still unresolved";
  return { eventsDelta, eventsBaseline, usersSubtext, severitySubtext };
}

export function getAlertLinkedIssueMeta(alert?: AlertRow | null): {
  release: string | null;
  culprit: string | null;
  fingerprintShort: string | null;
} {
  if (!alert) {
    return { release: null, culprit: null, fingerprintShort: null };
  }
  const payload = parsePayload(alert.payload_json);
  const release =
    typeof payload.release === "string"
      ? payload.release
      : typeof payload.resolved_in_release === "string"
        ? payload.resolved_in_release
        : null;
  const culprit = typeof payload.culprit === "string" ? payload.culprit : null;
  let fingerprintShort: string | null =
    typeof payload.fingerprint === "string"
      ? payload.fingerprint
      : typeof payload.fingerprint_short === "string"
        ? payload.fingerprint_short
        : null;
  return { release, culprit, fingerprintShort };
}

export function getAlertEventsStatLabel(alert?: AlertRow | null): string {
  if (!alert) {
    return "Events";
  }
  const payload = parsePayload(alert.payload_json);
  if (typeof payload.event_count !== "number" && typeof payload.current_window === "number") {
    return `Events (${VELOCITY_WINDOW_MINUTES}m window)`;
  }
  return "Events";
}

export function getAlertVelocityWindowPair(alert?: AlertRow | null): {
  current: number | null;
  previous: number | null;
} {
  if (!alert) {
    return { current: null, previous: null };
  }
  const payload = parsePayload(alert.payload_json);
  return {
    current: typeof payload.current_window === "number" ? payload.current_window : null,
    previous: typeof payload.previous_window === "number" ? payload.previous_window : null,
  };
}

export type AlertDispatchAuditRow = {
  id: string;
  channel: string;
  target: string;
  status: string;
  statusOk: boolean;
  timeLabel: string;
};

function formatDispatchClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const hasMs = isoTimestampHasSubsecondPrecision(iso);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    hour12: false,
    ...(hasMs ? { fractionalSecondDigits: 3 as const } : {}),
  });
}

export function getAlertLatestDeliveredAtIso(alert?: AlertRow | null): string | null {
  if (!alert) {
    return null;
  }
  const payload = parsePayload(alert.payload_json);
  const raw = payload.dispatches;
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  let latestIso: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const entry of raw) {
    const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const deliveredAt =
      typeof row.delivered_at === "string"
        ? row.delivered_at
        : typeof row.at === "string"
          ? row.at
          : null;
    if (!deliveredAt) {
      continue;
    }
    const ms = new Date(deliveredAt).getTime();
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latestIso = deliveredAt;
    }
  }
  return latestIso;
}

/** One-line collapsed Outputs preview when playground/API dispatch audit exists. */
export function getAlertOutputsCollapsedPreview(
  alert?: AlertRow | null,
  nowMs: number = Date.now(),
): string | null {
  if (!alert) {
    return null;
  }
  const rows = getAlertDispatchAuditRows(alert);
  const payload = parsePayload(alert.payload_json);
  const raw = payload.dispatches;
  if (!Array.isArray(raw) || raw.length === 0 || rows.length === 0) {
    return null;
  }
  const channelLine = rows.map((row) => `${row.channel} ${row.target}`).join(" · ");
  const latestIso = getAlertLatestDeliveredAtIso(alert);
  if (!latestIso) {
    return channelLine;
  }
  return `${channelLine} · Last delivered ${formatRelativeTime(latestIso, nowMs)}`;
}

export function getAlertDispatchAuditRows(
  alert?: AlertRow | null,
  webhookCount?: number | null,
): AlertDispatchAuditRow[] {
  if (!alert) {
    return [];
  }
  const payload = parsePayload(alert.payload_json);
  const raw = payload.dispatches;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((entry, index) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const channel = typeof row.channel === "string" ? row.channel : "Channel";
      const target = typeof row.target === "string" ? row.target : "None";
      const status = typeof row.status === "string" ? row.status : "Sent";
      const deliveredAt =
        typeof row.delivered_at === "string"
          ? row.delivered_at
          : typeof row.at === "string"
            ? row.at
            : alert.fired_at;
      const statusOk =
        /^(200|202|delivered|triggered|sent|ok)/i.test(status) || status.toLowerCase().includes("accepted");
      return {
        id: `${alert.id}-dispatch-${index}`,
        channel,
        target,
        status,
        statusOk,
        timeLabel: `${formatDispatchClock(deliveredAt)} UTC`,
      };
    });
  }
  return getAlertOutputChannels(alert, webhookCount).map((channel) => ({
    id: channel.id,
    channel: channel.label,
    target: channel.detail,
    status: channel.id === "feed" ? "Recorded" : "Configured",
    statusOk: channel.id === "feed",
    timeLabel: `${formatDispatchClock(alert.fired_at)} UTC`,
  }));
}

export type AlertReadState = "unread" | "read" | "muted";

export function getAlertReadState(alert?: AlertRow | null): AlertReadState {
  if (!alert) {
    return "read";
  }
  if (alert.ignored) {
    return "muted";
  }
  if (alert.read_at) {
    return "read";
  }
  return "unread";
}

export function getAlertReadStateLabel(alert?: AlertRow | null): string {
  switch (getAlertReadState(alert)) {
    case "unread":
      return "Unread";
    case "read":
      return "Resolved";
    case "muted":
      return "Snoozed";
  }
}

export function getAlertReadStateHint(alert?: AlertRow | null): string | null {
  if (!alert?.read_at || alert.ignored) {
    return null;
  }
  return `Resolved ${formatRelativeTime(alert.read_at)}`;
}

export function getAlertsHistoryLinkForIssue(projectId: string, issueId: string): string {
  const params = new URLSearchParams();
  params.set("q", `issue:${issueId}`);
  return `${projectPath(projectId, "alerts")}?${params.toString()}`;
}

export function getIssueLink(alert?: AlertRow | null, projectId?: string | null): string {
  const pid = projectId ?? alert?.project_id ?? "";
  if (!pid) {
    return "/";
  }
  if (alert?.kind === "ingest_cap_hit") {
    return projectSettingsPath(pid, "general");
  }
  const params = new URLSearchParams();
  if (alert?.kind === "regression") {
    params.set("q", "is:regression");
  }
  if (alert?.kind === "new_issue") {
    params.set("q", "is:unresolved");
  }
  if (alert?.issue_id) {
    params.set("issue", alert.issue_id);
  }
  const suffix = params.toString();
  const base = projectPath(pid, "issues");
  return suffix ? `${base}?${suffix}` : base;
}

export function getAlertRule(alert?: AlertRow | null): AlertRuleDefinition | undefined {
  if (!alert) {
    return undefined;
  }
  const normalizedKind = alert.kind === "velocity" ? "velocity_spike" : alert.kind;
  return ALERT_RULES.find((rule) => rule.id === normalizedKind);
}

function timeWindowCutoff(window: AlertTimeWindow): number | null {
  return timeWindowCutoffMs(window);
}

export function normalizeAlertKind(kind: string): string {
  return kind === "velocity" ? "velocity_spike" : kind;
}

/** Map API alert-rule `kind` to History kind filter. */
export function ruleKindToAlertKindFilter(ruleKind: string): AlertKindFilter {
  if (ruleKind === "issue_created") {
    return "new_issue";
  }
  if (ruleKind === "velocity_spike" || ruleKind === "regression") {
    return ruleKind as AlertKindFilter;
  }
  return "custom";
}

export type HistoryRuleFocus = {
  ruleName: string;
  ruleId?: string | null;
  kind?: AlertKindFilter;
};

/** Map a fired alert row to the History kind filter used in Configure → View history. */
export function getAlertHistoryKindFilter(alert: AlertRow): AlertKindFilter {
  const normalizedKind = alert.kind === "velocity" ? "velocity_spike" : alert.kind;
  if (normalizedKind === "custom") {
    const payload = parsePayload(alert.payload_json);
    const ruleKind = typeof payload.rule_kind === "string" ? payload.rule_kind.trim() : "";
    return ruleKindToAlertKindFilter(ruleKind || "custom");
  }
  if (normalizedKind === "new_issue") {
    return "new_issue";
  }
  if (
    normalizedKind === "velocity_spike" ||
    normalizedKind === "regression" ||
    normalizedKind === "event_milestone" ||
    normalizedKind === "users_affected" ||
    normalizedKind === "ingest_cap_hit"
  ) {
    return normalizedKind;
  }
  return "custom";
}

export function alertMatchesRuleName(alert: AlertRow, ruleName: string): boolean {
  const needle = ruleName.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  if (getAlertRuleDisplayName(alert).toLowerCase() === needle) {
    return true;
  }
  const payload = parsePayload(alert.payload_json);
  const fromPayload = typeof payload.rule_name === "string" ? payload.rule_name.trim().toLowerCase() : "";
  if (fromPayload === needle) {
    return true;
  }
  const ruleKind = typeof payload.rule_kind === "string" ? payload.rule_kind.trim() : "";
  if (ruleKind && getAlertRuleName(ruleKind).toLowerCase() === needle) {
    return true;
  }
  return getAlertRuleName(alert.kind).toLowerCase() === needle;
}

export function alertMatchesHistoryRuleFocus(alert: AlertRow, focus: HistoryRuleFocus): boolean {
  const hasRuleId = Boolean(focus.ruleId?.trim());
  const hasName = Boolean(focus.ruleName.trim());
  const hasKind = Boolean(focus.kind && focus.kind !== "all");
  if (!hasRuleId && !hasName && !hasKind) {
    return true;
  }

  const payload = parsePayload(alert.payload_json);
  const focusRuleId = focus.ruleId?.trim();
  if (focusRuleId) {
    const alertRuleId = typeof payload.rule_id === "string" ? payload.rule_id.trim() : "";
    if (alertRuleId === focusRuleId) {
      return true;
    }
  }

  if (hasName && alertMatchesRuleName(alert, focus.ruleName)) {
    return true;
  }

  const kind = focus.kind;
  if (hasKind && getAlertHistoryKindFilter(alert) === kind) {
    const alertRuleId = typeof payload.rule_id === "string" ? payload.rule_id.trim() : "";
    if (!alertRuleId) {
      return true;
    }
  }

  return false;
}

export function isAlertUnread(alert?: AlertRow | null): boolean {
  if (!alert) {
    return false;
  }
  return !alert.read_at && !alert.ignored;
}

export type AlertLifecycle = "active" | "acknowledged" | "muted";

/** Unread alerts in the last 30 minutes read as “still firing”; older unread as “fired”. */
export const ALERT_FIRING_WINDOW_MS = 30 * 60 * 1000;

export type AlertSignalState = "firing" | "fired" | "acknowledged" | "muted";

export function getAlertSignalState(alert: AlertRow, nowMs: number = Date.now()): AlertSignalState {
  if (alert.ignored) {
    return "muted";
  }
  if (alert.read_at) {
    return "acknowledged";
  }
  const firedMs = new Date(alert.fired_at).getTime();
  if (Number.isFinite(firedMs) && nowMs - firedMs <= ALERT_FIRING_WINDOW_MS) {
    return "firing";
  }
  return "fired";
}

export function getAlertSignalStateLabel(state: AlertSignalState): string {
  switch (state) {
    case "firing":
      return "Firing";
    case "fired":
      return "Fired";
    case "acknowledged":
      return "Resolved";
    case "muted":
      return "Snoozed";
  }
}

export function getAlertLifecycle(alert: AlertRow): AlertLifecycle {
  const state = getAlertSignalState(alert);
  if (state === "muted") {
    return "muted";
  }
  if (state === "acknowledged") {
    return "acknowledged";
  }
  return "active";
}

/** Latest `fired_at` per alert kind for configure “last triggered” column. */
export function buildLastTriggeredByKind(alerts: AlertRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of alerts) {
    const existing = map[row.kind];
    if (!existing || new Date(row.fired_at).getTime() > new Date(existing).getTime()) {
      map[row.kind] = row.fired_at;
    }
  }
  return map;
}

export function filterAlertsByViewMode(
  alerts?: AlertRow[] | null,
  mode: AlertViewMode = "unread",
): AlertRow[] {
  const safe = Array.isArray(alerts) ? alerts.filter((a): a is AlertRow => Boolean(a)) : [];
  if (mode === "all") {
    return safe;
  }
  if (mode === "unread") {
    return safe.filter((alert) => isAlertUnread(alert));
  }
  if (mode === "resolved") {
    return safe.filter((alert) => Boolean(alert?.read_at) && !alert?.ignored);
  }
  return safe.filter((alert) => Boolean(alert?.ignored));
}

export function countAlertsForViewModes(
  alerts?: AlertRow[] | null,
  timeWindow: AlertTimeWindow = "7d",
  kind: AlertKindFilter = "all",
): Record<AlertViewMode, number> {
  const safe = Array.isArray(alerts) ? alerts : [];
  const scoped = filterAlerts(safe, { kind, timeWindow });
  return {
    all: scoped.length,
    unread: scoped.filter((alert) => isAlertUnread(alert)).length,
    resolved: scoped.filter((alert) => Boolean(alert?.read_at) && !alert?.ignored).length,
    ignored: scoped.filter((alert) => Boolean(alert?.ignored)).length,
  };
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getAlertDayGroupLabel(firedAt?: string | null, now = Date.now()): string {
  if (!firedAt) {
    return "Unknown date";
  }
  const timestamp = new Date(firedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return "Unknown date";
  }

  const todayStart = startOfLocalDay(now);
  const alertStart = startOfLocalDay(timestamp);
  const diffDays = Math.floor((todayStart - alertStart) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return new Date(timestamp).toLocaleDateString(undefined, { weekday: "long" });
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getAlertDayGroupKey(firedAt?: string | null): string {
  if (!firedAt) {
    return "unknown";
  }
  const timestamp = new Date(firedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return "unknown";
  }
  return String(startOfLocalDay(timestamp));
}

export function formatAlertListTime(iso?: string | null, now = Date.now()): string {
  if (!iso) {
    return "—";
  }
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  const todayStart = startOfLocalDay(now);
  const alertStart = startOfLocalDay(timestamp);
  const diffDays = Math.floor((todayStart - alertStart) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (diffDays === 1) {
    return `Yesterday ${new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  if (diffDays < 7) {
    return `${new Date(timestamp).toLocaleDateString(undefined, { weekday: "short" })} ${new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function groupAlertsByDay(
  alerts?: AlertRow[] | null,
  sort: AlertSort = "newest",
  now = Date.now(),
): AlertDayGroup[] {
  const safe = Array.isArray(alerts) ? alerts.filter((a): a is AlertRow => Boolean(a)) : [];
  const groups = new Map<string, AlertDayGroup>();

  for (const alert of safe) {
    if (!alert) continue;
    const key = getAlertDayGroupKey(alert.fired_at);
    const existing = groups.get(key);
    if (existing) {
      existing.alerts.push(alert);
      continue;
    }

    groups.set(key, {
      key,
      label: getAlertDayGroupLabel(alert.fired_at, now),
      alerts: [alert],
    });
  }

  const result = Array.from(groups.values()).map((group) => ({
    ...group,
    alerts: sortAlerts(group.alerts, sort),
  }));

  result.sort((a, b) => {
    const timeA = Number(a.key) || 0;
    const timeB = Number(b.key) || 0;
    if (sort === "oldest") {
      return timeA - timeB;
    }
    return timeB - timeA;
  });

  return result;
}

export function filterAlertsByIssuesQuery(
  alerts?: AlertRow[] | null,
  query = "",
): AlertRow[] {
  const safe = Array.isArray(alerts) ? alerts.filter((a): a is AlertRow => Boolean(a)) : [];
  const parsed = parseQuery(query);
  const search = getSearchText(query).trim().toLowerCase();

  return safe.filter((alert) => {
    if (parsed.lifecycle === "unresolved" && !isAlertUnread(alert)) {
      return false;
    }
    if (parsed.lifecycle === "resolved" && !(Boolean(alert.read_at) && !alert.ignored)) {
      return false;
    }
    if (parsed.lifecycle === "ignored" && !alert.ignored) {
      return false;
    }
    if (parsed.viewModifier === "snoozed" && !alert.ignored) {
      return false;
    }
    if (parsed.viewModifier === "regression") {
      const normalizedKind = alert.kind === "velocity" ? "velocity_spike" : alert.kind;
      if (normalizedKind !== "regression") {
        return false;
      }
    }

    if (parsed.escalating) {
      const normalizedKind = alert.kind === "velocity" ? "velocity_spike" : alert.kind;
      if (normalizedKind !== "velocity_spike") {
        return false;
      }
    }

    if (parsed.environment) {
      const payload = parsePayload(alert.payload_json);
      const env =
        typeof payload.environment === "string" ? payload.environment.trim().toLowerCase() : "";
      if (env !== parsed.environment.trim().toLowerCase()) {
        return false;
      }
    }

    if (parsed.release) {
      const payload = parsePayload(alert.payload_json);
      const release = typeof payload.release === "string" ? payload.release.toLowerCase() : "";
      if (!release.includes(parsed.release.toLowerCase())) {
        return false;
      }
    }

    if (parsed.level) {
      const payload = parsePayload(alert.payload_json);
      const level = typeof payload.level === "string" ? payload.level.toLowerCase() : "";
      if (level && level !== parsed.level.toLowerCase()) {
        return false;
      }
    }

    if (parsed.issueId) {
      const linked = parsed.issueId.trim();
      const primary = alert.issue_id === linked;
      const payload = parsePayload(alert.payload_json);
      const correlated =
        Array.isArray(payload.issue_ids) &&
        payload.issue_ids.some((entry) => typeof entry === "string" && entry === linked);
      if (!primary && !correlated) {
        return false;
      }
    }

    if (search) {
      const blob = [
        getAlertListRuleName(alert),
        getAlertListIssueLine(alert) ?? "",
        getAlertDetail(alert),
      ]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(search)) {
        return false;
      }
    }

    return true;
  });
}

export function issueSortToAlertSort(sort: IssueSortValue): AlertSort {
  switch (sort) {
    case "last_seen_asc":
    case "first_seen_asc":
      return "oldest";
    case "events_desc":
      return "severity";
    default:
      return "newest";
  }
}

export function filterAlerts(
  alerts?: AlertRow[] | null,
  options: {
    kind?: AlertKindFilter;
    timeWindow?: AlertTimeWindow;
  } = {},
): AlertRow[] {
  const safe = Array.isArray(alerts) ? alerts.filter((a): a is AlertRow => Boolean(a)) : [];
  const kind = options.kind ?? "all";
  const cutoff = timeWindowCutoff(options.timeWindow ?? "7d");

  return safe.filter((alert) => {
    if (!alert) return false;
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

export function sortAlerts(alerts?: AlertRow[] | null, sort: AlertSort = "newest"): AlertRow[] {
  const safe = Array.isArray(alerts) ? alerts.filter((a): a is AlertRow => Boolean(a)) : [];
  const rows = [...safe];
  const toTime = (iso?: string | null): number => {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  switch (sort) {
    case "oldest":
      return rows.sort((left, right) => toTime(left.fired_at) - toTime(right.fired_at));
    case "severity":
      return rows.sort((left, right) => {
        const severityDelta =
          (getAlertSeverityForAlert(right) === "danger" ? 1 : 0) -
          (getAlertSeverityForAlert(left) === "danger" ? 1 : 0);
        if (severityDelta !== 0) {
          return severityDelta;
        }
        return toTime(right.fired_at) - toTime(left.fired_at);
      });
    default:
      return rows.sort((left, right) => toTime(right.fired_at) - toTime(left.fired_at));
  }
}

export function countRecentAlerts(
  alerts?: AlertRow[] | null,
  timeWindow: AlertTimeWindow = "7d",
): number {
  const safe = Array.isArray(alerts) ? alerts.filter((a): a is AlertRow => Boolean(a)) : [];
  const cutoff = timeWindowCutoff(timeWindow);
  if (cutoff === null) {
    return safe.length;
  }
  return safe.filter((alert) => new Date(alert.fired_at).getTime() >= cutoff).length;
}

export function countAlertsByKind(alerts?: AlertRow[] | null): {
  velocity: number;
  regression: number;
  newIssue: number;
} {
  const safe = Array.isArray(alerts) ? alerts.filter((a): a is AlertRow => Boolean(a)) : [];
  return safe.reduce(
    (counts, alert) => {
      if (!alert) return counts;
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

export function countUniqueIssueAlerts(alerts?: AlertRow[] | null): number {
  const safe = Array.isArray(alerts) ? alerts.filter((a): a is AlertRow => Boolean(a)) : [];
  const issueIds = new Set(
    safe.map((alert) => alert.issue_id).filter((issueId): issueId is string => Boolean(issueId)),
  );
  return issueIds.size;
}

export function getAlertsPageSubtitle(
  alerts?: AlertRow[] | null,
  loading = false,
  environment?: string,
): string {
  if (loading) {
    return "Loading alerts…";
  }

  const safe = Array.isArray(alerts) ? alerts : [];
  const recent = countRecentAlerts(safe);
  const noun = recent === 1 ? "alert" : "alerts";
  const parts = [`${recent} ${noun} in the last ${RECENT_DAYS} days`];

  if (environment) {
    parts.push(environment);
  }

  return parts.join(" · ");
}

export function formatAlertSummary(alerts?: AlertRow[] | null): string | null {
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
    const parsed = JSON.parse(raw) as Partial<AlertsPreferences> & {
      defaultKindFilter?: AlertKindFilter;
    };
    const viewMode =
      parsed.defaultViewMode === "unread" ||
      parsed.defaultViewMode === "resolved" ||
      parsed.defaultViewMode === "ignored" ||
      parsed.defaultViewMode === "all"
        ? parsed.defaultViewMode
        : DEFAULT_ALERTS_PREFERENCES.defaultViewMode;
    const allowedWindows = new Set(ALERT_TIME_WINDOW_OPTIONS.map((o) => o.value));
    const timeWindow =
      parsed.defaultTimeWindow && allowedWindows.has(parsed.defaultTimeWindow)
        ? parsed.defaultTimeWindow
        : DEFAULT_ALERTS_PREFERENCES.defaultTimeWindow;
    return {
      defaultViewMode: viewMode,
      defaultTimeWindow: timeWindow,
    };
  } catch {
    return DEFAULT_ALERTS_PREFERENCES;
  }
}

export function saveAlertsPreferences(preferences: AlertsPreferences): void {
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences));
}
