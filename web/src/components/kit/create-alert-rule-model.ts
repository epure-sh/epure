/** Sentence a person builds in the create-alert wizard, and the JSON the API stores. */

export type TriggerType = "issue_new" | "issue_count" | "users_affected";

export type CompareOp = "gt" | "lt" | "eq";
export type CountWindow = "1m" | "5m" | "15m" | "1h" | "24h";
export type UserWindow = "1h" | "24h" | "total";

export type AlertTrigger =
  | { type: "issue_new" }
  | { type: "issue_count"; op: CompareOp; threshold: number; window: CountWindow }
  | { type: "users_affected"; op: CompareOp; threshold: number; window: UserWindow };

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
  /** How many times this issue may alert inside the window. */
  cooldownCount: number;
  cooldownMins: number;
  channelIds: string[];
  /** Optional sidebar blocks. General alert context is always included. */
  payload: Record<string, boolean>;
}

export const COOLDOWN_COUNTS = [1, 2, 3, 5, 10] as const;

export const COOLDOWNS = [
  { mins: 5, label: "5 min" },
  { mins: 15, label: "15 min" },
  { mins: 30, label: "30 min" },
  { mins: 60, label: "1 hour" },
  { mins: 1440, label: "24 hours" },
] as const;

/** The only WHEN phrases. Came back, priority, and environment are conditions. */
export const TRIGGER_TYPES: TriggerType[] = ["issue_new", "issue_count", "users_affected"];

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  issue_new: "A new issue arrives",
  issue_count: "Total issue count",
  users_affected: "Users affected",
};

export const COMPARE_OPS: CompareOp[] = ["gt", "lt", "eq"];

export const COMPARE_LABEL: Record<CompareOp, string> = {
  gt: ">",
  lt: "<",
  eq: "=",
};

export const COUNT_WINDOWS: { id: CountWindow; label: string }[] = [
  { id: "1m", label: "1 min" },
  { id: "5m", label: "5 min" },
  { id: "15m", label: "15 min" },
  { id: "1h", label: "1 hour" },
  { id: "24h", label: "24 hours" },
];

export const USER_WINDOWS: { id: UserWindow; label: string }[] = [
  { id: "1h", label: "1 hour" },
  { id: "24h", label: "24 hours" },
  { id: "total", label: "all time" },
];

export interface ConditionField {
  field: string;
  label: string;
  group: string;
  ops: ConditionOp[];
  values?: string[];
}

export const BASE_FIELDS = ["environment", "level", "is_unhandled", "came_back", "priority"] as const;

export const CONDITION_FIELDS: ConditionField[] = [
  { field: "environment", label: "Environment", group: "Base", ops: ["is", "is_not"], values: ["production", "staging", "development"] },
  { field: "level", label: "Level", group: "Base", ops: ["is", "at_least"], values: ["fatal", "error", "warning", "info"] },
  { field: "is_unhandled", label: "Unhandled", group: "Base", ops: ["is"], values: ["true", "false"] },
  { field: "came_back", label: "Came back", group: "Base", ops: ["is"], values: ["yes", "no"] },
  { field: "priority", label: "Priority", group: "Base", ops: ["is", "at_least"], values: ["critical", "high", "medium", "low"] },
  { field: "transaction_name", label: "Route", group: "Advanced", ops: ["contains", "equals", "starts_with"] },
  { field: "exception_type", label: "Error", group: "Advanced", ops: ["equals", "contains", "starts_with"] },
  { field: "title", label: "Title", group: "Advanced", ops: ["contains", "equals"] },
  { field: "culprit", label: "Culprit", group: "Advanced", ops: ["contains", "equals"] },
  { field: "release", label: "Release", group: "Advanced", ops: ["equals", "starts_with"] },
  { field: "platform", label: "Platform", group: "Advanced", ops: ["is", "starts_with"] },
  { field: "user.email", label: "Email", group: "Advanced", ops: ["equals", "ends_with", "is_not_null"] },
  { field: "tags.plan", label: "Plan", group: "Advanced", ops: ["equals", "exists"] },
  { field: "tags.tenant", label: "Tenant", group: "Advanced", ops: ["equals", "exists"] },
];

export const OP_LABEL: Record<ConditionOp, string> = {
  is: "is",
  is_not: "is not",
  at_least: "is at least",
  equals: "is",
  contains: "contains",
  starts_with: "starts with",
  ends_with: "ends with",
  regex: "matches",
  not_contains: "does not contain",
  gt: "is greater than",
  is_one_of: "is one of",
  exists: "exists",
  is_not_null: "is set",
};

