import { parseTimeWindow, type TimeWindowValue } from "@/lib/time-window";
import { projectSegmentFromPath } from "@/lib/paths";
import {
  ALL_QUERY,
  DEFAULT_ISSUE_SORT,
  DEFAULT_TIME_WINDOW,
  parseIssueSort,
  type IssueSortValue,
} from "./query-utils";

export type ProjectFeedQueryState = {
  q: string;
  window: TimeWindowValue;
  sort: IssueSortValue;
};

export function feedQueryStorageKey(projectId: string): string {
  return `epure:project-feed-query:${projectId}`;
}

/** Persist feed filters per project (survives Issues ↔ Alerts navigation and refresh). */
export function readStoredFeedQuery(projectId: string | null | undefined): ProjectFeedQueryState | null {
  if (!projectId) {
    return null;
  }
  try {
    const raw = localStorage.getItem(feedQueryStorageKey(projectId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ProjectFeedQueryState>;
    return {
      q: typeof parsed.q === "string" ? parsed.q : ALL_QUERY,
      window: parseTimeWindow(parsed.window ?? null),
      sort: parseIssueSort(parsed.sort),
    };
  } catch {
    return null;
  }
}

export function writeStoredFeedQuery(
  projectId: string | null | undefined,
  state: ProjectFeedQueryState,
): void {
  if (!projectId) {
    return;
  }
  try {
    localStorage.setItem(feedQueryStorageKey(projectId), JSON.stringify(state));
  } catch {
    // localStorage unavailable
  }
}

export function feedQueryFromSearchParams(params: URLSearchParams): ProjectFeedQueryState {
  const urlQ = params.get("q");
  return {
    q: urlQ === null ? ALL_QUERY : urlQ.trim(),
    window: parseTimeWindow(params.get("window")),
    sort: parseIssueSort(params.get("sort")),
  };
}

export function hasFeedQueryInSearchParams(params: URLSearchParams): boolean {
  return params.has("q") || params.has("window") || params.has("sort");
}

export function applyFeedQueryToSearchParams(
  params: URLSearchParams,
  state: ProjectFeedQueryState,
): void {
  const trimmed = state.q.trim();
  if (trimmed === ALL_QUERY) {
    params.delete("q");
  } else {
    params.set("q", trimmed);
  }
  if (state.window === DEFAULT_TIME_WINDOW) {
    params.delete("window");
  } else {
    params.set("window", state.window);
  }
  if (state.sort === DEFAULT_ISSUE_SORT) {
    params.delete("sort");
  } else {
    params.set("sort", state.sort);
  }
}

export function storedFeedQueryDiffersFromDefaults(state: ProjectFeedQueryState): boolean {
  return (
    state.q.trim() !== ALL_QUERY ||
    state.window !== DEFAULT_TIME_WINDOW ||
    state.sort !== DEFAULT_ISSUE_SORT
  );
}

/**
 * If any feed param is in the URL, the URL is authoritative (absent keys = defaults).
 * If none are present (e.g. after sidebar nav), restore from localStorage.
 */
export function getEffectiveFeedQuery(
  projectId: string | null | undefined,
  searchParams: URLSearchParams,
): ProjectFeedQueryState {
  const fromUrl = feedQueryFromSearchParams(searchParams);
  if (searchParams.has("q") || searchParams.has("window") || searchParams.has("sort")) {
    return fromUrl;
  }
  return readStoredFeedQuery(projectId) ?? fromUrl;
}

export function persistFeedQueryFromSearchParams(
  projectId: string | null | undefined,
  searchParams: URLSearchParams,
): void {
  if (!projectId) {
    return;
  }
  writeStoredFeedQuery(projectId, feedQueryFromSearchParams(searchParams));
}

export function isProjectFeedRoute(pathname: string): boolean {
  const segment = projectSegmentFromPath(pathname);
  return segment === "issues" || segment === "alerts";
}

export type ProjectPathSegment =
  | "issues"
  | "monitoring"
  | "releases"
  | "alerts"
  | "monitors"
  | "setup";

/** Nav target with shared `q` / `window` / `sort` (+ optional `issue` on Issues only). */
export function buildProjectPathWithFeedQuery(
  projectId: string,
  segment: ProjectPathSegment,
  options?: {
    currentSearch?: string;
  },
): string {
  const base = `/p/${projectId}/${segment}`;
  const params = new URLSearchParams();

  const currentSearch = options?.currentSearch ?? "";
  const current = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
  );

  const effective = getEffectiveFeedQuery(projectId, current);
  applyFeedQueryToSearchParams(params, effective);

  const environment = current.get("environment");
  if (environment) {
    params.set("environment", environment);
  }

  if (segment === "issues") {
    const issue = current.get("issue");
    if (issue) {
      params.set("issue", issue);
    }
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
