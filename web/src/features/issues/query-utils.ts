export type QueryLifecycle = "unresolved" | "resolved" | "ignored";
export type QueryViewModifier = "regression" | "snoozed";

export interface ParsedQuery {
  /** Primary scope: All when omitted. */
  lifecycle?: QueryLifecycle;
  /** Secondary view filter (Came back / Snoozed); mutually exclusive with each other. */
  viewModifier?: QueryViewModifier;
  /** Alerts-only: filter history to notifications for one issue. */
  issueId?: string;
  /** Volume spike / 3d trend (client-refined; stripped for API list fetch). */
  escalating?: boolean;
  /** Derived priority bucket (client-refined; stripped for API list fetch). */
  priority?: string;
  environment?: string;
  release?: string;
  userEmail?: string;
  level?: string;
  freeText?: string;
}

/** Primary lifecycle chips (All / Unresolved / Resolved). */
export const PRIMARY_LIFECYCLE_IS_TOKENS = [
  "is:unresolved",
  "is:resolved",
  "is:ignored",
] as const;

/** Secondary modifiers (Came back / Snoozed) — independent of primary lifecycle. */
export const VIEW_MODIFIER_IS_TOKENS = ["is:regression", "is:snoozed"] as const;

export const ADDITIVE_IS_TOKENS = ["is:escalating"] as const;

/** @deprecated Use PRIMARY_LIFECYCLE_IS_TOKENS + VIEW_MODIFIER_IS_TOKENS */
export const LIFECYCLE_IS_TOKENS = [
  ...PRIMARY_LIFECYCLE_IS_TOKENS,
  ...VIEW_MODIFIER_IS_TOKENS,
] as const;

import {
  DEFAULT_TIME_WINDOW,
  TIME_WINDOW_OPTIONS,
  getTimeWindowLabel,
  getTimeWindowShortLabel,
  parseTimeWindow,
  type TimeWindowValue,
} from "@/lib/time-window";

export type { TimeWindowValue };
export { DEFAULT_TIME_WINDOW, TIME_WINDOW_OPTIONS, getTimeWindowLabel, getTimeWindowShortLabel, parseTimeWindow };

export type IssueSortValue =
  | "last_seen_desc"
  | "last_seen_asc"
  | "events_desc"
  | "events_asc"
  | "first_seen_desc"
  | "first_seen_asc"
  | "title_asc"
  | "priority_desc";

export const DEFAULT_ISSUE_SORT: IssueSortValue = "last_seen_desc";

export const ISSUE_SORT_OPTIONS: ReadonlyArray<{
  value: IssueSortValue;
  label: string;
}> = [
  { value: "priority_desc", label: "Most critical" },
  { value: "last_seen_desc", label: "Last seen (newest first)" },
  { value: "last_seen_asc", label: "Last seen (oldest first)" },
  { value: "events_desc", label: "Most events" },
  { value: "events_asc", label: "Fewest events" },
  { value: "first_seen_desc", label: "First seen (newest first)" },
  { value: "first_seen_asc", label: "First seen (oldest first)" },
  { value: "title_asc", label: "Title A–Z" },
];

const ISSUE_SORT_SET = new Set<string>(ISSUE_SORT_OPTIONS.map((option) => option.value));

export function parseIssueSort(raw: string | null | undefined): IssueSortValue {
  if (raw && ISSUE_SORT_SET.has(raw)) {
    return raw as IssueSortValue;
  }
  return DEFAULT_ISSUE_SORT;
}

export function getIssueSortLabel(value: IssueSortValue): string {
  return (
    ISSUE_SORT_OPTIONS.find((option) => option.value === value)?.label ??
    "Last seen (newest first)"
  );
}

/** Compact feed toolbar label (matches inbox column headers). */
export function getIssueSortShortLabel(value: IssueSortValue): string {
  switch (value) {
    case "last_seen_desc":
    case "last_seen_asc":
      return "Last seen";
    case "events_desc":
    case "events_asc":
      return "Events";
    case "first_seen_desc":
    case "first_seen_asc":
      return "Age";
    case "title_asc":
      return "Title";
    case "priority_desc":
      return "Priority";
    default:
      return "Last seen";
  }
}

