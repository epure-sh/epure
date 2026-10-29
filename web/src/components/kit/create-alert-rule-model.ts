/** Sentence a person builds in the create-alert wizard, and the JSON the API stores. */

export type TriggerType =
  | "issue_new"
  | "issue_regression"
  | "priority_escalated"
  | "any_event"
  | "project_count"
  | "issue_count"
  | "users_affected";

export type CountWindow = "1m" | "5m" | "15m" | "1h" | "24h";
export type UserWindow = "1h" | "24h" | "total";

export type AlertTrigger =
  | { type: "issue_new" }
  | { type: "issue_regression" }
  | { type: "priority_escalated" }
  | { type: "any_event" }
  | { type: "project_count"; threshold: number; window: CountWindow }
  | { type: "issue_count"; threshold: number; window: CountWindow }
  | { type: "users_affected"; threshold: number; window: UserWindow };

export type ConditionOp =
  | "is"
  | "is_not"
  | "at_least"
  | "equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "regex"
  | "not_contains"
  | "gt"
  | "is_one_of"
  | "exists"
  | "is_not_null";

export interface AlertCondition {
  field: string;
  op: ConditionOp;
  value: string;
}

export type ChannelProvider = "slack" | "discord" | "telegram" | "email" | "webhook";

export interface AlertChannelChoice {
  id: string;
  provider: ChannelProvider;
  label: string;
  enabled: boolean;
}

export interface AlertRuleDraft {
  templateId: string;
  name: string;
  triggers: AlertTrigger[];
  match: "all" | "any";
  conditions: AlertCondition[];
  cooldownMins: number;
  channelIds: string[];
  /** Payload checkboxes, including `tag:*` and `action:*` keys. */
  payload: Record<string, boolean>;
}

export const COOLDOWNS = [
  { mins: 5, label: "5 min" },
  { mins: 15, label: "15 min" },
  { mins: 30, label: "30 min" },
  { mins: 60, label: "1 hour" },
  { mins: 1440, label: "24 hours" },
] as const;

export const TRIGGER_GROUPS: { label: string; types: TriggerType[] }[] = [
  { label: "Issue lifecycle", types: ["issue_new", "issue_regression", "priority_escalated"] },
  { label: "Volume", types: ["any_event", "project_count", "issue_count"] },
  { label: "Impact", types: ["users_affected"] },
];

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  issue_new: "A new issue appears",
  issue_regression: "An issue regresses",
  priority_escalated: "Priority reaches high or critical",
  any_event: "Any error occurs",
  project_count: "Project error count exceeds",
  issue_count: "This issue repeats more than",
  users_affected: "Unique users affected exceeds",
};

export interface ConditionField {
  field: string;
  label: string;
  group: string;
  ops: ConditionOp[];
  values?: string[];
}

