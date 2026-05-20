import { applyOptimisticSnooze } from "../src/features/issues/issue-triage-utils";
import { parseQuery } from "../src/features/issues/query-utils";
import type {
  AlertRow,
  AlertRuleRow,
  CreatedDsnKey,
  EventDetail,
  EventsPage,
  DsnKeyRow,
  InvitationRow,
  IssueSummary,
  MemberRow,
  ProjectRow,
  SetupProgress,
  SnoozeMode,
  CreatedWebhook,
  WebhookRow,
} from "../src/lib/api";
import {
  alerts,
  buildEvents,
  buildIssues,
  dsnKeys,
  invitations,
  me,
  members,
  projects,
  releases,
  setupProgress,
  setupProgressPending,
  webhooks,
} from "./fixtures/seed";

type MockIssue = IssueSummary & { merge_parent_id?: string };

interface MockStore {
  issues: MockIssue[];
  events: EventDetail[];
  setup: SetupProgress;
  webhooks: WebhookRow[];
  alerts: AlertRow[];
  alertRules: AlertRuleRow[];
  mergeParents: Map<string, string[]>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseUrl(input: string): URL {
  return new URL(input, window.location.origin);
}

function filterIssues(
  rows: MockIssue[],
  query: string,
  projectId?: string | null,
): MockIssue[] {
  const parsed = parseQuery(query);
  let filtered = rows.filter((issue) => issue.merge_parent_id == null);

  if (projectId) {
    filtered = filtered.filter((issue) => issue.project_id === projectId);
  }
  if (parsed.status === "snoozed") {
    filtered = filtered.filter((issue) => issue.snoozed);
  } else if (parsed.status) {
    filtered = filtered.filter((issue) => issue.status === parsed.status && !issue.snoozed);
  }
  if (parsed.environment) {
    filtered = filtered.filter((issue) => issue.environment === parsed.environment);
  }
  if (parsed.level) {
    filtered = filtered.filter((issue) => issue.level === parsed.level);
  }
  if (parsed.release) {
    filtered = filtered.filter((issue) => issue.release === parsed.release);
  }
  if (parsed.freeText) {
    const needle = parsed.freeText.toLowerCase();
    filtered = filtered.filter((issue) =>
      (issue.title ?? "").toLowerCase().includes(needle),
    );
  }

  return filtered.sort((left, right) => {
    const leftTime = left.last_seen_at ? Date.parse(left.last_seen_at) : 0;
    const rightTime = right.last_seen_at ? Date.parse(right.last_seen_at) : 0;
    return rightTime - leftTime;
  });
}

let store: MockStore = createStore();
let teamMembers: MemberRow[] = clone(members);
let teamInvitations: InvitationRow[] = clone(invitations);
let mockProjects: ProjectRow[] = clone(projects);
let mockDsnKeys: DsnKeyRow[] = clone(dsnKeys);
let setupByProject = new Map<string, SetupProgress>();

function blankSetup(projectId: string): SetupProgress {
  return {
    user_id: me.user_id,
    org_id: me.org_id,
    project_id: projectId,
    project_named: false,
    has_active_key: false,
    dsn_copied_at: null,
    first_issue_seen_at: null,
    completed_at: null,
    complete: false,
    seeded: false,
  };
}

function getSetup(projectId: string): SetupProgress {
  const existing = setupByProject.get(projectId);
  if (existing) {
    return existing;
  }
  if (projectId === setupProgress.project_id) {
    const seeded = clone(setupProgress);
    setupByProject.set(projectId, seeded);
    return seeded;
  }
  if (projectId === setupProgressPending.project_id) {
    const pending = clone(setupProgressPending);
    setupByProject.set(projectId, pending);
    return pending;
  }
  const created = blankSetup(projectId);
  setupByProject.set(projectId, created);
  return created;
}

function createStore(): MockStore {
  return {
    issues: clone(buildIssues()),
    events: clone(buildEvents()),
    setup: clone(setupProgress),
    webhooks: clone(webhooks),
    alerts: clone(alerts),
    alertRules: [],
    mergeParents: new Map(),
  };
}

function resetStore(): void {
  store = createStore();
  teamMembers = clone(members);
  teamInvitations = clone(invitations);
  mockProjects = clone(projects);
  mockDsnKeys = clone(dsnKeys);
  setupByProject = new Map();
  setupByProject.set(setupProgress.project_id, clone(setupProgress));
  setupByProject.set(setupProgressPending.project_id, clone(setupProgressPending));
}

function issueById(id: string): MockIssue | undefined {
  return store.issues.find((issue) => issue.id === id);
}

function storedEventsForIssue(issueId: string, release?: string | null): EventDetail[] {
  return store.events
    .filter((event) => event.issue_id === issueId)
    .filter((event) => !release || event.release === release)
    .sort(
      (left, right) =>
        Date.parse(right.occurred_at) - Date.parse(left.occurred_at),
    );
}

function syntheticEvent(
  template: EventDetail,
  issueId: string,
  index: number,
): EventDetail {
  const hoursAgo = index + 1;
  return {
    ...template,
    id: `e${issueId.replace(/-/g, "").slice(0, 8)}${String(index).padStart(8, "0")}`,
    occurred_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
    user_email: `user${index % 24}@acme-corp.com`,
    user_id: `usr_${index.toString(16).padStart(6, "0")}`,
  };
}

function paginateIssueEvents(
  issueId: string,
  limit: number,
  offset: number,
  release?: string | null,
): EventsPage {
  const issue = issueById(issueId);
  const stored = storedEventsForIssue(issueId, release);
  const total = issue?.event_count ?? stored.length;
  const template = stored[0];

  if (!template || total === 0) {
    return { events: [], total: 0, has_more: false };
  }

  const events: EventDetail[] = [];
  const end = Math.min(offset + limit, total);
  for (let index = offset; index < end; index += 1) {
    events.push(
      index < stored.length
        ? stored[index]
        : syntheticEvent(template, issueId, index),
    );
  }

  return {
    events,
    total,
    has_more: end < total,
  };
}

function windowToMs(window: string | null | undefined): number {
  switch (window) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "14d":
      return 14 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    case "90d":
      return 90 * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

function computeStats(projectId: string, environment?: string, window?: string | null) {
  const issues = store.issues.filter((issue) => issue.project_id === projectId);
  const scopedIssues = environment
    ? issues.filter((issue) => issue.environment === environment)
    : issues;
  const windowMs = windowToMs(window);
  const events = store.events.filter((event) => {
    const issue = issues.find((row) => row.id === event.issue_id);
    if (!issue) {
      return false;
    }
    if (environment && event.environment !== environment) {
      return false;
    }
    const ageMs = Date.now() - new Date(event.occurred_at).getTime();
    return ageMs <= windowMs;
  });

  return {
    project_id: projectId,
    environment: environment ?? null,
    unresolved: scopedIssues.filter(
      (issue) => issue.status === "unresolved" && !issue.merge_parent_id && !issue.snoozed,
    ).length,
    events_7d: events.length,
    regressions: scopedIssues.filter(
      (issue) => issue.status === "regression" && !issue.snoozed,
    ).length,
    snoozed: scopedIssues.filter((issue) => issue.snoozed).length,
  };
}

function handleGet(path: string, url: URL): Response {
  if (path === "/api/v1/auth/me") {
    return jsonResponse(me);
  }

  if (path === "/api/v1/auth/config") {
    return jsonResponse({ google_enabled: false, password_enabled: true });
  }

  if (path === "/api/v1/projects") {
    return jsonResponse({
      projects: mockProjects.map((project) => ({ ...project, role: me.role })),
    });
  }

  const projectActivity = path.match(/^\/api\/v1\/projects\/([^/]+)\/activity$/);
  if (projectActivity) {
    const projectId = projectActivity[1];
    if (!mockProjects.some((project) => project.id === projectId)) {
      return jsonResponse({ error: "not_found" }, 404);
    }
    const bucketCount = 30;
    const bucketMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const dayStarts = Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(now - (bucketCount - 1 - index) * bucketMs);
      start.setUTCHours(0, 0, 0, 0);
      return start;
    });
    const projectEvents = store.events.filter((event) => {
      const issue = issueById(event.issue_id);
      return issue?.project_id === projectId;
    });
    const projectIssues = store.issues.filter((issue) => issue.project_id === projectId);
    const realCounts = dayStarts.map((start) => {
      const end = start.getTime() + bucketMs;
      return projectEvents.filter((event) => {
        const at = new Date(event.occurred_at).getTime();
        return at >= start.getTime() && at < end;
      }).length;
    });
    const realTotal = realCounts.reduce((sum, count) => sum + count, 0);
    const eventTarget = projectIssues.reduce((sum, issue) => sum + issue.event_count, 0);
    let counts = realCounts;
    if (eventTarget > realTotal) {
      const first = Math.min(
        ...projectIssues.map((issue) => new Date(issue.first_seen_at ?? dayStarts[0]).getTime()),
      );
      const last = Math.max(
        ...projectIssues.map((issue) => new Date(issue.last_seen_at ?? dayStarts[bucketCount - 1]).getTime()),
      );
      const span = Math.max(last - first, bucketMs);
      const seed = projectId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const weights = dayStarts.map((start, index) => {
        const mid = start.getTime() + bucketMs / 2;
        if (mid < first || mid > last + bucketMs) {
          return 0;
        }
        const recency = (mid - first) / span;
        const wave = 0.7 + 0.2 * Math.sin(index * 0.55 + seed * 0.11);
        return wave * (0.55 + 0.55 * recency * recency);
      });
      const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
      if (weightSum > 0) {
        const target = Math.min(eventTarget, 10_000);
        counts = weights.map((weight, index) =>
          Math.max(realCounts[index], Math.round((weight / weightSum) * target)),
        );
      }
    }
    return jsonResponse({
      project_id: projectId,
      buckets: dayStarts.map((start, index) => ({
        start: start.toISOString(),
        count: counts[index],
      })),
    });
  }