export function getEventsStatLabel(value: TimeWindowValue): string {
  switch (value) {
    case "24h":
      return "Events (24h)";
    case "14d":
      return "Events (14d)";
    case "30d":
      return "Events (30d)";
    case "90d":
      return "Events (90d)";
    default:
      return "Events (7d)";
  }
}

function normalizeStatus(value: string): string {
  if (value === "open") {
    return "unresolved";
  }
  return value;
}

export function parseQuery(raw: string): ParsedQuery {
  const parsed: ParsedQuery = {};
  const freeText: string[] = [];

  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("is:")) {
      const value = token.slice(3);
      if (value === "escalating") {
        parsed.escalating = true;
      } else if (value === "regression") {
        parsed.viewModifier = "regression";
      } else if (value === "snoozed") {
        parsed.viewModifier = "snoozed";
      } else {
        parsed.lifecycle = normalizeStatus(value) as QueryLifecycle;
      }
    } else if (token.startsWith("priority:")) {
      parsed.priority = token.slice(9);
    } else if (token.startsWith("env:")) {
      parsed.environment = token.slice(4);
    } else if (token.startsWith("release:")) {
      parsed.release = token.slice(8);
    } else if (token.startsWith("user.email:")) {
      parsed.userEmail = token.slice(11);
    } else if (token.startsWith("level:")) {
      parsed.level = token.slice(6);
    } else if (token.startsWith("issue:")) {
      parsed.issueId = token.slice(6);
    } else {
      freeText.push(token);
    }
  }

  if (freeText.length > 0) {
    parsed.freeText = freeText.join(" ");
  }

  return parsed;
}

function structuredTokens(parsed: ParsedQuery): string[] {
  const tokens: string[] = [];
  if (parsed.lifecycle) {
    tokens.push(`is:${parsed.lifecycle}`);
  }
  if (parsed.viewModifier) {
    tokens.push(`is:${parsed.viewModifier}`);
  }
  if (parsed.escalating) {
    tokens.push("is:escalating");
  }
  if (parsed.priority) {
    tokens.push(`priority:${parsed.priority}`);
  }
  if (parsed.level) {
    tokens.push(`level:${parsed.level}`);
  }
  if (parsed.environment) {
    tokens.push(`env:${parsed.environment}`);
  }
  if (parsed.release) {
    tokens.push(`release:${parsed.release}`);
  }
  if (parsed.userEmail) {
    tokens.push(`user.email:${parsed.userEmail}`);
  }
  if (parsed.issueId) {
    tokens.push(`issue:${parsed.issueId}`);
  }
  return tokens;
}

/** Rebuild a query string from structured tokens + optional free text. */
export function composeQuery(parsed: ParsedQuery, freeText?: string): string {
  const tokens = structuredTokens(parsed);
  const text = (freeText ?? parsed.freeText ?? "").trim();
  const combined = [...tokens, text].filter(Boolean).join(" ").trim();
  return combined || ALL_QUERY;
}

/** Keep structured filter tokens; replace only the free-text portion. */
export function replaceFreeText(query: string, freeText: string): string {
  return composeQuery(parseQuery(query), freeText);
}

function isStructuredToken(token: string): boolean {
  return (
    token.startsWith("is:") ||
    token.startsWith("env:") ||
    token.startsWith("release:") ||
    token.startsWith("user.email:") ||
    token.startsWith("level:") ||
    token.startsWith("priority:") ||
    token.startsWith("issue:")
  );
}

function removeExactTokens(query: string, tokens: Iterable<string>): string {
  const drop = new Set(tokens);
  return query
    .split(/\s+/)
    .filter((part) => part && !drop.has(part))
    .join(" ")
    .trim();
}