export const CONDITION_FIELDS: ConditionField[] = [
  { field: "priority", label: "priority", group: "Severity", ops: ["is", "at_least", "is_not"], values: ["critical", "high", "medium", "low"] },
  { field: "level", label: "level", group: "Severity", ops: ["is", "at_least", "is_not"], values: ["fatal", "error", "warning", "info"] },
  { field: "is_unhandled", label: "is unhandled", group: "Severity", ops: ["is"], values: ["true", "false"] },
  { field: "exception_type", label: "exception type", group: "Error", ops: ["equals", "contains", "starts_with", "not_contains", "regex"] },
  { field: "title", label: "title", group: "Error", ops: ["contains", "equals", "starts_with", "not_contains", "regex"] },
  { field: "culprit", label: "culprit", group: "Error", ops: ["contains", "equals", "starts_with"] },
  { field: "regressed_count", label: "times regressed", group: "Error", ops: ["gt", "is"] },
  { field: "environment", label: "environment", group: "Where", ops: ["is", "is_not", "is_one_of"], values: ["production", "staging", "development"] },
  { field: "release", label: "release", group: "Where", ops: ["equals", "starts_with", "contains"] },
  { field: "platform", label: "platform", group: "Where", ops: ["is", "is_not", "starts_with"] },
  { field: "transaction_name", label: "route", group: "Request", ops: ["contains", "equals", "starts_with"] },
  { field: "request.url", label: "request URL", group: "Request", ops: ["contains", "starts_with", "equals"] },
  { field: "request.method", label: "method", group: "Request", ops: ["is", "is_not"], values: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
  { field: "user.email", label: "user email", group: "User", ops: ["equals", "ends_with", "is_not_null"] },
  { field: "user_key", label: "user key", group: "User", ops: ["equals", "is_not_null"] },
  { field: "contexts.browser.name", label: "browser", group: "Runtime", ops: ["is", "contains"] },
  { field: "contexts.os.name", label: "operating system", group: "Runtime", ops: ["is", "contains"] },
  { field: "contexts.runtime.name", label: "runtime", group: "Runtime", ops: ["is", "contains"] },
  { field: "tags.plan", label: "tag plan", group: "Tags", ops: ["equals", "is_not", "exists"] },
  { field: "tags.tenant", label: "tag tenant", group: "Tags", ops: ["equals", "is_not", "exists"] },
];

export const OP_LABEL: Record<ConditionOp, string> = {
  is: "is",
  is_not: "is not",
  at_least: "is at least",
  equals: "equals",
  contains: "contains",
  starts_with: "starts with",
  ends_with: "ends with",
  regex: "matches",
  not_contains: "does not contain",
  gt: "greater than",
  is_one_of: "is one of",
  exists: "exists",
  is_not_null: "is set",
};

export interface PayloadItem {
  id: string;
  label: string;
  hint: string;
}

export interface PayloadGroup {
  id: string;
  label: string;
  items: PayloadItem[];
}

export const PAYLOAD_GROUPS: PayloadGroup[] = [
  {
    id: "breakage",
    label: "What broke",
    items: [
      { id: "stack_frames", label: "Top 3 in-app frames", hint: "stack" },
      { id: "culprit", label: "Culprit and route", hint: "location" },
    ],
  },
  {
    id: "impact",
    label: "How bad",
    items: [
      { id: "impact", label: "Priority, events, users", hint: "counts" },
      { id: "release", label: "Environment and release", hint: "deploy" },
    ],
  },
  {
    id: "trail",
    label: "People and the path",
    items: [
      { id: "affected_user", label: "Affected user", hint: "email or key" },
      { id: "breadcrumbs", label: "Last 3 breadcrumbs", hint: "trail" },
    ],
  },
  {
    id: "tags",
    label: "Tags",
    items: [
      { id: "tag:tenant", label: "tenant", hint: "tag" },
      { id: "tag:region", label: "region", hint: "tag" },
      { id: "tag:plan", label: "plan", hint: "tag" },
    ],
  },
  {
    id: "actions",
    label: "Buttons",
    items: [
      { id: "action:view", label: "View in Epure", hint: "link" },
      { id: "action:fix", label: "Copy AI fix prompt", hint: "prompt" },
      { id: "action:resolve", label: "Resolve", hint: "action" },
      { id: "action:mute", label: "Mute for 24 hours", hint: "action" },
    ],
  },
];

const DEFAULT_PAYLOAD: Record<string, boolean> = {
  stack_frames: true,
  culprit: true,
  impact: true,
  release: true,
  affected_user: false,
  breadcrumbs: false,
  "tag:tenant": false,
  "tag:region": false,
  "tag:plan": false,
  "action:view": true,
  "action:fix": true,
  "action:resolve": true,
  "action:mute": true,
};

export interface AlertTemplate {
  id: string;
  title: string;
  detail: string;
  recommended?: boolean;
  draft: AlertRuleDraft;
}

function draft(partial: Omit<AlertRuleDraft, "payload" | "channelIds"> & { payload?: Record<string, boolean> }): AlertRuleDraft {
  return {
    channelIds: [],
    payload: { ...DEFAULT_PAYLOAD, ...partial.payload },
    ...partial,
  };
}

export const ALERT_RULE_TEMPLATES: AlertTemplate[] = [
  {
    id: "production-crash",
    title: "Production crash",
    detail: "New unhandled error in production",
    recommended: true,
    draft: draft({
      templateId: "production-crash",
      name: "Production crash",
      triggers: [{ type: "issue_new" }, { type: "issue_regression" }],
      match: "all",
      conditions: [
        { field: "environment", op: "is", value: "production" },
        { field: "is_unhandled", op: "is", value: "true" },
      ],
      cooldownMins: 30,
    }),
  },
  {
    id: "regression-watchdog",
    title: "Regression watchdog",
    detail: "A fixed bug comes back in production",
    draft: draft({
      templateId: "regression-watchdog",
      name: "Regression watchdog",
      triggers: [{ type: "issue_regression" }],
      match: "all",
      conditions: [{ field: "environment", op: "is", value: "production" }],
      cooldownMins: 30,
    }),
  },
  {
    id: "error-spike",
    title: "Error spike",
    detail: "100 or more errors in 5 minutes",
    draft: draft({
      templateId: "error-spike",
      name: "Error spike",
      triggers: [{ type: "project_count", threshold: 100, window: "5m" }],
      match: "all",
      conditions: [{ field: "environment", op: "is", value: "production" }],
      cooldownMins: 15,
    }),
  },
  {
    id: "many-users",
    title: "Many users",
    detail: "25 or more people hit in an hour",
    draft: draft({
      templateId: "many-users",
      name: "Many users",
      triggers: [{ type: "users_affected", threshold: 25, window: "1h" }],
      match: "all",
      conditions: [{ field: "priority", op: "at_least", value: "high" }],
      cooldownMins: 30,
    }),
  },
  {
    id: "critical-routes",
    title: "Critical routes",
    detail: "Checkout traffic or an enterprise plan",
    draft: draft({
      templateId: "critical-routes",
      name: "Critical routes",
      triggers: [{ type: "any_event" }],
      match: "any",
      conditions: [
        { field: "transaction_name", op: "contains", value: "/checkout" },
        { field: "tags.plan", op: "equals", value: "enterprise" },
      ],
      cooldownMins: 15,
    }),
  },
];

export const SCRATCH_TEMPLATE_ID = "scratch";

export function scratchDraft(): AlertRuleDraft {
  return draft({
    templateId: SCRATCH_TEMPLATE_ID,
    name: "",
    triggers: [{ type: "issue_new" }],
    match: "all",
    conditions: [],
    cooldownMins: 30,
  });
}

export function templateDraft(id: string): AlertRuleDraft {
  if (id === SCRATCH_TEMPLATE_ID) return scratchDraft();
  const found = ALERT_RULE_TEMPLATES.find((item) => item.id === id);
  return found ? structuredClone(found.draft) : scratchDraft();
}

export function defaultTrigger(type: TriggerType): AlertTrigger {
  switch (type) {
    case "project_count":
      return { type, threshold: 100, window: "5m" };
    case "issue_count":
      return { type, threshold: 50, window: "15m" };
    case "users_affected":
      return { type, threshold: 25, window: "1h" };
    default:
      return { type } as AlertTrigger;
  }
}

export function defaultCondition(field = "environment"): AlertCondition {
  const spec = CONDITION_FIELDS.find((item) => item.field === field) ?? CONDITION_FIELDS[0];
  return { field: spec.field, op: spec.ops[0], value: spec.values?.[0] ?? "" };
}

export function describeTrigger(trigger: AlertTrigger): string {
  switch (trigger.type) {
    case "project_count":
      return `${trigger.threshold}+ project errors in ${trigger.window}`;
    case "issue_count":
      return `${trigger.threshold}+ events on one issue in ${trigger.window}`;
    case "users_affected":
      return `${trigger.threshold}+ users in ${trigger.window === "total" ? "total" : trigger.window}`;
    default:
      return TRIGGER_LABEL[trigger.type];
  }
}

export function describeRule(rule: AlertRuleDraft): string {
  const when = rule.triggers.length > 0 ? rule.triggers.map(describeTrigger).join(" or ") : "something happens";
  const conds = rule.conditions
    .filter((item) => item.value || item.op === "exists" || item.op === "is_not_null")
    .map((item) => `${fieldLabel(item.field)} ${OP_LABEL[item.op]} ${item.value}`.trim());
  const ifs = conds.length > 0 ? `, if ${rule.match === "all" ? "all" : "any"} of: ${conds.join("; ")}` : "";
  const wait = COOLDOWNS.find((item) => item.mins === rule.cooldownMins)?.label ?? `${rule.cooldownMins} min`;
  return `When ${when}${ifs}. At most once per ${wait} for the same issue.`;
}

export function fieldLabel(field: string): string {
  return CONDITION_FIELDS.find((item) => item.field === field)?.label ?? field;
}

export function derivedKind(rule: AlertRuleDraft): "issue_created" | "regression" | "velocity_spike" {
  const types = new Set(rule.triggers.map((item) => item.type));
  if (types.has("project_count") || types.has("issue_count")) return "velocity_spike";
  if (types.has("issue_regression") && types.size === 1) return "regression";
  return "issue_created";
}

export function environmentFromConditions(rule: AlertRuleDraft): string | null {
  const hit = rule.conditions.find((item) => item.field === "environment" && item.op === "is" && item.value);
  return hit?.value ?? null;
}

export function ruleToApiBody(rule: AlertRuleDraft, projectId: string) {
  return {
    project_id: projectId,
    name: rule.name.trim(),
    kind: derivedKind(rule),
    environment: environmentFromConditions(rule),
    threshold: thresholdFromTriggers(rule),
    enabled: true,
    triggers: rule.triggers,
    condition_match: rule.match,
    conditions: rule.conditions,
    payload_options: rule.payload,
    channel_ids: rule.channelIds,
    cooldown_mins: rule.cooldownMins,
    filters_json: {
      cooldown_minutes: rule.cooldownMins,
      template_id: rule.templateId,
    },
  };
}

function thresholdFromTriggers(rule: AlertRuleDraft): number | null {
  const counted = rule.triggers.find(
    (item) => item.type === "project_count" || item.type === "issue_count" || item.type === "users_affected",
  );
  return counted && "threshold" in counted ? counted.threshold : null;
}

export function canAdvance(step: 1 | 2 | 3, rule: AlertRuleDraft): boolean {
  if (step === 1) return rule.templateId.length > 0;
  if (step === 2) return rule.name.trim().length > 0 && rule.triggers.length > 0;
  return rule.name.trim().length > 0 && rule.triggers.length > 0;
}
