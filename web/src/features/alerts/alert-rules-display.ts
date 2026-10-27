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
  if (rule.kind === "regression") {
    return `Resolved issue returns · ${env}`;
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

export function ruleTitleBadge(
  rule: AlertRuleRow,
): { label: string; variant: "neutral" | "info" | "escalating" | "regression" } | null {
  if (!rule.enabled) {
    return { label: "inactive", variant: "neutral" };
  }
  if (rule.kind === "velocity_spike" && rule.threshold) {
    return { label: `≥${rule.threshold}%`, variant: "info" };
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