/** Query sent to the issues API (drops client-only refine tokens). */
export function toApiQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter(
      (token) =>
        token &&
        token !== "is:escalating" &&
        !token.startsWith("priority:") &&
        !token.startsWith("issue:"),
    )
    .join(" ")
    .trim();
}

/** Free-text portion of a query (everything that is not a `key:value` filter token). */
export function getSearchText(query: string): string {
  return query
    .split(/\s+/)
    .filter((token) => token && !isStructuredToken(token))
    .join(" ");
}

/**
 * Replace only the free-text portion of a query, leaving every filter token untouched.
 * Unlike `replaceFreeText`, an empty result stays empty (the "All" view) instead of
 * falling back to `is:unresolved`.
 */
export function withSearchText(query: string, text: string): string {
  const tokens = query.split(/\s+/).filter((token) => token && isStructuredToken(token));
  return [...tokens, text.trim()].filter(Boolean).join(" ");
}

export function removeToken(query: string, prefix: string): string {
  return query
    .split(/\s+/)
    .filter((token) => !token.startsWith(prefix))
    .join(" ")
    .trim();
}

export function setToken(query: string, token: string): string {
  const prefix = token.includes(":") ? `${token.split(":")[0]}:` : token;
  const without = removeToken(query, prefix);
  return without ? `${without} ${token}` : token;
}

/** Add or remove a filter token; primary lifecycle and view modifiers are independent groups. */
export function applyFilterToken(query: string, token: string): string {
  const parts = query.split(/\s+/).filter(Boolean);
  if (parts.includes(token)) {
    return removeExactTokens(query, [token]);
  }

  let next = query.trim();
  if ((PRIMARY_LIFECYCLE_IS_TOKENS as readonly string[]).includes(token)) {
    next = removeExactTokens(next, PRIMARY_LIFECYCLE_IS_TOKENS);
  } else if ((VIEW_MODIFIER_IS_TOKENS as readonly string[]).includes(token)) {
    next = removeExactTokens(next, VIEW_MODIFIER_IS_TOKENS);
  } else if (token.startsWith("level:")) {
    next = removeToken(next, "level:");
  } else if (token.startsWith("env:")) {
    next = removeToken(next, "env:");
  } else if (token.startsWith("priority:")) {
    next = removeToken(next, "priority:");
  } else if (token.startsWith("release:")) {
    next = removeToken(next, "release:");
  } else if (token.startsWith("user.email:")) {
    next = removeToken(next, "user.email:");
  }

  return next ? `${next} ${token}` : token;
}

export function toggleToken(query: string, token: string): string {
  return applyFilterToken(query, token);
}

/** Remove a structured filter token (e.g. `is:unresolved`) from the query. */
export function removeChipToken(query: string, token: string): string {
  if (token.startsWith("is:")) {
    return removeExactTokens(query, [token]);
  }
  const prefix = `${token.split(":")[0]}:`;
  return removeToken(query, prefix);
}

/** Default unresolved tab preset (explicit filter). */
export const DEFAULT_QUERY = "is:unresolved";

/** Empty query — no lifecycle or search filters; list shows every status in the time window. */
export const ALL_QUERY = "";

export function isAllIssuesQuery(query: string): boolean {
  if (query.trim() === ALL_QUERY) {
    return true;
  }
  const parsed = parseQuery(query);
  return (
    !parsed.lifecycle &&
    !parsed.viewModifier &&
    !parsed.escalating &&
    !parsed.priority &&
    !parsed.level &&
    !parsed.environment &&
    !parsed.release &&
    !parsed.userEmail &&
    !parsed.freeText
  );
}

export interface FilterPreset {
  label: string;
  token: string;
}

/** State filters surfaced in the feed search helper. */
export const STATUS_FILTER_PRESETS: readonly FilterPreset[] = [
  { label: "Unresolved", token: "is:unresolved" },
  { label: "Came back", token: "is:regression" },
  { label: "Snoozed", token: "is:snoozed" },
  { label: "Resolved", token: "is:resolved" },
  { label: "Ignored", token: "is:ignored" },
];

