import { useCallback, useEffect, useState } from "react";
import type { AlertRow, IssueSummary } from "./api";
import {
  isAlertInboxUnread,
  isIssueInboxUnread,
  loadInboxReadMap,
  persistAlertInboxRead,
  persistIssueInboxRead,
  type InboxReadMap,
} from "./inbox-read-state";

export function useInboxReadState(projectId: string | null | undefined) {
  const [readMap, setReadMap] = useState<InboxReadMap>(() =>
    projectId ? loadInboxReadMap(projectId) : {},
  );

  useEffect(() => {
    setReadMap(projectId ? loadInboxReadMap(projectId) : {});
  }, [projectId]);

  const isIssueUnread = useCallback(
    (issue: IssueSummary) => isIssueInboxUnread(issue, readMap),
    [readMap],
  );

  const isAlertUnread = useCallback(
    (alert: Pick<AlertRow, "id" | "issue_id" | "fired_at" | "read_at" | "ignored">) =>
      isAlertInboxUnread(alert, readMap),
    [readMap],
  );

  const markIssueRead = useCallback(
    (
      issueId: string,
      viewedAt = new Date().toISOString(),
      linkedAlertIds: string[] = [],
    ) => {
      if (!projectId) {
        return;
      }
      setReadMap((current) =>
        persistIssueInboxRead(projectId, current, issueId, viewedAt, linkedAlertIds),
      );
    },
    [projectId],
  );

  const markAlertRead = useCallback(
    (
      alertId: string,
      viewedAt = new Date().toISOString(),
      linkedIssueId: string | null = null,
    ) => {
      if (!projectId) {
        return;
      }
      setReadMap((current) =>
        persistAlertInboxRead(projectId, current, alertId, viewedAt, linkedIssueId),
      );
    },
    [projectId],
  );

  const markReadMany = useCallback(
    (entries: { alertId: string; issueId: string | null; viewedAt?: string }[]) => {
      if (!projectId || entries.length === 0) {
        return;
      }
      setReadMap((current) => {
        let next = current;
        for (const entry of entries) {
          next = persistAlertInboxRead(
            projectId,
            next,
            entry.alertId,
            entry.viewedAt ?? new Date().toISOString(),
            entry.issueId,
          );
        }
        return next;
      });
    },
    [projectId],
  );

  const markIssueReadMany = useCallback(
    (entries: { issueId: string; viewedAt?: string; linkedAlertIds?: string[] }[]) => {
      if (!projectId || entries.length === 0) {
        return;
      }
      setReadMap((current) => {
        let next = current;
        for (const entry of entries) {
          next = persistIssueInboxRead(
            projectId,
            next,
            entry.issueId,
            entry.viewedAt ?? new Date().toISOString(),
            entry.linkedAlertIds ?? [],
          );
        }
        return next;
      });
    },
    [projectId],
  );

  return {
    readMap,
    isIssueUnread,
    isAlertUnread,
    markIssueRead,
    markAlertRead,
    markReadMany,
    markIssueReadMany,
  };
}
