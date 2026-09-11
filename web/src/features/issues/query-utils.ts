export interface ParsedQuery {
  status?: string;
  environment?: string;
  release?: string;
  userEmail?: string;
  level?: string;
  freeText?: string;
}

export type TimeWindowValue = "24h" | "7d" | "14d" | "30d" | "90d";

export const DEFAULT_TIME_WINDOW: TimeWindowValue = "7d";

export type IssueSortValue =
  | "last_seen_desc"
  | "last_seen_asc"
  | "events_desc"
  | "events_asc"
  | "first_seen_desc"
  | "first_seen_asc"
  | "title_asc";

export const DEFAULT_ISSUE_SORT: IssueSortValue = "last_seen_desc";

export const ISSUE_SORT_OPTIONS: ReadonlyArray<{
  value: IssueSortValue;
  label: string;
}> = [
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

export const TIME_WINDOW_OPTIONS: ReadonlyArray<{
  value: TimeWindowValue;
  label: string;
}> = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const TIME_WINDOW_SET = new Set<string>(TIME_WINDOW_OPTIONS.map((option) => option.value));

export function parseTimeWindow(raw: string | null | undefined): TimeWindowValue {
  if (raw && TIME_WINDOW_SET.has(raw)) {
    return raw as TimeWindowValue;
  }
  return DEFAULT_TIME_WINDOW;
}

export function getTimeWindowLabel(value: TimeWindowValue): string {
  return (
    TIME_WINDOW_OPTIONS.find((option) => option.value === value)?.label ??
    "Last 7 days"
  );
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
      parsed.status = normalizeStatus(token.slice(3));
    } else if (token.startsWith("env:")) {
      parsed.environment = token.slice(4);
    } else if (token.startsWith("release:")) {
      parsed.release = token.slice(8);
    } else if (token.startsWith("user.email:")) {
      parsed.userEmail = token.slice(11);
    } else if (token.startsWith("level:")) {
      parsed.level = token.slice(6);
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
  if (parsed.status) {
    tokens.push(`is:${parsed.status}`);
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
  return tokens;
}

/** Rebuild a query string from structured tokens + optional free text. */
export function composeQuery(parsed: ParsedQuery, freeText?: string): string {
  const tokens = structuredTokens(parsed);
  const text = (freeText ?? parsed.freeText ?? "").trim();
  const combined = [...tokens, text].filter(Boolean).join(" ").trim();
  return combined || "is:unresolved";
}

/** Keep structured filter tokens; replace only the free-text portion. */
export function replaceFreeText(query: string, freeText: string): string {
  return composeQuery(parseQuery(query), freeText);
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

export function toggleToken(query: string, token: string): string {
  const prefix = `${token.split(":")[0]}:`;
  const has = query.split(/\s+/).some((part) => part === token);
  if (has) {
    return removeToken(query, prefix);
  }
  return setToken(query, token);
}

/** Remove a structured filter token (e.g. `is:unresolved`) from the query. */
export function removeChipToken(query: string, token: string): string {
  const prefix = `${token.split(":")[0]}:`;
  return removeToken(query, prefix);
}

export interface FilterPreset {
  label: string;
  token: string;
}

/** State filters surfaced in the feed search helper — no env, release, or level. */
export const STATUS_FILTER_PRESETS: readonly FilterPreset[] = [
  { label: "Unresolved", token: "is:unresolved" },
  { label: "Came back", token: "is:regression" },
  { label: "Snoozed", token: "is:snoozed" },
  { label: "Resolved", token: "is:resolved" },
  { label: "Ignored", token: "is:ignored" },
];

/** Label lookup for tokens typed manually or from advanced filters. */
export const PRESET_FILTERS: readonly FilterPreset[] = [
  ...STATUS_FILTER_PRESETS,
  { label: "Error", token: "level:error" },
  { label: "Warning", token: "level:warning" },
  { label: "Production", token: "env:production" },
  { label: "Staging", token: "env:staging" },
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

  if (parsed.status) {
    const token = `is:${parsed.status}`;
    chips.push({
      key: "is",
      label: getFilterPresetLabel(token),
      token,
      plain: true,
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
      label: parsed.environment,
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
      key: "user.email",
      label: parsed.userEmail,
      token,
    });
  }

  return chips;
}

export interface FilterHelperGroup {
  label: string;
  presets: readonly FilterPreset[];
}

/** @deprecated Feed search uses STATUS_FILTER_PRESETS only */
export const FILTER_HELPER_GROUPS: readonly FilterHelperGroup[] = [
  { label: "State", presets: STATUS_FILTER_PRESETS },
];

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
  error: "Critical issues",
  warning: "Warning issues",
};

/** Plain-language list title for J2 scan (no query tokens on surface). */
export function getIssuesListTitle(query: string): string {
  const parsed = parseQuery(query);

  if (parsed.status && STATUS_TITLES[parsed.status]) {
    return STATUS_TITLES[parsed.status];
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
