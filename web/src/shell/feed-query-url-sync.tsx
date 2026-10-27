import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  applyFeedQueryToSearchParams,
  feedQueryFromSearchParams,
  getEffectiveFeedQuery,
  isProjectFeedRoute,
} from "../features/issues/project-feed-query-store";
import { projectIdFromPath } from "../lib/paths";

/** Restore shared Issues ↔ Alerts feed params into the URL when nav drops them. */
export function FeedQueryUrlSync() {
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const projectId = projectIdFromPath(pathname);
    if (!projectId || !isProjectFeedRoute(pathname)) {
      return;
    }

    const effective = getEffectiveFeedQuery(projectId, searchParams);
    const inUrl = feedQueryFromSearchParams(searchParams);

    if (
      effective.q === inUrl.q &&
      effective.window === inUrl.window &&
      effective.sort === inUrl.sort
    ) {
      return;
    }

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        applyFeedQueryToSearchParams(next, effective);
        return next;
      },
      { replace: true },
    );
  }, [pathname, searchParams, setSearchParams]);

  return null;
}