  if (path === "/api/v1/issues") {
    const query = url.searchParams.get("q") ?? "";
    const projectId = url.searchParams.get("project_id");
    const issues = filterIssues(store.issues, query, projectId);
    return jsonResponse({ issues });
  }

  if (path === "/api/v1/alerts") {
    const projectId = url.searchParams.get("project_id");
    const environment = url.searchParams.get("environment");
    const view = url.searchParams.get("view") ?? "all";
    let rows = store.alerts;
    if (projectId) {
      rows = rows.filter((row) => row.project_id === projectId);
    }
    if (environment) {
      rows = rows.filter((row) => {
        const issue = issueById(row.issue_id ?? "");
        return issue?.environment === environment;
      });
    }
    if (view === "unread") {
      rows = rows.filter((row) => !row.read_at && !row.ignored);
    } else if (view === "ignored") {
      rows = rows.filter((row) => row.ignored);
    }
    return jsonResponse({ alerts: rows });
  }

  if (path === "/api/v1/alert-rules") {
    const projectId = url.searchParams.get("project_id") ?? "";
    return jsonResponse({
      rules: store.alertRules.filter((row) => row.project_id === projectId),
    });
  }

  if (path === "/api/v1/webhooks") {
    const projectId = url.searchParams.get("project_id") ?? "";
    return jsonResponse({
      webhooks: store.webhooks.filter((row) => row.project_id === projectId),
    });
  }

