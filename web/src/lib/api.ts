export interface IssueSummary {
  id: string;
  org_id: string;
  project_id: string;
  fingerprint: string;
  title: string | null;
  status: string;
  level: string | null;
  environment: string | null;
  release: string | null;
  event_count: number;
  unique_user_count: number;
  last_seen_at: string | null;
  first_seen_at: string | null;
  resolved_in_release: string | null;
  snoozed: boolean;
  snooze_until: string | null;
  snooze_until_count: number | null;
  snooze_until_users: number | null;
  /** Why this issue absorbed later events: exact_stack, crash_site, cycle_folded, message_template, custom. */
  merge_reason?: string;
  /** Events counted without a stored body after the causal spike valve tripped. */
  spike_coalesced?: number;
  /** Up to five sampled caller or message variants kept on the parent issue. */
  coalesced_variants?: string[];
  culprit?: string | null;
  platform?: string | null;
  is_unhandled?: boolean;
  first_release?: string | null;
  last_release?: string | null;
  resolved_at?: string | null;
  regressed_count?: number;
  latest_event_id?: string | null;
  environments?: string[];
  issue_number?: number | null;
  priority?: string;
  priority_score?: number;
  priority_locked?: boolean;
  /** spike, ramp, regression, spread, new, steady, trickle, noise, or stale. */
  priority_pattern?: string | null;
  came_back?: boolean;
  affected_users_count?: number;
  velocity_24h?: number;
  is_escalating_3d?: boolean;
}

export interface TimelineBucket {
  start: string;
  count: number;
}

export interface IssueTimeline {
  issue_id: string;
  event_count: number;
  stored_event_count: number;
  buckets: TimelineBucket[];
  summary: {
    last_1h: number;
    last_24h: number;
    last_7d: number;
  };
}

export interface EventDetail {
  id: string;
  issue_id: string;
  occurred_at: string;
  environment: string | null;
  release: string | null;
  platform: string | null;
  runtime_name: string | null;
  runtime_version: string | null;
  browser_name: string | null;
  os_name: string | null;
  user_id: string | null;
  user_email: string | null;
  payload_json: Record<string, unknown>;
  stack_frames: unknown;
  breadcrumbs: unknown;
}

import { ApiError, apiErrorStatus } from "./api-error";

export { apiErrorStatus };

function redirectToLogin(): void {
  const loginPath = "/login";
  if (window.location.pathname.startsWith(loginPath)) {
    return;
  }
  const from = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams({ from });
  window.location.assign(`${loginPath}?${params.toString()}`);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new ApiError(0, path, `Network error: ${path}`);
  }

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError(401, path);
  }

  if (!response.ok) {
    throw new ApiError(response.status, path);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface IssueListTrend {
  issue_id: string;
  buckets: TimelineBucket[];
}

export async function fetchIssueTrends(
  issueIds: string[],
  window?: string,
): Promise<Record<string, TimelineBucket[]>> {
  if (issueIds.length === 0) {
    return {};
  }

  const body = await apiFetch<{ trends: IssueListTrend[] }>("/api/v1/issues/trends", {
    method: "POST",
    body: JSON.stringify({ issue_ids: issueIds, window }),
  });

  return Object.fromEntries(
    body.trends.map((trend) => [trend.issue_id, trend.buckets]),
  );
}

export async function fetchIssues(
  query: string,
  projectId?: string,
  window?: string,
  sort?: string,
  environment?: string,
): Promise<IssueSummary[]> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  if (projectId) {
    params.set("project_id", projectId);
  }
  if (environment) {
    params.set("environment", environment);
  }
  if (window) {
    params.set("window", window);
  }
  if (sort) {
    params.set("sort", sort);
  }
  const suffix = params.toString();
  const body = await apiFetch<{ issues: IssueSummary[] }>(
    `/api/v1/issues${suffix ? `?${suffix}` : ""}`,
  );
  return body.issues;
}

