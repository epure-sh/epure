const STORAGE_PREFIX = "epure.issue-read";

export type IssueReadMap = Record<string, string>;

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}.${projectId}`;
}

export function loadIssueReadMap(projectId: string): IssueReadMap {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as IssueReadMap;
  } catch {
    return {};
  }
}

export function saveIssueReadMap(projectId: string, map: IssueReadMap): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(map));
  } catch {
    // localStorage unavailable
  }
}

export function isIssueUnread(
  issue: { id: string; last_seen_at: string | null },
  readMap: IssueReadMap,
): boolean {
  const viewedAt = readMap[issue.id];
  if (!viewedAt) {
    return true;
  }
  if (!issue.last_seen_at) {
    return false;
  }
  return new Date(issue.last_seen_at).getTime() > new Date(viewedAt).getTime();
}

export function markIssueReadInMap(
  readMap: IssueReadMap,
  issueId: string,
  viewedAt = new Date().toISOString(),
): IssueReadMap {
  return { ...readMap, [issueId]: viewedAt };
}

export function persistIssueRead(
  projectId: string,
  readMap: IssueReadMap,
  issueId: string,
  viewedAt = new Date().toISOString(),
): IssueReadMap {
  const next = markIssueReadInMap(readMap, issueId, viewedAt);
  saveIssueReadMap(projectId, next);
  return next;
}