  if (path === "/api/v1/members") {
    return jsonResponse({ members: teamMembers });
  }

  if (path === "/api/v1/invitations") {
    return jsonResponse({ invitations: teamInvitations });
  }

  if (path === "/api/v1/setup") {
    const projectId = url.searchParams.get("project_id") ?? setupProgress.project_id;
    return jsonResponse(getSetup(projectId));
  }

  if (path === "/api/v1/setup/dsn") {
    const projectId = url.searchParams.get("project_id") ?? setupProgress.project_id;
    const keys = mockDsnKeys.filter((row) => row.project_id === projectId && !row.revoked_at);
    const active = keys[0];
    return jsonResponse({
      project_id: projectId,
      has_active_key: Boolean(active),
      public_key: active?.public_key ?? null,
    });
  }

  if (path === "/api/v1/stats") {
    const projectId = url.searchParams.get("project_id") ?? projects[0].id;
    const environment = url.searchParams.get("environment") ?? undefined;
    const window = url.searchParams.get("window");
    return jsonResponse(computeStats(projectId, environment, window));
  }

  const issueEvents = path.match(/^\/api\/v1\/issues\/([^/]+)\/events$/);
  if (issueEvents) {
    const issueId = issueEvents[1];
    const release = url.searchParams.get("release");
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;
    return jsonResponse(
      paginateIssueEvents(issueId, safeLimit, safeOffset, release),
    );
  }

