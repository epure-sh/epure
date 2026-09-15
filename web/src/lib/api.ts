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

export async function fetchIssues(
  query: string,
  projectId?: string,
  window?: string,
  sort?: string,
): Promise<IssueSummary[]> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  if (projectId) {
    params.set("project_id", projectId);
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

export type SnoozeMode = "hours" | "occurrences" | "users";

export async function snoozeIssue(id: string, mode: SnoozeMode): Promise<IssueSummary> {
  return apiFetch<IssueSummary>(`/api/v1/issues/${id}/snooze`, {
    method: "POST",
    body: JSON.stringify({ mode }),
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
}

export async function fetchAlerts(
  projectId?: string,
  environment?: string,
): Promise<AlertRow[]> {
  const params = new URLSearchParams();
  if (projectId) {
    params.set("project_id", projectId);
  }
  if (environment) {
    params.set("environment", environment);
  }
  const suffix = params.toString();
  const body = await apiFetch<{ alerts: AlertRow[] }>(
    `/api/v1/alerts${suffix ? `?${suffix}` : ""}`,
  );
  return body.alerts;
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
  const body = await apiFetch<{ webhooks: WebhookRow[] }>(
    `/api/v1/webhooks?project_id=${encodeURIComponent(projectId)}`,
  );
  return body.webhooks;
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
  return body.issues;
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
  const body = await apiFetch<{ releases: string[] }>(
    `/api/v1/issues/${issueId}/releases`,
  );
  return body.releases;
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
  const body = await apiFetch<{ releases: ReleaseSummary[] }>(
    `/api/v1/releases?project_id=${encodeURIComponent(projectId)}`,
  );
  return body.releases;
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/webhooks/${id}`, {
    method: "DELETE",
  });
}

export interface MeResponse {
  user_id: string;
  org_id: string;
  email: string;
  display_name: string | null;
  role: string;
  has_password: boolean;
  google_linked: boolean;
}

export interface AuthConfig {
  google_enabled: boolean;
  password_enabled: boolean;
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/v1/auth/me");
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  return apiFetch<AuthConfig>("/api/v1/auth/config");
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
  org_id: string;
  name: string;
  slug: string | null;
  retention_days: number;
  ingest_cap_per_hour: number;
  created_at: string;
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

export async function updateProject(
  id: string,
  input: {
    name?: string;
    retention_days?: number;
    ingest_cap_per_hour?: number;
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
  dsn_copied_at: string | null;
  first_issue_seen_at: string | null;
  completed_at: string | null;
  complete: boolean;
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

export function formatDsn(publicKey: string, projectId: string): string {
  const host = window.location.host;
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  return `${protocol}://${publicKey}@${host}/${projectId}`;
}
