import { useCallback, useEffect, useState } from "react";
import type { IssueSummary } from "../../lib/api";
import {
  isIssueUnread,
  loadIssueReadMap,
  persistIssueRead,
  type IssueReadMap,
} from "./issue-read-state";

export function useIssueReadState(projectId: string | null) {
  const [readMap, setReadMap] = useState<IssueReadMap>(() =>
    projectId ? loadIssueReadMap(projectId) : {},
  );

  useEffect(() => {
    setReadMap(projectId ? loadIssueReadMap(projectId) : {});
  }, [projectId]);

  const markRead = useCallback(
    (issueId: string, viewedAt = new Date().toISOString()) => {
      if (!projectId) {
        return;
      }
      setReadMap((current) => persistIssueRead(projectId, current, issueId, viewedAt));
    },
    [projectId],
  );

  const isUnread = useCallback(
    (issue: IssueSummary) => isIssueUnread(issue, readMap),
    [readMap],
  );

  return { isUnread, markRead };
}