  const issueReleases = path.match(/^\/api\/v1\/issues\/([^/]+)\/releases$/);
  if (issueReleases) {
    const issueId = issueReleases[1];
    const versions = [
      ...new Set(
        store.events
          .filter((event) => event.issue_id === issueId && event.release)
          .map((event) => event.release as string),
      ),
    ];
    return jsonResponse({ releases: versions });
  }

  const issueTimeline = path.match(/^\/api\/v1\/issues\/([^/]+)\/timeline$/);
  if (issueTimeline) {
    const issueId = issueTimeline[1];
    const issue = issueById(issueId);
    if (!issue) {
      return jsonResponse({ error: "not found" }, 404);
    }
    const issueEvents = store.events.filter((event) => event.issue_id === issueId);
    const now = Date.now();
    const window = url.searchParams.get("window") ?? "7d";
    const windowDays = window === "30d" ? 30 : window === "14d" ? 14 : 7;
    const bucketHours = windowDays <= 7 ? 1 : 24;
    const bucketCount = windowDays <= 7 ? windowDays * 24 : windowDays;
    const spanMs = windowDays * 24 * 60 * 60 * 1000;

    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketMs = bucketHours * 60 * 60 * 1000;
      const start = new Date(now - (bucketCount - 1 - index) * bucketMs);
      if (bucketHours >= 24) {
        start.setHours(0, 0, 0, 0);
      } else {
        start.setMinutes(0, 0, 0);
      }
      const end = start.getTime() + bucketMs;
      let count = issueEvents.filter((event) => {
        const at = new Date(event.occurred_at).getTime();
        return at >= start.getTime() && at < end;
      }).length;

      if (count === 0 && issue.event_count > 0) {
        const hash = issueId
          .split("")
          .reduce((sum, char, charIndex) => sum + char.charCodeAt(0) * (charIndex + 1), 0);
        const wave = Math.sin((index + hash % 7) * 0.5) * 0.35 + 0.65;
        const scale = Math.max(1, Math.log10(issue.event_count + 1));
        count = Math.max(
          0,
          Math.round(scale * wave * (2 + (hash % 5)) * (index > bucketCount * 0.7 ? 1.3 : 1)),
        );
      }

      return { start: start.toISOString(), count };
    });

    const within = (hours: number) =>
      issueEvents.filter(
        (event) => now - new Date(event.occurred_at).getTime() <= hours * 60 * 60 * 1000,
      ).length;
    const withinWindow = issueEvents.filter(
      (event) => now - new Date(event.occurred_at).getTime() <= spanMs,
    ).length;

    return jsonResponse({
      issue_id: issueId,
      event_count: issue.event_count,
      stored_event_count: issueEvents.length,
      buckets,
      summary: {
        last_1h: within(1),
        last_24h: within(24),
        last_7d: windowDays >= 7 ? withinWindow : within(24 * 7),
      },
    });
  }

  const mergedChildren = path.match(/^\/api\/v1\/issues\/([^/]+)\/merged$/);
  if (mergedChildren) {
    const issueId = mergedChildren[1];
    const childIds = store.mergeParents.get(issueId) ?? [];
    return jsonResponse({
      issues: store.issues.filter((issue) => childIds.includes(issue.id)),
    });
  }

  const dsnKeysRoute = path.match(/^\/api\/v1\/projects\/([^/]+)\/dsn-keys$/);
  if (dsnKeysRoute) {
    const projectId = dsnKeysRoute[1];
    return jsonResponse({
      keys: mockDsnKeys.filter((key) => key.project_id === projectId),
    });
  }

  if (path === "/api/v1/releases") {
    const projectId = url.searchParams.get("project_id") ?? "";
    return jsonResponse({
      releases: releases.filter((row) => row.project_id === projectId),
    });
  }

  return jsonResponse({ error: "not found" }, 404);
}