export interface PayloadChoice {
  id: string;
  label: string;
  /** Mutually exclusive choices share a group. One stays selected. */
  group?: string;
  groupLabel?: string;
  /** Selected when the block is turned on. */
  default?: boolean;
}

/** Optional blocks printed on the alert, under the context that is always included. */
export interface PayloadBlock {
  id: string;
  label: string;
  /** What this block prints on the alert detail. */
  detail: string;
  advanced?: boolean;
  children?: PayloadChoice[];
}

export const ALWAYS_ON_ALERT = [
  "When it fired",
  "Why it fired",
  "Conditions that matched",
  "Issue and error type",
  "Events, users, priority",
  "Environment and release",
  "Status",
] as const;

export const PAYLOAD_BLOCKS: PayloadBlock[] = [
  {
    id: "stack_frames",
    label: "Stack",
    detail: "Which frames to print.",
    children: [
      { id: "stack:in_app", label: "In-app frames only" },
      { id: "stack:line", label: "Crashing line" },
      { id: "stack:frames:1", label: "Top 1", group: "frames", groupLabel: "Frames" },
      { id: "stack:frames:3", label: "Top 3", group: "frames", default: true },
      { id: "stack:frames:5", label: "Top 5", group: "frames" },
    ],
  },
  {
    id: "culprit",
    label: "Crash site",
    detail: "File, function, or route.",
    children: [
      { id: "culprit:file", label: "File and function" },
      { id: "culprit:route", label: "Route" },
    ],
  },
  {
    id: "request",
    label: "Request",
    detail: "Method, URL, or both.",
    advanced: true,
    children: [
      { id: "request:method", label: "Method" },
      { id: "request:url", label: "URL" },
    ],
  },
  {
    id: "affected_user",
    label: "Person",
    detail: "Email, user key, or both.",
    advanced: true,
    children: [
      { id: "person:email", label: "Email" },
      { id: "person:key", label: "User key" },
    ],
  },
  {
    id: "breadcrumbs",
    label: "Breadcrumbs",
    detail: "Last 3 steps before the error.",
    advanced: true,
  },
  {
    id: "runtime",
    label: "Runtime",
    detail: "Browser, OS, or runtime.",
    advanced: true,
    children: [
      { id: "runtime:browser", label: "Browser" },
      { id: "runtime:os", label: "OS" },
      { id: "runtime:name", label: "Runtime" },
    ],
  },
  {
    id: "tags",
    label: "Tags",
    detail: "Only the tags you tick.",
    advanced: true,
    children: [
      { id: "tag:tenant", label: "Tenant" },
      { id: "tag:region", label: "Region" },
      { id: "tag:plan", label: "Plan" },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    detail: "Buttons on the alert.",
    children: [
      { id: "action:view", label: "Open issue" },
      { id: "action:fix", label: "Copy fix prompt" },
      { id: "action:resolve", label: "Resolve" },
      { id: "action:mute", label: "Mute 24h" },
    ],
  },
];

const DEFAULT_PAYLOAD: Record<string, boolean> = {
  stack_frames: true,
  "stack:in_app": true,
  "stack:line": true,
  "stack:frames:1": false,
  "stack:frames:3": true,
  "stack:frames:5": false,
  culprit: true,
  "culprit:file": true,
  "culprit:route": true,
  request: true,
  "request:method": true,
  "request:url": true,
  affected_user: true,
  "person:email": true,
  "person:key": true,
  breadcrumbs: true,
  runtime: true,
  "runtime:browser": true,
  "runtime:os": true,
  "runtime:name": true,
  tags: true,
  "tag:tenant": true,
  "tag:region": true,
  "tag:plan": true,
  actions: true,
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

function draft(
  partial: Omit<AlertRuleDraft, "payload" | "channelIds" | "cooldownCount"> & {
    payload?: Record<string, boolean>;
    cooldownCount?: number;
  },
): AlertRuleDraft {
  return {
    channelIds: [],
    cooldownCount: partial.cooldownCount ?? 1,
    payload: { ...DEFAULT_PAYLOAD, ...partial.payload },
    ...partial,
  };
}

export const ALERT_RULE_TEMPLATES: AlertTemplate[] = [
  {
    id: "production-crash",
    title: "Prod crash",
    detail: "Unhandled, in production",
    recommended: true,
    draft: draft({
      templateId: "production-crash",
      name: "Production crash",
      triggers: [{ type: "issue_new" }],
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
    title: "Came back",
    detail: "Resolved issue returns",
    draft: draft({
      templateId: "regression-watchdog",
      name: "Regression watchdog",
      triggers: [{ type: "issue_new" }],
      match: "all",
      conditions: [
        { field: "came_back", op: "is", value: "yes" },
        { field: "environment", op: "is", value: "production" },
      ],
      cooldownMins: 30,
    }),
  },
  {
    id: "error-spike",
    title: "Spike",
      detail: "More than 100 in 5 min",
    draft: draft({
      templateId: "error-spike",
      name: "Error spike",
      triggers: [{ type: "issue_count", op: "gt", threshold: 100, window: "5m" }],
      match: "all",
      conditions: [{ field: "environment", op: "is", value: "production" }],
      cooldownMins: 15,
    }),
  },
  {
    id: "many-users",
    title: "Many users",
      detail: "More than 25 in 1 hour",
    draft: draft({
      templateId: "many-users",
      name: "Many users",
      triggers: [{ type: "users_affected", op: "gt", threshold: 25, window: "1h" }],
      match: "all",
      conditions: [{ field: "priority", op: "at_least", value: "high" }],
      cooldownMins: 30,
    }),
  },
  {
    id: "critical-routes",
    title: "Checkout",
    detail: "/checkout or enterprise",
    draft: draft({
      templateId: "critical-routes",
      name: "Critical routes",
      triggers: [{ type: "issue_new" }],
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

export function draftFromRule(rule: {
  name: string;
  kind?: string;
  environment?: string | null;
  threshold?: number | null;
  filters_json?: { template_id?: unknown; cooldown_count?: unknown; cooldown_minutes?: unknown };
  triggers?: unknown;
  condition_match?: string | null;
  conditions?: unknown;
  payload_options?: unknown;
  channel_ids?: string[] | null;
  cooldown_mins?: number | null;
}): AlertRuleDraft {
  const triggers = parseTriggers(rule.triggers);
  const conditions = parseConditions(rule.conditions);
  if (
    legacyCameBack(rule.triggers) &&
    !conditions.some((item) => item.field === "came_back")
  ) {
    conditions.unshift({ field: "came_back", op: "is", value: "yes" });
  }
  const base = templateDraft(
    typeof rule.filters_json?.template_id === "string" ? rule.filters_json.template_id : SCRATCH_TEMPLATE_ID,
  );
  const fallbackTrigger = fallbackTriggerForKind(rule.kind, rule.threshold);
  const fallbackConditions =
    rule.environment && conditions.length === 0
      ? [{ field: "environment", op: "is" as const, value: rule.environment }]
      : [];
  const count = Number(rule.filters_json?.cooldown_count);
  const minutes = rule.cooldown_mins ?? Number(rule.filters_json?.cooldown_minutes);
  return {
    ...base,
    templateId: typeof rule.filters_json?.template_id === "string" ? rule.filters_json.template_id : base.templateId,
    name: rule.name,
    triggers: triggers.length > 0 ? triggers : fallbackTrigger,
    match: rule.condition_match === "any" ? "any" : "all",
    conditions: conditions.length > 0 ? conditions : fallbackConditions,
    cooldownCount: Number.isFinite(count) && count > 0 ? count : 1,
    cooldownMins: Number.isFinite(minutes) && minutes > 0 ? minutes : base.cooldownMins,
    channelIds: rule.channel_ids ?? [],
    payload: {
      ...DEFAULT_PAYLOAD,
      ...(isRecord(rule.payload_options) ? boolRecord(rule.payload_options) : {}),
    },
  };
}

function parseTriggers(value: unknown): AlertTrigger[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const trigger = normalizeTrigger(item);
    return trigger ? [trigger] : [];
  });
}

function legacyCameBack(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => isRecord(item) && item.type === "issue_regression");
}

function normalizeTrigger(item: unknown): AlertTrigger | null {
  if (!isRecord(item) || typeof item.type !== "string") return null;
  const op: CompareOp = item.op === "lt" || item.op === "eq" || item.op === "gt" ? item.op : "gt";
  const threshold = typeof item.threshold === "number" && item.threshold >= 0 ? item.threshold : 1;
  if (item.type === "issue_new" || item.type === "any_event") return { type: "issue_new" };
  if (item.type === "issue_regression") return null;
  if (item.type === "issue_count" || item.type === "project_count") {
    return {
      type: "issue_count",
      op,
      threshold: item.type === "project_count" && threshold <= 0 ? 100 : threshold,
      window: countWindow(item.window),
    };
  }
  if (item.type === "users_affected") {
    return { type: "users_affected", op, threshold, window: userWindow(item.window) };
  }
  return null;
}

function countWindow(value: unknown): CountWindow {
  return COUNT_WINDOWS.some((item) => item.id === value) ? (value as CountWindow) : "5m";
}

function userWindow(value: unknown): UserWindow {
  return USER_WINDOWS.some((item) => item.id === value) ? (value as UserWindow) : "1h";
}

function parseConditions(value: unknown): AlertCondition[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.field !== "string" || typeof item.op !== "string") return [];
    return [{ field: item.field, op: item.op as AlertCondition["op"], value: String(item.value ?? "") }];
  });
}

function fallbackTriggerForKind(kind: string | undefined, threshold: number | null | undefined): AlertTrigger[] {
  if (kind === "velocity_spike") {
    return [{ type: "issue_count", op: "gt", threshold: threshold && threshold > 0 ? threshold : 100, window: "5m" }];
  }
  return [{ type: "issue_new" }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boolRecord(value: Record<string, unknown>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "boolean") out[key] = item;
  }
  return out;
}

export function templateDraft(id: string): AlertRuleDraft {
  if (id === SCRATCH_TEMPLATE_ID) return scratchDraft();
  const found = ALERT_RULE_TEMPLATES.find((item) => item.id === id);
  return found ? structuredClone(found.draft) : scratchDraft();
}

export function defaultTrigger(type: TriggerType): AlertTrigger {
  switch (type) {
    case "issue_count":
      return { type, op: "gt", threshold: 100, window: "5m" };
    case "users_affected":
      return { type, op: "gt", threshold: 25, window: "1h" };
    case "issue_new":
      return { type: "issue_new" };
  }
}

export function defaultCondition(field = "environment"): AlertCondition {
  const spec = CONDITION_FIELDS.find((item) => item.field === field) ?? CONDITION_FIELDS[0];
  return { field: spec.field, op: spec.ops[0], value: spec.values?.[0] ?? "" };
}

export function describeTrigger(trigger: AlertTrigger): string {
  switch (trigger.type) {
    case "issue_count":
      return `Total issue count ${COMPARE_LABEL[trigger.op]} ${trigger.threshold} in ${windowLabel(trigger.window)}`;
    case "users_affected":
      return `Users affected ${COMPARE_LABEL[trigger.op]} ${trigger.threshold} in ${windowLabel(trigger.window)}`;
    case "issue_new":
      return TRIGGER_LABEL.issue_new;
  }
}

function windowLabel(window: CountWindow | UserWindow): string {
  return (
    COUNT_WINDOWS.find((item) => item.id === window)?.label ??
    USER_WINDOWS.find((item) => item.id === window)?.label ??
    window
  );
}

export function needsAdvanced(rule: AlertRuleDraft): boolean {
  return rule.conditions.some((item) => !BASE_FIELDS.includes(item.field as (typeof BASE_FIELDS)[number]));
}

export function describeRule(rule: AlertRuleDraft): string {
  const when = rule.triggers.map(describeTrigger).join(" or ") || "No trigger";
  const conds = rule.conditions
    .filter((item) => item.value || item.op === "exists" || item.op === "is_not_null")
    .map((item) => `${fieldLabel(item.field)} ${OP_LABEL[item.op]} ${item.value}`.trim());
  const ifs = conds.length > 0 ? ` · ${conds.join(rule.match === "all" ? " · " : " or ")}` : "";
  const wait = COOLDOWNS.find((item) => item.mins === rule.cooldownMins)?.label ?? `${rule.cooldownMins} min`;
  const times = rule.cooldownCount === 1 ? "1 time" : `${rule.cooldownCount} times`;
  return `${when}${ifs} · max ${times} / ${wait}`;
}

export function fieldLabel(field: string): string {
  return CONDITION_FIELDS.find((item) => item.field === field)?.label ?? field;
}

export function derivedKind(rule: AlertRuleDraft): "issue_created" | "regression" | "velocity_spike" {
  const volume = rule.triggers.some((item) => item.type === "issue_count" || item.type === "users_affected");
  if (volume) return "velocity_spike";
  const cameBack = rule.conditions.some(
    (item) => item.field === "came_back" && item.op === "is" && (item.value === "yes" || item.value === "true"),
  );
  if (cameBack) return "regression";
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
      cooldown_count: rule.cooldownCount,
      template_id: rule.templateId,
    },
  };
}

function thresholdFromTriggers(rule: AlertRuleDraft): number | null {
  const counted = rule.triggers.find((item) => item.type === "issue_count" || item.type === "users_affected");
  return counted && "threshold" in counted ? counted.threshold : null;
}

export function canAdvance(step: 1 | 2 | 3, rule: AlertRuleDraft): boolean {
  if (step === 1) return rule.templateId.length > 0;
  if (step === 2) return rule.name.trim().length > 0 && rule.triggers.length > 0;
  return rule.name.trim().length > 0 && rule.triggers.length > 0;
}