/** Severity level filters. */
export const LEVEL_FILTER_PRESETS: readonly FilterPreset[] = [
  { label: "Fatal", token: "level:fatal" },
  { label: "Error", token: "level:error" },
  { label: "Warning", token: "level:warning" },
  { label: "Info", token: "level:info" },
];

/** Environment filters. */
export const ENVIRONMENT_FILTER_PRESETS: readonly FilterPreset[] = [
  { label: "Production", token: "env:production" },
  { label: "Staging", token: "env:staging" },
  { label: "Development", token: "env:development" },
  { label: "Preview", token: "env:preview" },
];

/** Impact and telemetry filters. */
export const IMPACT_FILTER_PRESETS: readonly FilterPreset[] = [
  { label: "Affecting Users", token: "user.email:@" },
];

/** Signal / trend filters (refined on the client after fetch). */
export const SIGNAL_FILTER_PRESETS: readonly FilterPreset[] = [
  { label: "Escalating (3d)", token: "is:escalating" },
];

/** Priority buckets (derived from level + status). */
export const PRIORITY_FILTER_PRESETS: readonly FilterPreset[] = [
  { label: "Critical", token: "priority:critical" },
  { label: "High", token: "priority:high" },
  { label: "Medium", token: "priority:medium" },
  { label: "Low", token: "priority:low" },
];

/** Label lookup for tokens typed manually or from advanced filters. */
export const PRESET_FILTERS: readonly FilterPreset[] = [
  ...STATUS_FILTER_PRESETS,
  ...SIGNAL_FILTER_PRESETS,
  ...PRIORITY_FILTER_PRESETS,
  ...LEVEL_FILTER_PRESETS,
  ...ENVIRONMENT_FILTER_PRESETS,
  ...IMPACT_FILTER_PRESETS,
];

export function getFilterPresetLabel(token: string): string {
  const preset = PRESET_FILTERS.find((entry) => entry.token === token);
  if (preset) {
    return preset.label;
  }
  const colon = token.indexOf(":");
  if (colon > 0) {
    return token.slice(colon + 1);
  }
  return token;
}

export interface QueryChip {
  key: string;
  label: string;
  token: string;
  /** Plain-language chip — no `key:` prefix in the search bar */
  plain?: boolean;
}

export function extractChips(query: string): QueryChip[] {
  const parsed = parseQuery(query);
  const chips: QueryChip[] = [];

  if (parsed.lifecycle) {
    const token = `is:${parsed.lifecycle}`;
    chips.push({
      key: "lifecycle",
      label: getFilterPresetLabel(token),
      token,
      plain: true,
    });
  }
  if (parsed.viewModifier) {
    const token = `is:${parsed.viewModifier}`;
    chips.push({
      key: "view",
      label: getFilterPresetLabel(token),
      token,
      plain: true,
    });
  }
  if (parsed.escalating) {
    chips.push({
      key: "signal",
      label: getFilterPresetLabel("is:escalating"),
      token: "is:escalating",
      plain: true,
    });
  }
  if (parsed.priority) {
    const token = `priority:${parsed.priority}`;
    chips.push({
      key: "priority",
      label: getFilterPresetLabel(token),
      token,
    });
  }
  if (parsed.level) {
    const token = `level:${parsed.level}`;
    chips.push({
      key: "level",
      label: getFilterPresetLabel(token),
      token,
    });
  }
  if (parsed.environment) {
    const token = `env:${parsed.environment}`;
    chips.push({
      key: "env",
      label: getFilterPresetLabel(token),
      token,
    });
  }
  if (parsed.release) {
    const token = `release:${parsed.release}`;
    chips.push({
      key: "release",
      label: parsed.release,
      token,
    });
  }
  if (parsed.userEmail) {
    const token = `user.email:${parsed.userEmail}`;
    chips.push({
      key: "user",
      label: parsed.userEmail === "@" ? "Users" : parsed.userEmail,
      token,
    });
  }

  return chips;
}