async function handlePatch(path: string, init: RequestInit): Promise<Response> {
  const body = init.body ? JSON.parse(String(init.body)) : {};

  const alertMatch = path.match(/^\/api\/v1\/alerts\/([^/]+)$/);
  if (alertMatch) {
    const alert = store.alerts.find((row) => row.id === alertMatch[1]);
    if (!alert) {
      return jsonResponse({ error: "not found" }, 404);
    }
    if (body.read === true) {
      alert.read_at = new Date().toISOString();
    } else if (body.read === false) {
      alert.read_at = null;
    }
    if (typeof body.ignored === "boolean") {
      alert.ignored = body.ignored;
      if (body.ignored) {
        alert.read_at = alert.read_at ?? new Date().toISOString();
      }
    }
    return jsonResponse(alert);
  }

  const webhookMatch = path.match(/^\/api\/v1\/webhooks\/([^/]+)$/);
  if (webhookMatch) {
    const hook = store.webhooks.find((row) => row.id === webhookMatch[1]);
    if (!hook) {
      return jsonResponse({ error: "not found" }, 404);
    }
    if (Array.isArray(body.events) && body.events.length > 0) {
      hook.events = body.events;
    }
    return jsonResponse(hook);
  }

  const ruleMatch = path.match(/^\/api\/v1\/alert-rules\/([^/]+)$/);
  if (ruleMatch) {
    const rule = store.alertRules.find((row) => row.id === ruleMatch[1]);
    if (!rule) {
      return jsonResponse({ error: "not found" }, 404);
    }
    if (typeof body.name === "string") {
      rule.name = body.name;
    }
    if (typeof body.enabled === "boolean") {
      rule.enabled = body.enabled;
    }
    if (body.environment !== undefined) {
      rule.environment = body.environment;
    }
    if (body.threshold !== undefined) {
      rule.threshold = body.threshold;
    }
    return jsonResponse(rule);
  }

  if (path === "/api/v1/setup") {
    const projectId =
      typeof body.project_id === "string" && body.project_id
        ? body.project_id
        : setupProgress.project_id;
    const progress = getSetup(projectId);
    if (body.project_named) {
      progress.project_named = true;
    }
    if (body.dsn_copied) {
      const hasKey = mockDsnKeys.some(
        (row) => row.project_id === projectId && !row.revoked_at,
      );
      if (hasKey) {
        progress.has_active_key = true;
        progress.dsn_copied_at = new Date().toISOString();
      } else {
        return jsonResponse({ error: "no active dsn key" }, 404);
      }
    }
    if (body.first_issue_seen) {
      progress.first_issue_seen_at = new Date().toISOString();
      progress.completed_at = new Date().toISOString();
      progress.complete = true;
    }
    store.setup = progress;
    return jsonResponse(progress);
  }

  const bulkMatch = path.match(/^\/api\/v1\/issues\/bulk$/);
  if (bulkMatch) {
    const ids = (body.ids ?? []) as string[];
    const action = body.action as string;
    let updated = 0;
    for (const id of ids) {
      const issue = issueById(id);
      if (!issue) {
        continue;
      }
      if (action === "delete") {
        store.issues = store.issues.filter((row) => row.id !== id);
        store.events = store.events.filter((event) => event.issue_id !== id);
      } else if (action === "resolve") {
        issue.status = "resolved";
      } else if (action === "ignore") {
        issue.status = "ignored";
      } else if (action === "reopen") {
        issue.status = "unresolved";
      }
      updated += 1;
    }
    return jsonResponse({ updated });
  }

  const projectMatch = path.match(/^\/api\/v1\/projects\/([^/]+)$/);
  if (projectMatch) {
    const project = mockProjects.find((row) => row.id === projectMatch[1]);
    if (!project) {
      return jsonResponse({ error: "not found" }, 404);
    }
    if (body.name !== undefined) {
      project.name = body.name;
    }
    if (body.retention_days !== undefined) {
      project.retention_days = body.retention_days;
    }
    if (body.ingest_cap_per_hour !== undefined) {
      project.ingest_cap_per_hour = body.ingest_cap_per_hour;
    }
    return jsonResponse(project);
  }

  const memberMatch = path.match(/^\/api\/v1\/members\/([^/]+)$/);
  if (memberMatch) {
    const userId = memberMatch[1];
    const member = teamMembers.find((row) => row.user_id === userId);
    if (!member) {
      return jsonResponse({ error: "not found" }, 404);
    }
    member.role = body.role;
    return jsonResponse({ updated: true });
  }

  const issueMatch = path.match(/^\/api\/v1\/issues\/([^/]+)$/);
  if (issueMatch) {
    const issue = issueById(issueMatch[1]);
    if (!issue) {
      return jsonResponse({ error: "not found" }, 404);
    }
    if (body.status) {
      issue.status = body.status;
    }
    return jsonResponse(issue);
  }

  return jsonResponse({ error: "not found" }, 404);
}