export async function patchIssue(
  id: string,
  status: string,
  resolvedInRelease?: string,
): Promise<IssueSummary> {
  return apiFetch<IssueSummary>(`/api/v1/issues/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      resolved_in_release: resolvedInRelease,
    }),
  });
}

export type SnoozeMode =
  | "1h"
  | "4h"
  | "1d"
  | "7d"
  | "30d"
  | "90d"
  | "occurrences"
  | "users";

export async function snoozeIssue(id: string, mode: SnoozeMode): Promise<IssueSummary> {
  return apiFetch<IssueSummary>(`/api/v1/issues/${id}/snooze`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export async function unsnoozeIssue(id: string): Promise<IssueSummary> {
  return apiFetch<IssueSummary>(`/api/v1/issues/${id}/unsnooze`, {
    method: "POST",
  });
}


export interface AlertRow {
  id: string;
  org_id: string;
  project_id: string;
  issue_id: string | null;
  kind: string;
  fired_at: string;
  payload_json: Record<string, unknown>;
  read_at: string | null;
  ignored: boolean;
}

export type AlertListView = "all" | "unread" | "resolved" | "ignored";

export async function fetchAlerts(
  projectId?: string,
  environment?: string,
  view?: AlertListView | string,
  limit?: number,
  offset?: number,
): Promise<AlertRow[]> {
  const params = new URLSearchParams();
  if (projectId) {
    params.set("project_id", projectId);
  }
  if (environment && environment !== "all") {
    params.set("environment", environment);
  }
  if (view && view !== "all") {
    params.set("view", view);
  }
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  if (typeof offset === "number" && offset > 0) {
    params.set("offset", String(offset));
  }
  const suffix = params.toString();
  const body = await apiFetch<{ alerts?: AlertRow[] } | AlertRow[]>(
    `/api/v1/alerts${suffix ? `?${suffix}` : ""}`,
  );
  if (Array.isArray(body)) {
    return body;
  }
  return Array.isArray(body?.alerts) ? body.alerts : [];
}

export async function simulateAlert(
  projectId: string,
  kind?: string,
): Promise<AlertRow> {
  return apiFetch<AlertRow>("/api/v1/alerts/simulate", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, kind }),
  });
}

export async function patchAlert(
  id: string,
  patch: { read?: boolean; ignored?: boolean },
): Promise<AlertRow> {
  return apiFetch<AlertRow>(`/api/v1/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface AlertRuleFilters {
  min_level?: "any" | "error" | "fatal" | string | null;
  first_seen?: "any" | "new" | string | null;
  cooldown_minutes?: number | null;
  query?: string | null;
  service?: string | null;
  release?: string | null;
  [key: string]: unknown;
}

export interface AlertRuleRow {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  enabled: boolean;
  kind:
    | "velocity_spike"
    | "regression"
    | "issue_created"
    | "users_affected"
    | "event_milestone"
    | "custom"
    | string;
  environment: string | null;
  threshold: number | null;
  filters_json?: AlertRuleFilters;
  created_at: string;
}

export async function fetchAlertRules(projectId?: string): Promise<AlertRuleRow[]> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const body = await apiFetch<{ rules?: AlertRuleRow[] } | AlertRuleRow[]>(
    `/api/v1/alert-rules${query}`,
  );
  if (Array.isArray(body)) {
    return body;
  }
  return Array.isArray(body?.rules) ? body.rules : [];
}

export interface AlertChannelRow {
  id: string;
  org_id: string;
  project_id: string;
  provider: "slack" | "discord" | "telegram" | "email" | "webhook" | string;
  label: string;
  is_enabled: boolean;
  last_error: string | null;
  created_at: string;
}

export async function fetchAlertChannels(projectId: string): Promise<AlertChannelRow[]> {
  const body = await apiFetch<{ channels?: AlertChannelRow[] }>(
    `/api/v1/alert-channels?project_id=${encodeURIComponent(projectId)}`,
  );
  return Array.isArray(body?.channels) ? body.channels : [];
}

export async function createAlertChannel(input: {
  project_id: string;
  provider: string;
  label: string;
}): Promise<AlertChannelRow> {
  return apiFetch<AlertChannelRow>("/api/v1/alert-channels", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function pingAlertChannel(id: string): Promise<{ status: string; detail: string }> {
  return apiFetch(`/api/v1/alert-channels/${id}/ping`, { method: "POST" });
}

export async function createAlertRule(input: {
  project_id: string;
  name: string;
  kind: string;
  environment?: string | null;
  threshold?: number | null;
  filters_json?: AlertRuleFilters;
  enabled?: boolean;
  triggers?: unknown[];
  condition_match?: "all" | "any";
  conditions?: unknown[];
  payload_options?: Record<string, boolean>;
  channel_ids?: string[];
  cooldown_mins?: number;
}): Promise<AlertRuleRow> {
  return apiFetch<AlertRuleRow>("/api/v1/alert-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAlertRule(
  id: string,
  input: {
    name?: string;
    enabled?: boolean;
    environment?: string | null;
    threshold?: number | null;
    filters_json?: AlertRuleFilters;
  },
): Promise<AlertRuleRow> {
  return apiFetch<AlertRuleRow>(`/api/v1/alert-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAlertRule(id: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/alert-rules/${id}`, {
    method: "DELETE",
  });
}

export interface WebhookRow {
  id: string;
  project_id: string;
  url: string;
  format: string;
  events: string[];
  secret_prefix: string;
  created_at: string;
}

export interface CreatedWebhook extends WebhookRow {
  signing_secret: string;
}

export async function fetchWebhooks(projectId: string): Promise<WebhookRow[]> {
  const body = await apiFetch<{ webhooks?: WebhookRow[] } | WebhookRow[]>(
    `/api/v1/webhooks?project_id=${encodeURIComponent(projectId)}`,
  );
  if (Array.isArray(body)) {
    return body;
  }
  return Array.isArray(body?.webhooks) ? body.webhooks : [];
}

export async function createWebhook(input: {
  project_id: string;
  url: string;
  format: "slack" | "discord" | "generic";
  events?: string[];
}): Promise<CreatedWebhook> {
  return apiFetch<CreatedWebhook>("/api/v1/webhooks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateWebhook(
  id: string,
  input: { events: string[] },
): Promise<WebhookRow> {
  return apiFetch<WebhookRow>(`/api/v1/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function testWebhook(id: string): Promise<void> {
  await apiFetch<{ sent: boolean }>(`/api/v1/webhooks/${id}/test`, {
    method: "POST",
  });
}

export async function rotateWebhookSecret(id: string): Promise<CreatedWebhook> {
  return apiFetch<CreatedWebhook>(`/api/v1/webhooks/${id}/rotate-secret`, {
    method: "POST",
  });
}

export async function bulkUpdateIssues(
  ids: string[],
  action: "resolve" | "ignore" | "reopen" | "delete",
): Promise<number> {
  if (action === "delete") {
    const body = await apiFetch<{ updated: number }>("/api/v1/issues/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids, action: "delete" }),
    });
    return body.updated;
  }

  const body = await apiFetch<{ updated: number }>("/api/v1/issues/bulk", {
    method: "PATCH",
    body: JSON.stringify({ ids, action }),
  });
  return body.updated;
}

export async function mergeIssues(
  canonicalId: string,
  mergeIds: string[],
): Promise<number> {
  const body = await apiFetch<{ updated: number }>("/api/v1/issues/merge", {
    method: "POST",
    body: JSON.stringify({ canonical_id: canonicalId, merge_ids: mergeIds }),
  });
  return body.updated;
}

export async function fetchMergedChildren(issueId: string): Promise<IssueSummary[]> {
  const body = await apiFetch<{ issues: IssueSummary[] }>(
    `/api/v1/issues/${issueId}/merged`,
  );
  return Array.isArray(body?.issues) ? body.issues : [];
}

export async function splitIssues(
  canonicalId: string,
  splitIds: string[],
): Promise<number> {
  const body = await apiFetch<{ updated: number }>("/api/v1/issues/split", {
    method: "POST",
    body: JSON.stringify({ canonical_id: canonicalId, split_ids: splitIds }),
  });
  return body.updated;
}

export const EVENTS_PAGE_SIZE = 40;

export interface EventsPage {
  events: EventDetail[];
  total: number;
  has_more: boolean;
}

export interface FetchEventsOptions {
  release?: string;
  limit?: number;
  offset?: number;
}

export async function fetchEvents(
  issueId: string,
  options: FetchEventsOptions = {},
): Promise<EventsPage> {
  const params = new URLSearchParams();
  if (options.release) {
    params.set("release", options.release);
  }
  if (options.limit != null) {
    params.set("limit", String(options.limit));
  }
  if (options.offset != null) {
    params.set("offset", String(options.offset));
  }
  const suffix = params.toString();
  return apiFetch<EventsPage>(
    `/api/v1/issues/${issueId}/events${suffix ? `?${suffix}` : ""}`,
  );
}

export async function fetchIssueReleases(issueId: string): Promise<string[]> {
  const body = await apiFetch<{ releases?: string[] } | string[]>(
    `/api/v1/issues/${issueId}/releases`,
  );
  if (Array.isArray(body)) {
    return body;
  }
  return Array.isArray(body?.releases) ? body.releases : [];
}

export async function fetchIssueTimeline(
  issueId: string,
  window = "7d",
  bucket?: string,
): Promise<IssueTimeline> {
  const params = new URLSearchParams({ window });
  if (bucket) {
    params.set("bucket", bucket);
  }
  return apiFetch<IssueTimeline>(
    `/api/v1/issues/${issueId}/timeline?${params.toString()}`,
  );
}

export interface UserFeedback {
  id: string;
  event_id: string;
  name: string | null;
  email: string | null;
  comments: string | null;
  created_at: string;
}

export async function fetchEventFeedback(
  eventId: string,
): Promise<UserFeedback | null> {
  return apiFetch<UserFeedback | null>(`/api/v1/events/${eventId}/feedback`);
}

export interface ReleaseSummary {
  id: string;
  project_id: string;
  version: string;
  artifact_count: number;
  last_upload_at: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  issue_count: number;
  event_count: number;
  regression_count: number;
  new_issue_count: number;
}

export async function fetchReleases(projectId: string): Promise<ReleaseSummary[]> {
  const body = await apiFetch<{ releases?: ReleaseSummary[] } | ReleaseSummary[]>(
    `/api/v1/releases?project_id=${encodeURIComponent(projectId)}`,
  );
  if (Array.isArray(body)) {
    return body;
  }
  return Array.isArray(body?.releases) ? body.releases : [];
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/webhooks/${id}`, {
    method: "DELETE",
  });
}

export interface MeResponse {
  user_id: string;
  org_id: string;
  org_name?: string | null;
  email: string;
  display_name: string | null;
  role: string;
  has_password: boolean;
  google_linked: boolean;
  github_linked?: boolean;
  plan_tier?: string | null;
}

export interface UserOrganization {
  id: string;
  name: string;
  role: string;
  plan_tier: string;
  member_count: number;
  is_current: boolean;
}

export interface ProjectEmailAlertSettings {
  email_alerts_enabled: boolean;
  email_alert_recipients: string[];
  email_alert_on_regression: boolean;
  email_alert_on_spike: boolean;
}

export async function fetchUserOrganizations(): Promise<UserOrganization[]> {
  const res = await apiFetch<{ organizations: UserOrganization[] }>("/api/v1/auth/organizations");
  return res.organizations;
}

export async function switchOrganization(orgId: string): Promise<{
  success: boolean;
  org_id: string;
  org_name: string;
  role: string;
}> {
  return apiFetch<{ success: boolean; org_id: string; org_name: string; role: string }>(
    "/api/v1/auth/switch-org",
    {
      method: "POST",
      body: JSON.stringify({ org_id: orgId }),
    },
  );
}

export async function acceptInvitation(inviteToken: string): Promise<void> {
  await apiFetch<void>("/api/v1/auth/accept-invitation", {
    method: "POST",
    body: JSON.stringify({ invite_token: inviteToken }),
  });
}

export async function fetchProjectEmailAlertSettings(
  projectId: string,
): Promise<ProjectEmailAlertSettings> {
  return apiFetch<ProjectEmailAlertSettings>(`/api/v1/projects/${projectId}/email-alerts`);
}

export async function updateProjectEmailAlertSettings(
  projectId: string,
  settings: Partial<ProjectEmailAlertSettings>,
): Promise<ProjectEmailAlertSettings> {
  return apiFetch<ProjectEmailAlertSettings>(`/api/v1/projects/${projectId}/email-alerts`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export async function sendTestEmailAlert(
  projectId: string,
  recipient?: string,
): Promise<{ sent: boolean; recipient: string; resend_id?: string; error?: string }> {
  return apiFetch(`/api/v1/projects/${projectId}/alerts/test-email`, {
    method: "POST",
    body: JSON.stringify({ recipient }),
  });
}

export interface AuthConfig {
  google_enabled: boolean;
  github_enabled?: boolean;
  password_enabled: boolean;
  registration_enabled: boolean;
  session_secure?: boolean;
  mcp_enabled?: boolean;
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/v1/auth/me");
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  return apiFetch<AuthConfig>("/api/v1/auth/config");
}

export async function loginWithPassword(email: string, password: string): Promise<void> {
  await apiFetch<void>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function registerWithPassword(
  email: string,
  password: string,
  inviteToken?: string,
): Promise<void> {
  await apiFetch<void>("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      invite_token: inviteToken ?? null,
    }),
  });
}

export async function updateProfile(input: { display_name: string | null }): Promise<void> {
  await apiFetch<void>("/api/v1/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function changePassword(input: {
  current_password?: string;
  new_password: string;
}): Promise<void> {
  await apiFetch<void>("/api/v1/auth/password", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAccount(input: {
  confirm_email: string;
  password?: string;
}): Promise<void> {
  await apiFetch<void>("/api/v1/auth/account", {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}

export interface ProjectRow {
  id: string;
  dsn_project_id: number;
  org_id: string;
  name: string;
  slug: string | null;
  retention_days: number;
  ingest_cap_per_hour: number;
  /** When false, ingest drops end-user email, username, and precise location. */
  store_end_user_identifiers?: boolean;
  is_demo?: boolean;
  created_at: string;
  /** Viewer org role on this project (`owner` / `admin` / `member`). */
  role?: string;
}

export interface PrivacyNotice {
  product: string;
  deployment: "cloud" | "self_host";
  phone_home: boolean;
  analytics: boolean;
  session_replay: boolean;
  stores_client_ip: boolean;
  identifiers_default: string;
  default_retention_days: number;
  operator_name: string | null;
  privacy_contact: string | null;
  data_region: string | null;
  privacy_policy_url: string | null;
  dpa_url: string | null;
  cookies: Array<{
    name: string;
    host_prefix_when_https: string;
    purpose: string;
    necessary: boolean;
    duration: string;
    flags: string[];
  }>;
  subprocessors: Array<{
    name: string;
    purpose: string;
    data: string;
    configured: boolean;
  }>;
  rights: string[];
}

export async function fetchProjects(): Promise<ProjectRow[]> {
  const body = await apiFetch<{ projects: ProjectRow[] }>("/api/v1/projects");
  return body.projects;
}

export async function createProject(name: string): Promise<ProjectRow> {
  return apiFetch<ProjectRow>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function fetchPrivacyNotice(): Promise<PrivacyNotice> {
  return apiFetch<PrivacyNotice>("/api/v1/privacy");
}

export async function exportAccount(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/api/v1/auth/account/export");
}

export async function exportDataSubject(
  projectId: string,
  query: { user_id?: string; email?: string },
): Promise<{
  project_id: string;
  total: number;
  truncated: boolean;
  events: unknown[];
}> {
  const params = new URLSearchParams();
  if (query.user_id) {
    params.set("user_id", query.user_id);
  }
  if (query.email) {
    params.set("email", query.email);
  }
  return apiFetch(`/api/v1/projects/${projectId}/privacy/export?${params.toString()}`);
}

export async function eraseDataSubject(
  projectId: string,
  body: { user_id?: string; email?: string },
): Promise<{ project_id: string; events_deleted: number; feedback_deleted: number }> {
  return apiFetch(`/api/v1/projects/${projectId}/privacy/erase`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function stripStoredIdentifiers(
  projectId: string,
): Promise<{ project_id: string; events_updated: number; feedback_cleared: number }> {
  return apiFetch(`/api/v1/projects/${projectId}/privacy/strip-identifiers`, {
    method: "POST",
  });
}

export interface NoisePolicy {
  extensions: boolean;
  crawlers: boolean;
  localhost: boolean;
  legacy_browsers: boolean;
  resize_observer: boolean;
  chunk_load: boolean;
  message_patterns: string[];
}

export interface IngestOutcome {
  reason: string;
  count: number;
}

export async function fetchNoisePolicy(projectId: string): Promise<NoisePolicy> {
  return apiFetch<NoisePolicy>(`/api/v1/projects/${projectId}/noise-policy`);
}

export async function saveNoisePolicy(projectId: string, policy: NoisePolicy): Promise<NoisePolicy> {
  return apiFetch<NoisePolicy>(`/api/v1/projects/${projectId}/noise-policy`, {
    method: "PUT",
    body: JSON.stringify(policy),
  });
}

export async function fetchIngestOutcomes(
  projectId: string,
): Promise<{ window: string; reasons: IngestOutcome[] }> {
  return apiFetch(`/api/v1/projects/${projectId}/ingest-outcomes`);
}

export async function previewNoisePolicy(
  projectId: string,
  sample: string,
): Promise<{ suppressed: boolean; rule: string | null; detail: string | null }> {
  return apiFetch(`/api/v1/projects/${projectId}/noise-policy/preview`, {
    method: "POST",
    body: JSON.stringify({ sample }),
  });
}

export async function updateProject(
  id: string,
  input: {
    name?: string;
    retention_days?: number;
    ingest_cap_per_hour?: number;
    store_end_user_identifiers?: boolean;
  },
): Promise<ProjectRow> {
  return apiFetch<ProjectRow>(`/api/v1/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/projects/${id}`, {
    method: "DELETE",
  });
}

export interface DsnKeyRow {
  id: string;
  project_id: string;
  public_key: string;
  label: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreatedDsnKey extends DsnKeyRow {
  secret_key: string;
}

export async function fetchDsnKeys(projectId: string): Promise<DsnKeyRow[]> {
  const body = await apiFetch<{ keys: DsnKeyRow[] }>(
    `/api/v1/projects/${projectId}/dsn-keys`,
  );
  return body.keys;
}

export async function createDsnKey(
  projectId: string,
  label?: string,
  revokeExisting?: boolean,
): Promise<CreatedDsnKey> {
  return apiFetch<CreatedDsnKey>(`/api/v1/projects/${projectId}/dsn-keys`, {
    method: "POST",
    body: JSON.stringify({ label, revoke_existing: revokeExisting }),
  });
}

export async function rotateDsnKeys(
  projectId: string,
  label?: string,
): Promise<CreatedDsnKey> {
  const params = new URLSearchParams();
  if (label) {
    params.set("label", label);
  }
  const suffix = params.toString();
  return apiFetch<CreatedDsnKey>(
    `/api/v1/projects/${projectId}/dsn-keys/rotate${suffix ? `?${suffix}` : ""}`,
    { method: "POST" },
  );
}

export async function revokeDsnKey(id: string): Promise<void> {
  await apiFetch<{ revoked: boolean }>(`/api/v1/dsn-keys/${id}/revoke`, {
    method: "POST",
  });
}

export interface MemberRow {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export async function fetchMembers(): Promise<MemberRow[]> {
  const body = await apiFetch<{ members: MemberRow[] }>("/api/v1/members");
  return body.members;
}

export async function fetchInvitations(): Promise<InvitationRow[]> {
  const body = await apiFetch<{ invitations: InvitationRow[] }>(
    "/api/v1/invitations",
  );
  return body.invitations;
}

export interface CreatedInvitation {
  invitation: InvitationRow;
  invite_token: string;
  message: string;
}

export function inviteSignupUrl(inviteToken: string): string {
  return `${window.location.origin}/login?invite=${encodeURIComponent(inviteToken)}`;
}

export async function createInvitation(
  email: string,
  role: "owner" | "admin" | "member",
): Promise<CreatedInvitation> {
  return apiFetch<CreatedInvitation>("/api/v1/invitations", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function cancelInvitation(id: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/invitations/${id}`, {
    method: "DELETE",
  });
}

export async function updateMemberRole(
  userId: string,
  role: "owner" | "admin" | "member",
): Promise<void> {
  await apiFetch<{ updated: boolean }>(`/api/v1/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(userId: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/members/${userId}`, {
    method: "DELETE",
  });
}

export interface SetupProgress {
  user_id: string;
  org_id: string;
  project_id: string;
  project_named: boolean;
  has_active_key: boolean;
  dsn_copied_at: string | null;
  first_issue_seen_at: string | null;
  completed_at: string | null;
  complete: boolean;
  seeded: boolean;
}

export function setupOnboardingDone(progress: SetupProgress): boolean {
  return progress.complete || progress.seeded || Boolean(progress.first_issue_seen_at);
}

export function setupNeedsWizard(progress: SetupProgress): boolean {
  if (setupOnboardingDone(progress)) {
    return false;
  }
  return !progress.project_named || !progress.has_active_key || !progress.dsn_copied_at;
}

export function setupDsnReady(progress: SetupProgress): boolean {
  return progress.has_active_key && Boolean(progress.dsn_copied_at);
}

export interface HeadlineStats {
  project_id: string;
  environment: string | null;
  unresolved: number;
  events_7d: number;
  regressions: number;
  snoozed: number;
}

export async function fetchSetupProgress(projectId: string): Promise<SetupProgress> {
  return apiFetch<SetupProgress>(
    `/api/v1/setup?project_id=${encodeURIComponent(projectId)}`,
  );
}

export async function patchSetupProgress(input: {
  project_id: string;
  project_named?: boolean;
  dsn_copied?: boolean;
  first_issue_seen?: boolean;
}): Promise<SetupProgress> {
  return apiFetch<SetupProgress>("/api/v1/setup", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface SetupDsnInfo {
  project_id: string;
  dsn_project_id: number;
  public_key: string | null;
  has_active_key: boolean;
}

export async function fetchSetupDsn(projectId: string): Promise<SetupDsnInfo> {
  return apiFetch<SetupDsnInfo>(
    `/api/v1/setup/dsn?project_id=${encodeURIComponent(projectId)}`,
  );
}

export interface SetupTestEventResult {
  event_id: string;
  accepted: boolean;
}

export async function sendSetupTestEvent(
  projectId: string,
): Promise<SetupTestEventResult> {
  return apiFetch<SetupTestEventResult>(
    `/api/v1/setup/test-event?project_id=${encodeURIComponent(projectId)}`,
    { method: "POST" },
  );
}

export async function fetchHeadlineStats(
  projectId: string,
  environment?: string,
  window?: string,
): Promise<HeadlineStats> {
  const params = new URLSearchParams({ project_id: projectId });
  if (environment) {
    params.set("environment", environment);
  }
  if (window) {
    params.set("window", window);
  }
  return apiFetch<HeadlineStats>(`/api/v1/stats?${params.toString()}`);
}

export async function fetchProjectActivity(
  projectId: string,
): Promise<TimelineBucket[]> {
  const body = await apiFetch<{ project_id: string; buckets: TimelineBucket[] }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/activity`,
  );
  return body.buckets;
}

export interface AgentTokenRow {
  id: string;
  org_id: string;
  user_id: string;
  label: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreatedAgentToken {
  id: string;
  label: string;
  token: string;
  token_prefix: string;
  scopes: string[];
  created_at: string;
}

export async function fetchAgentTokens(): Promise<AgentTokenRow[]> {
  const body = await apiFetch<{ tokens: AgentTokenRow[] }>("/api/v1/agent-tokens");
  return body.tokens;
}

export async function createAgentToken(input: {
  label?: string;
  scopes?: string[];
}): Promise<CreatedAgentToken> {
  const body = await apiFetch<{ token: CreatedAgentToken }>("/api/v1/agent-tokens", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.token;
}

export async function revokeAgentToken(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/agent-tokens/${id}/revoke`, { method: "POST" });
}

/** Numeric path segment for Sentry SDK DSN compatibility (not the internal UUID). */
export function dsnPathSegment(project: Pick<ProjectRow, "dsn_project_id">): string {
  return String(project.dsn_project_id);
}

export function formatDsn(publicKey: string, dsnProjectId: number | string): string {
  const host = window.location.host;
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  return `${protocol}://${publicKey}@${host}/${dsnProjectId}`;
}

export interface ConnectedAppRow {
  id: string;
  client_id: string;
  client_name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export async function fetchConnectedApps(): Promise<ConnectedAppRow[]> {
  const body = await apiFetch<{ connected_apps: ConnectedAppRow[] }>("/api/user/connected-apps");
  return body.connected_apps;
}

export async function revokeConnectedApp(id: string): Promise<void> {
  await apiFetch<void>(`/api/user/connected-apps/${id}`, { method: "DELETE" });
}

export interface OAuthInfoOrg {
  id: string;
  name: string;
  role: string;
}

export interface OAuthInfoResponse {
  client_id: string;
  redirect_uri?: string;
  current_org_id: string;
  organizations: OAuthInfoOrg[];
}

export async function fetchOAuthInfo(clientId: string, redirectUri?: string): Promise<OAuthInfoResponse> {
  const params = new URLSearchParams({ client_id: clientId });
  if (redirectUri) {
    params.set("redirect_uri", redirectUri);
  }
  return apiFetch<OAuthInfoResponse>(`/api/oauth/info?${params.toString()}`);
}

export interface OAuthAuthorizePayload {
  client_id: string;
  client_name?: string;
  org_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method?: string;
  scopes?: string[];
  state?: string;
}

export async function submitOAuthAuthorize(payload: OAuthAuthorizePayload): Promise<{ code: string; redirect_uri: string }> {
  return apiFetch<{ code: string; redirect_uri: string }>("/api/oauth/authorize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface DeviceVerifyResponse {
  user_code: string;
  client_name: string;
  scopes: string[];
  status: string;
}

export async function verifyDeviceCode(userCode: string): Promise<DeviceVerifyResponse> {
  return apiFetch<DeviceVerifyResponse>(`/api/oauth/device/verify?user_code=${encodeURIComponent(userCode)}`);
}

export async function approveDeviceCode(userCode: string, orgId: string): Promise<void> {
  await apiFetch<void>("/api/oauth/device/approve", {
    method: "POST",
    body: JSON.stringify({ user_code: userCode, org_id: orgId }),
  });
}

export interface BillingStatus {
  plan_tier: string;
  project_count: number;
  max_projects: number;
  monthly_events_included: number;
  subscription_id: string | null;
  subscription_status: string;
  canary_expires_at: string | null;
}

export async function fetchBillingStatus(): Promise<BillingStatus | null> {
  try {
    return await apiFetch<BillingStatus>("/api/v1/billing/status");
  } catch {
    return null;
  }
}

export interface CreateCheckoutParams {
  plan_tier: string;
  interval?: "monthly" | "annual";
  success_url?: string;
  cancel_url?: string;
}

export interface CheckoutSessionResponse {
  url: string;
  session_id: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutParams,
): Promise<CheckoutSessionResponse> {
  return await apiFetch<CheckoutSessionResponse>("/api/v1/billing/checkout", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function createBillingPortalSession(returnUrl?: string): Promise<{ url: string }> {
  return await apiFetch<{ url: string }>("/api/v1/billing/portal", {
    method: "POST",
    body: JSON.stringify({ return_url: returnUrl }),
  });
}

export async function syncCheckout(checkoutId: string): Promise<BillingStatus> {
  return await apiFetch<BillingStatus>("/api/v1/billing/sync-checkout", {
    method: "POST",
    body: JSON.stringify({ checkout_id: checkoutId }),
  });
}

export interface MonitorItem {
  id: string;
  org_id: string;
  project_id: string;
  slug: string;
  schedule: string | null;
  status: "ok" | "in_progress" | "error" | "missed";
  last_check_in_at: string | null;
  last_duration_ms: number | null;
  environment: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonitorCheckIn {
  id: string;
  monitor_id: string;
  project_id: string;
  org_id: string;
  check_in_id: string | null;
  status: string;
  duration_ms: number | null;
  environment: string | null;
  created_at: string;
}

export interface MonitorDetails {
  monitor: MonitorItem;
  check_ins: MonitorCheckIn[];
}

export async function fetchMonitors(projectId: string): Promise<MonitorItem[]> {
  const res = await apiFetch<{ monitors: MonitorItem[] }>(
    `/api/v1/monitors?project_id=${encodeURIComponent(projectId)}`,
  );
  return res.monitors;
}

export async function fetchMonitorDetails(monitorId: string): Promise<MonitorDetails> {
  return await apiFetch<MonitorDetails>(`/api/v1/monitors/${encodeURIComponent(monitorId)}`);
}

export async function createMonitor(input: {
  project_id: string;
  slug: string;
  schedule?: string;
  environment?: string;
}): Promise<MonitorItem> {
  return await apiFetch<MonitorItem>("/api/v1/monitors", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteMonitor(monitorId: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/monitors/${encodeURIComponent(monitorId)}`, {
    method: "DELETE",
  });
}


