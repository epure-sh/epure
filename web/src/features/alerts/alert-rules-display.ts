import type { AlertRuleRow } from "@/lib/api";

export type RuleDestinationKind = "all" | "slack" | "email" | "discord" | "webhook";

export interface RuleDestinationPreview {
  kind: RuleDestinationKind;
  label: string;
  extra?: string;
  failing?: boolean;
}

export function ruleConditionLine(rule: AlertRuleRow): string {
  const env = rule.environment ? rule.environment : "all envs";
  const level = rule.filters_json?.min_level;
  const firstSeen = rule.filters_json?.first_seen;

  if (rule.kind === "velocity_spike") {
    const pct = rule.threshold ?? 300;
    const levelLabel =
      level === "fatal" ? "fatal+" : level === "error" ? "error+" : "any level";
    return `≥${pct}% vs prior 15m · ${env} · ${levelLabel}`;
  }
  if (rule.kind === "users_affected") {
    const count = rule.threshold ?? 50;
    return `≥${count} unique users · ${env}`;
  }
  if (rule.kind === "event_milestone") {
    const count = rule.threshold ?? 1000;
    return `≥${count.toLocaleString()} events · ${env}`;
  }
  if (rule.kind === "regression") {
    return `Resolved issue returns · ${env}`;
  }
  if (rule.kind === "custom") {
    const query = rule.filters_json?.query ? ` "${rule.filters_json.query}"` : "";
    return `Custom rule${query} · ${env}`;
  }
  if (firstSeen === "new") {
    const levelLabel = level === "fatal" ? "fatal" : level === "error" ? "error+" : "any level";
    return `First fingerprint · ${env} · ${levelLabel}`;
  }
  return `New issue · ${env}`;
}

export function ruleScopeProject(rule: AlertRuleRow, projectSlug = "checkout-web"): string {
  if (rule.name.toLowerCase().includes("api")) {
    return "api";
  }
  return projectSlug;
}

export function ruleScopeEnvironment(rule: AlertRuleRow): string {
  if (!rule.environment) {
    return "ALL";
  }
  return rule.environment.toUpperCase();
}

const DEMO_FIRED_COUNT: Record<string, number> = {
  "rul-tmpl-prod-spike": 18,
  "rul-tmpl-prod-new": 42,
  "rul-tmpl-prod-regression": 6,
  "rul-tmpl-prod-fatal": 3,
  "rul-tmpl-staging-new": 11,
  "rul-tmpl-any-regression": 4,
  "rul-tmpl-api-prod-spike": 9,
  "rul-tmpl-api-prod-new": 15,
  "rul-tmpl-api-prod-regression": 2,
};

/** How many times this rule has fired. Real counts win; playground templates have a demo number. */
export function ruleFiredCount(ruleId: string, counts: Record<string, number>): number {
  const real = counts[ruleId];
  if (typeof real === "number" && real > 0) return real;
  return DEMO_FIRED_COUNT[ruleId] ?? real ?? 0;
}

/** Short reason shown as a badge on the rules row. */
export function ruleWhyLabel(rule: AlertRuleRow): string {
  if (!rule.enabled) return "Paused";
  const trigger = firstTrigger(rule);
  const cameBack = (rule.conditions ?? []).some(
    (item) =>
      isRecord(item) &&
      item.field === "came_back" &&
      (item.value === "yes" || item.value === "true"),
  );
  if (trigger?.type === "issue_new") return cameBack ? "Came back" : "New issue";
  if (trigger?.type === "issue_count" || trigger?.type === "users_affected") {
    const op = trigger.op === "lt" ? "<" : trigger.op === "eq" ? "=" : ">";
    const noun = trigger.type === "users_affected" ? "users" : "events";
    const window = windowLabel(trigger.window);
    return window ? `${op} ${trigger.threshold} ${noun} · ${window}` : `${op} ${trigger.threshold} ${noun}`;
  }
  if (rule.kind === "velocity_spike") return "Spike";
  if (rule.kind === "regression") return "Came back";
  if (rule.kind === "users_affected") return "Users";
  if (rule.kind === "event_milestone") return "Milestone";
  if (rule.filters_json?.min_level === "fatal") return "Fatal";
  if (rule.filters_json?.first_seen === "new") return "New issue";
  return "New issue";
}