async function handlePost(path: string, init: RequestInit, url: URL): Promise<Response> {
  const body = init.body ? JSON.parse(String(init.body)) : {};

  if (path === "/api/v1/auth/logout") {
    return new Response(null, { status: 204 });
  }

  if (path === "/api/v1/setup/test-event") {
    const projectId = url.searchParams.get("project_id") ?? store.setup.project_id;
    const hasKey = mockDsnKeys.some((row) => row.project_id === projectId && !row.revoked_at);
    if (!hasKey) {
      return jsonResponse({ error: "dsn key required" }, 400);
    }
    if (store.setup.dsn_copied_at) {
      store.setup.first_issue_seen_at = new Date().toISOString();
      store.setup.completed_at = new Date().toISOString();
      store.setup.complete = true;
    }
    return jsonResponse({ event_id: crypto.randomUUID(), accepted: true }, 202);
  }

  const snoozeMatch = path.match(/^\/api\/v1\/issues\/([^/]+)\/snooze$/);
  if (snoozeMatch) {
    const issue = issueById(snoozeMatch[1]);
    if (!issue) {
      return jsonResponse({ error: "not found" }, 404);
    }
    const mode = (body.mode ?? "hours") as SnoozeMode;
    const updated = applyOptimisticSnooze(issue, mode);
    Object.assign(issue, updated);
    return jsonResponse(issue);
  }

  if (path === "/api/v1/issues/trends") {
    const issueIds = (body.issue_ids ?? []) as string[];
    const bucketCount = 30;
    const bucketMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const dayStarts = Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(now - (bucketCount - 1 - index) * bucketMs);
      start.setUTCHours(0, 0, 0, 0);
      return start;
    });

    const trends = issueIds.map((issueId) => {
      const issue = issueById(issueId);
      const issueEvents = store.events.filter((event) => event.issue_id === issueId);
      const realCounts = dayStarts.map((start) => {
        const end = start.getTime() + bucketMs;
        return issueEvents.filter((event) => {
          const at = new Date(event.occurred_at).getTime();
          return at >= start.getTime() && at < end;
        }).length;
      });
      const realTotal = realCounts.reduce((sum, count) => sum + count, 0);

      // Playground stores few event rows; synthesize a mild 30d series with
      // day-to-day wobble (avoid a hard rising lean that hides variation).
      let counts = realCounts;
      if (issue && issue.event_count > realTotal) {
        const first = new Date(issue.first_seen_at ?? dayStarts[0].toISOString()).getTime();
        const last = new Date(
          issue.last_seen_at ?? dayStarts[bucketCount - 1].toISOString(),
        ).getTime();
        const span = Math.max(last - first, bucketMs);
        const seed = issueId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const weights = dayStarts.map((start, index) => {
          const mid = start.getTime() + bucketMs / 2;
          if (mid < first || mid > last + bucketMs) {
            return 0;
          }
          const recency = (mid - first) / span;
          const wave = 0.55 + 0.35 * Math.sin(index * 0.85 + seed * 0.17);
          const pulse = 0.75 + 0.45 * Math.sin(index * 1.7 + seed * 0.31);
          // Mild recency tilt only — keep most of the amplitude for variation.
          return wave * pulse * (0.88 + 0.22 * recency);
        });
        const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
        if (weightSum > 0) {
          const target = Math.min(issue.event_count, 10_000);
          counts = weights.map((weight, index) => {
            const share = Math.round((weight / weightSum) * target);
            return Math.max(realCounts[index], share);
          });
        }
      }

      return {
        issue_id: issueId,
        buckets: dayStarts.map((start, index) => ({
          start: start.toISOString(),
          count: counts[index],
        })),
      };
    });
    return jsonResponse({ trends });
  }

  if (path === "/api/v1/issues/merge") {
    const canonicalId = body.canonical_id as string;
    const mergeIds = (body.merge_ids ?? []) as string[];
    for (const id of mergeIds) {
      const issue = issueById(id);
      if (issue) {
        issue.merge_parent_id = canonicalId;
        issue.status = "ignored";
      }
    }
    const existing = store.mergeParents.get(canonicalId) ?? [];
    store.mergeParents.set(canonicalId, [...existing, ...mergeIds]);
    return jsonResponse({ updated: mergeIds.length });
  }

  if (path === "/api/v1/issues/split") {
    const splitIds = (body.split_ids ?? []) as string[];
    for (const id of splitIds) {
      const issue = issueById(id);
      if (issue) {
        issue.merge_parent_id = undefined;
        issue.status = "unresolved";
      }
    }
    return jsonResponse({ updated: splitIds.length });
  }

  if (path === "/api/v1/alert-rules") {
    const created: AlertRuleRow = {
      id: crypto.randomUUID(),
      org_id: "11111111-1111-1111-1111-111111111111",
      project_id: body.project_id,
      name: body.name,
      enabled: body.enabled ?? true,
      kind: body.kind,
      environment: body.environment ?? null,
      threshold: body.threshold ?? null,
      created_at: new Date().toISOString(),
    };
    store.alertRules.push(created);
    return jsonResponse(created, 201);
  }

  if (path === "/api/v1/webhooks") {
    const secretHex = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const created: CreatedWebhook = {
      id: crypto.randomUUID(),
      project_id: body.project_id,
      url: body.url,
      format: body.format,
      events: body.events ?? ["issue_created", "regression"],
      secret_prefix: `whsec_${secretHex.slice(0, 8)}`,
      signing_secret: `whsec_${secretHex}`,
      created_at: new Date().toISOString(),
    };
    store.webhooks.push(created);
    return jsonResponse(created, 201);
  }

  const webhookTestMatch = path.match(/^\/api\/v1\/webhooks\/([^/]+)\/test$/);
  if (webhookTestMatch) {
    return jsonResponse({ sent: true });
  }

  const webhookRotateMatch = path.match(/^\/api\/v1\/webhooks\/([^/]+)\/rotate-secret$/);
  if (webhookRotateMatch) {
    const existing = store.webhooks.find((row) => row.id === webhookRotateMatch[1]);
    if (!existing) {
      return jsonResponse({ error: "not found" }, 404);
    }
    const secretHex = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const rotated: CreatedWebhook = {
      ...existing,
      secret_prefix: `whsec_${secretHex.slice(0, 8)}`,
      signing_secret: `whsec_${secretHex}`,
    };
    store.webhooks = store.webhooks.map((row) =>
      row.id === rotated.id ? { ...row, secret_prefix: rotated.secret_prefix } : row,
    );
    return jsonResponse(rotated);
  }

  const dsnKeysRoute = path.match(/^\/api\/v1\/projects\/([^/]+)\/dsn-keys$/);
  if (dsnKeysRoute) {
    const created: CreatedDsnKey = {
      id: crypto.randomUUID(),
      project_id: dsnKeysRoute[1],
      public_key: crypto.randomUUID().replace(/-/g, "").slice(0, 20),
      label: body.label ?? "New key",
      revoked_at: null,
      created_at: new Date().toISOString(),
      secret_key: "playground-secret-key",
    };
    mockDsnKeys = [...mockDsnKeys, created];
    const progress = getSetup(created.project_id);
    progress.has_active_key = true;
    return jsonResponse(created, 201);
  }

  const rotateRoute = path.match(/^\/api\/v1\/projects\/([^/]+)\/dsn-keys\/rotate$/);
  if (rotateRoute) {
    const created: CreatedDsnKey = {
      id: crypto.randomUUID(),
      project_id: rotateRoute[1],
      public_key: crypto.randomUUID().replace(/-/g, "").slice(0, 20),
      label: "Rotated key",
      revoked_at: null,
      created_at: new Date().toISOString(),
      secret_key: "playground-secret-key",
    };
    mockDsnKeys = mockDsnKeys.map((row) =>
      row.project_id === created.project_id && !row.revoked_at
        ? { ...row, revoked_at: new Date().toISOString() }
        : row,
    );
    mockDsnKeys = [...mockDsnKeys, created];
    return jsonResponse(created, 201);
  }

  const revokeRoute = path.match(/^\/api\/v1\/dsn-keys\/([^/]+)\/revoke$/);
  if (revokeRoute) {
    return jsonResponse({ revoked: true });
  }

  if (path === "/api/v1/projects") {
    const name = String(body.name ?? "New project").trim() || "New project";
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    const created: ProjectRow = {
      id: crypto.randomUUID(),
      org_id: projects[0].org_id,
      name,
      slug: slug || "project",
      retention_days: 30,
      ingest_cap_per_hour: 5000,
      is_demo: false,
      created_at: new Date().toISOString(),
      role: me.role,
    };
    mockProjects = [...mockProjects, created];
    setupByProject.set(created.id, blankSetup(created.id));
    return jsonResponse(created, 201);
  }

  if (path === "/api/v1/invitations") {
    const invitation: InvitationRow = {
      id: crypto.randomUUID(),
      email: body.email,
      role: body.role,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_at: new Date().toISOString(),
    };
    const inviteToken = crypto.randomUUID().replace(/-/g, "");
    teamInvitations = [invitation, ...teamInvitations];
    return jsonResponse({
      invitation,
      invite_token: inviteToken,
      message: "Invitation sent (playground mock)",
    }, 201);
  }

  return jsonResponse({ error: "not found" }, 404);
}

