/** Client-only preference: dim / de-emphasize projects on the org home gallery. */

const STORAGE_KEY = "epure.hidden-project-ids";

export function loadHiddenProjectIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function saveHiddenProjectIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function toggleHiddenProjectId(id: string): Set<string> {
  const next = loadHiddenProjectIds();
  if (next.has(id)) next.delete(id);
  else next.add(id);
  saveHiddenProjectIds(next);
  return next;
}
