/**
 * Shared inbox “viewed” state for Issues and Alerts (localStorage per project).
 * Read is linked by issue_id: marking an issue read clears unread on its alerts, and vice versa.
 */

export type InboxEntityKind = "issue" | "alert";

export type InboxReadMap = Record<string, string>;

const STORAGE_PREFIX = "epure.inbox-read";
const LEGACY_ISSUE_PREFIX = "epure.issue-read";
const LEGACY_ALERT_PREFIX = "epure.alert-read";

export function inboxEntityKey(kind: InboxEntityKind, id: string): string {
  return `${kind}:${id}`;
}

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}.${projectId}`;
}

function parseLegacyMap(raw: string | null, kind: InboxEntityKind): InboxReadMap {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const out: InboxReadMap = {};
    for (const [id, viewedAt] of Object.entries(parsed as Record<string, string>)) {
      if (typeof viewedAt === "string") {
        out[inboxEntityKey(kind, id)] = viewedAt;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function mergeReadMaps(...maps: InboxReadMap[]): InboxReadMap {
  const merged: InboxReadMap = {};
  for (const map of maps) {
    for (const [key, viewedAt] of Object.entries(map)) {
      const existing = merged[key];
      if (!existing || new Date(viewedAt).getTime() > new Date(existing).getTime()) {
        merged[key] = viewedAt;
      }
    }
  }
  return merged;
}

export function loadInboxReadMap(projectId: string): InboxReadMap {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as InboxReadMap;
      }
    }
  } catch {
    // fall through to migration
  }

  const migrated = mergeReadMaps(
    parseLegacyMap(localStorage.getItem(`${LEGACY_ISSUE_PREFIX}.${projectId}`), "issue"),
    parseLegacyMap(localStorage.getItem(`${LEGACY_ALERT_PREFIX}.${projectId}`), "alert"),
  );

  if (Object.keys(migrated).length > 0) {
    saveInboxReadMap(projectId, migrated);
  }

  return migrated;
}

export function saveInboxReadMap(projectId: string, map: InboxReadMap): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(map));
  } catch {
    // localStorage unavailable
  }
}

function latestViewedAt(...candidates: (string | undefined)[]): string | undefined {
  let best: string | undefined;
  let bestMs = -Infinity;
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const ms = new Date(candidate).getTime();
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms;
      best = candidate;
    }
  }
  return best;
}

function isActivityUnread(activityAt: string | null, viewedAt: string | undefined): boolean {
  if (!viewedAt) {
    return true;
  }
  if (!activityAt) {
    return false;
  }
  return new Date(activityAt).getTime() > new Date(viewedAt).getTime();
}

export function isIssueInboxUnread(
  issue: { id: string; last_seen_at: string | null },
  readMap: InboxReadMap,
): boolean {
  const viewedAt = readMap[inboxEntityKey("issue", issue.id)];
  return isActivityUnread(issue.last_seen_at, viewedAt);
}

export function isAlertInboxUnread(
  alert: Pick<AlertRowShape, "id" | "issue_id" | "fired_at" | "read_at" | "ignored">,
  readMap: InboxReadMap,
): boolean {
  if (alert.ignored || alert.read_at) {
    return false;
  }
  const alertViewed = readMap[inboxEntityKey("alert", alert.id)];
  const issueViewed =
    alert.issue_id != null ? readMap[inboxEntityKey("issue", alert.issue_id)] : undefined;
  const viewedAt = latestViewedAt(alertViewed, issueViewed);
  return isActivityUnread(alert.fired_at, viewedAt);
}

type AlertRowShape = {
  id: string;
  issue_id: string | null;
  fired_at: string;
  read_at: string | null;
  ignored: boolean;
};

export function markInboxReadInMap(
  readMap: InboxReadMap,
  kind: InboxEntityKind,
  id: string,
  viewedAt = new Date().toISOString(),
): InboxReadMap {
  return { ...readMap, [inboxEntityKey(kind, id)]: viewedAt };
}

/** Mark issue read and sync linked alert keys when provided. */
export function markIssueReadInMap(
  readMap: InboxReadMap,
  issueId: string,
  viewedAt = new Date().toISOString(),
  linkedAlertIds: string[] = [],
): InboxReadMap {
  let next = markInboxReadInMap(readMap, "issue", issueId, viewedAt);
  for (const alertId of linkedAlertIds) {
    next = markInboxReadInMap(next, "alert", alertId, viewedAt);
  }
  return next;
}

/** Mark alert read; also marks linked issue read at the same timestamp. */
export function markAlertReadInMap(
  readMap: InboxReadMap,
  alertId: string,
  viewedAt = new Date().toISOString(),
  linkedIssueId: string | null = null,
): InboxReadMap {
  let next = markInboxReadInMap(readMap, "alert", alertId, viewedAt);
  if (linkedIssueId) {
    next = markInboxReadInMap(next, "issue", linkedIssueId, viewedAt);
  }
  return next;
}

export function persistInboxReadMap(projectId: string, map: InboxReadMap): void {
  saveInboxReadMap(projectId, map);
}

export function persistIssueInboxRead(
  projectId: string,
  readMap: InboxReadMap,
  issueId: string,
  viewedAt = new Date().toISOString(),
  linkedAlertIds: string[] = [],
): InboxReadMap {
  const next = markIssueReadInMap(readMap, issueId, viewedAt, linkedAlertIds);
  saveInboxReadMap(projectId, next);
  return next;
}

export function persistAlertInboxRead(
  projectId: string,
  readMap: InboxReadMap,
  alertId: string,
  viewedAt = new Date().toISOString(),
  linkedIssueId: string | null = null,
): InboxReadMap {
  const next = markAlertReadInMap(readMap, alertId, viewedAt, linkedIssueId);
  saveInboxReadMap(projectId, next);
  return next;
}