export interface FilterHelperGroup {
  label: string;
  category: "status" | "signal" | "priority" | "level" | "environment" | "impact";
  presets: readonly FilterPreset[];
}

export const FILTER_HELPER_GROUPS: readonly FilterHelperGroup[] = [
  { label: "Lifecycle State", category: "status", presets: STATUS_FILTER_PRESETS },
  { label: "Signal", category: "signal", presets: SIGNAL_FILTER_PRESETS },
  { label: "Priority", category: "priority", presets: PRIORITY_FILTER_PRESETS },
  { label: "Severity Level", category: "level", presets: LEVEL_FILTER_PRESETS },
  { label: "Environment", category: "environment", presets: ENVIRONMENT_FILTER_PRESETS },
  { label: "Impact & Users", category: "impact", presets: IMPACT_FILTER_PRESETS },
];

export function getLevelFilter(query: string): string | null {
  const parsed = parseQuery(query);
  return parsed.level ?? null;
}

export function setLevelFilter(query: string, level: string | null): string {
  if (!level) {
    return removeToken(query, "level:");
  }
  return setToken(query, `level:${level}`);
}

export function getEnvironmentFilter(query: string): string | null {
  const parsed = parseQuery(query);
  return parsed.environment ?? null;
}

export function setEnvironmentFilter(query: string, environment: string | null): string {
  if (!environment) {
    return removeToken(query, "env:");
  }
  return setToken(query, `env:${environment}`);
}

export function hasActiveFilters(query: string): boolean {
  return !isAllIssuesQuery(query);
}

export function resetQuery(): string {
  return ALL_QUERY;
}

export function queryHasToken(query: string, token: string): boolean {
  return query.split(/\s+/).includes(token);
}

const STATUS_TITLES: Record<string, string> = {
  unresolved: "Unresolved issues",
  resolved: "Resolved issues",
  ignored: "Ignored issues",
  regression: "Issues that came back",
  snoozed: "Snoozed issues",
};

const LEVEL_TITLES: Record<string, string> = {
  fatal: "Fatal issues",
  error: "Critical issues",
  warning: "Warning issues",
  info: "Informational issues",
};

/** Plain-language list title for J2 scan (no query tokens on surface). */
export function getIssuesListTitle(query: string): string {
  const parsed = parseQuery(query);

  if (parsed.viewModifier && STATUS_TITLES[parsed.viewModifier]) {
    return STATUS_TITLES[parsed.viewModifier];
  }
  if (parsed.lifecycle && STATUS_TITLES[parsed.lifecycle]) {
    return STATUS_TITLES[parsed.lifecycle];
  }
  if (parsed.level && LEVEL_TITLES[parsed.level]) {
    return LEVEL_TITLES[parsed.level];
  }
  if (parsed.environment) {
    return `Issues in ${parsed.environment}`;
  }
  return "All issues";
}

/** Compact subtitle: count + extra filter context in plain English. */
export function getIssuesListSubtitle(
  query: string,
  count: number,
  loading: boolean,
  timeWindow: TimeWindowValue = DEFAULT_TIME_WINDOW,
): string {
  if (loading) {
    return "Loading…";
  }

  const noun = count === 1 ? "exception" : "exceptions";
  const parsed = parseQuery(query);
  const parts = [`${count} ${noun}`, getTimeWindowLabel(timeWindow).toLowerCase()];
  const extras: string[] = [];

  if (parsed.release) {
    extras.push(`release ${parsed.release}`);
  }
  if (parsed.userEmail) {
    extras.push(`user ${parsed.userEmail}`);
  }
  if (parsed.freeText) {
    extras.push(`matching "${parsed.freeText}"`);
  }
  if (parsed.level && !LEVEL_TITLES[parsed.level]) {
    extras.push(`${parsed.level} level`);
  }

  if (extras.length > 0) {
    parts.push(extras.join(", "));
  }

  return parts.join(" · ");
}
