import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ALL_QUERY,
  DEFAULT_ISSUE_SORT,
  DEFAULT_TIME_WINDOW,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";
import {
  getEffectiveFeedQuery,
  persistFeedQueryFromSearchParams,
} from "./project-feed-query-store";

/** URL + localStorage feed filters shared by Issues and Alerts. */
export function useProjectFeedQuery(projectId: string | null | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();

  const feed = useMemo(
    () => getEffectiveFeedQuery(projectId, searchParams),
    [projectId, searchParams],
  );
  const query = feed.q;
  const timeWindow = feed.window;
  const issueSort = feed.sort;

  const setQuery = useCallback(
    (nextQueryOrFn: string | ((current: string) => string)) => {
      setSearchParams(
        (prevParams) => {
          const current = getEffectiveFeedQuery(projectId, prevParams).q;
          const nextQuery =
            typeof nextQueryOrFn === "function" ? nextQueryOrFn(current) : nextQueryOrFn;
          const trimmed = nextQuery.trim();
          const params = new URLSearchParams(prevParams);
          if (trimmed === ALL_QUERY) {
            params.delete("q");
          } else {
            params.set("q", trimmed);
          }
          persistFeedQueryFromSearchParams(projectId, params);
          return params;
        },
        { replace: true },
      );
    },
    [projectId, setSearchParams],
  );

  const setTimeWindow = useCallback(
    (nextWindow: TimeWindowValue) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (nextWindow === DEFAULT_TIME_WINDOW) {
            params.delete("window");
          } else {
            params.set("window", nextWindow);
          }
          persistFeedQueryFromSearchParams(projectId, params);
          return params;
        },
        { replace: true },
      );
    },
    [projectId, setSearchParams],
  );

  const setIssueSort = useCallback(
    (nextSort: IssueSortValue) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (nextSort === DEFAULT_ISSUE_SORT) {
            params.delete("sort");
          } else {
            params.set("sort", nextSort);
          }
          persistFeedQueryFromSearchParams(projectId, params);
          return params;
        },
        { replace: true },
      );
    },
    [projectId, setSearchParams],
  );

  return {
    query,
    setQuery,
    timeWindow,
    setTimeWindow,
    issueSort,
    setIssueSort,
    searchParams,
    setSearchParams,
  };
}