async function handleDelete(path: string, init: RequestInit): Promise<Response> {
  const body = init.body ? JSON.parse(String(init.body)) : {};

  const bulkMatch = path.match(/^\/api\/v1\/issues\/bulk$/);
  if (bulkMatch) {
    const ids = (body.ids ?? []) as string[];
    let updated = 0;
    for (const id of ids) {
      store.issues = store.issues.filter((row) => row.id !== id);
      store.events = store.events.filter((event) => event.issue_id !== id);
      updated += 1;
    }
    return jsonResponse({ updated });
  }

  const webhookMatch = path.match(/^\/api\/v1\/webhooks\/([^/]+)$/);
  if (webhookMatch) {
    store.webhooks = store.webhooks.filter((row) => row.id !== webhookMatch[1]);
    return jsonResponse({ deleted: true });
  }

  const alertRuleMatch = path.match(/^\/api\/v1\/alert-rules\/([^/]+)$/);
  if (alertRuleMatch) {
    store.alertRules = store.alertRules.filter((row) => row.id !== alertRuleMatch[1]);
    return jsonResponse({ deleted: true });
  }

  const invitationMatch = path.match(/^\/api\/v1\/invitations\/([^/]+)$/);
  if (invitationMatch) {
    teamInvitations = teamInvitations.filter((row) => row.id !== invitationMatch[1]);
    return jsonResponse({ deleted: true });
  }

  const memberMatch = path.match(/^\/api\/v1\/members\/([^/]+)$/);
  if (memberMatch) {
    teamMembers = teamMembers.filter((row) => row.user_id !== memberMatch[1]);
    return jsonResponse({ deleted: true });
  }

  const projectMatch = path.match(/^\/api\/v1\/projects\/([^/]+)$/);
  if (projectMatch) {
    return jsonResponse({ deleted: true });
  }

  return jsonResponse({ error: "not found" }, 404);
}