function firstTrigger(rule: AlertRuleRow): { type?: string; op?: string; threshold?: number; window?: string } | null {
  const trigger = rule.triggers?.[0];
  if (!isRecord(trigger) || typeof trigger.type !== "string") return null;
  return {
    type: trigger.type,
    op: typeof trigger.op === "string" ? trigger.op : undefined,
    threshold: typeof trigger.threshold === "number" ? trigger.threshold : undefined,
    window: typeof trigger.window === "string" ? trigger.window : undefined,
  };
}

function windowLabel(window: string | undefined): string {
  if (!window) return "";
  const labels: Record<string, string> = {
    "1m": "1 min",
    "5m": "5 min",
    "15m": "15 min",
    "1h": "1 hour",
    "24h": "24 hours",
    total: "all time",
  };
  return labels[window] ?? window;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ruleTitleBadge(
  rule: AlertRuleRow,
): { label: string; variant: "neutral" | "info" | "escalating" | "regression" } | null {
  if (!rule.enabled) {
    return { label: "inactive", variant: "neutral" };
  }
  if (rule.kind === "velocity_spike" && rule.threshold) {
    return { label: `≥${rule.threshold}%`, variant: "info" };
  }
  if (rule.kind === "users_affected" && rule.threshold) {
    return { label: `≥${rule.threshold} users`, variant: "escalating" };
  }
  if (rule.kind === "event_milestone" && rule.threshold) {
    return { label: `≥${rule.threshold >= 1000 ? `${rule.threshold / 1000}k` : rule.threshold} ev`, variant: "info" };
  }
  if (rule.kind === "custom") {
    return { label: "custom", variant: "info" };
  }
  if (rule.filters_json?.min_level === "fatal") {
    return { label: "fatal", variant: "escalating" };
  }
  if (rule.kind === "regression") {
    return { label: "regression", variant: "regression" };
  }
  if (rule.filters_json?.first_seen === "new") {
    return { label: "new", variant: "info" };
  }
  return null;
}

/** Playground-friendly destination chips aligned with starter template ids. */
export function ruleDestinationPreview(rule: AlertRuleRow, index: number): RuleDestinationPreview {
  const byId: Record<string, RuleDestinationPreview> = {
    "rul-tmpl-prod-spike": { kind: "slack", label: "#production" },
    "rul-tmpl-prod-new": { kind: "slack", label: "#errors" },
    "rul-tmpl-prod-regression": { kind: "email", label: "On-call rotation" },
    "rul-tmpl-prod-fatal": { kind: "email", label: "Pager · 2 recipients" },
    "rul-tmpl-staging-new": { kind: "discord", label: "#staging" },
    "rul-tmpl-any-regression": { kind: "webhook", label: "Release automation" },
    "rul-tmpl-api-prod-spike": { kind: "slack", label: "#api-alerts" },
    "rul-tmpl-api-prod-new": { kind: "slack", label: "#api-alerts" },
    "rul-tmpl-api-prod-regression": { kind: "email", label: "API on-call" },
  };
  if (byId[rule.id]) {
    return byId[rule.id];
  }
  const fallbacks: RuleDestinationPreview[] = [
    { kind: "slack", label: "#production" },
    { kind: "email", label: "2 recipients", extra: "+1" },
    { kind: "discord", label: "#errors" },
    { kind: "webhook", label: "Project webhooks" },
  ];
  return fallbacks[index % fallbacks.length] ?? { kind: "email", label: "Email + webhooks" };
}

/** Playground demo timestamps when alert history is not keyed by rule id. */
export function ruleLastTriggeredDemo(ruleId: string): string | null {
  const byId: Record<string, string> = {
    "rul-tmpl-prod-spike": isoHoursAgo(2),
    "rul-tmpl-prod-new": isoHoursAgo(5),
    "rul-tmpl-prod-regression": isoDaysAgo(3),
    "rul-tmpl-prod-fatal": isoDaysAgo(8),
    "rul-tmpl-staging-new": isoDaysAgo(14),
    "rul-tmpl-any-regression": isoDaysAgo(1),
    "rul-tmpl-api-prod-spike": isoHoursAgo(4),
    "rul-tmpl-api-prod-new": isoHoursAgo(12),
    "rul-tmpl-api-prod-regression": isoDaysAgo(5),
  };
  return byId[ruleId] ?? null;
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function matchesDestinationFilter(
  preview: RuleDestinationPreview,
  filter: RuleDestinationKind,
): boolean {
  if (filter === "all") {
    return true;
  }
  return preview.kind === filter;
}