async function mockFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = parseUrl(String(input));
  if (!url.pathname.startsWith("/api/")) {
    return nativeFetch(input, init);
  }

  const method = (init?.method ?? "GET").toUpperCase();

  if (method === "GET") {
    return handleGet(url.pathname, url);
  }
  if (method === "PATCH") {
    return handlePatch(url.pathname, init ?? {});
  }
  if (method === "POST") {
    return handlePost(url.pathname, init ?? {}, url);
  }
  if (method === "DELETE") {
    return handleDelete(url.pathname, init ?? {});
  }

  return jsonResponse({ error: "method not allowed" }, 405);
}

const nativeFetch = window.fetch.bind(window);

export function installMockApi(): void {
  window.fetch = mockFetch as typeof fetch;
  setupByProject.set(setupProgress.project_id, clone(setupProgress));
  setupByProject.set(setupProgressPending.project_id, clone(setupProgressPending));
  (window as Window & {
    __EPURE_PLAYGROUND__?: {
      reset: () => void;
      openSetup: () => string;
    };
  }).__EPURE_PLAYGROUND__ = {
    reset: resetStore,
    openSetup: () => {
      const path = `/?setup=${setupProgressPending.project_id}`;
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return path;
    },
  };
}

export function isPlayground(): boolean {
  return true;
}
