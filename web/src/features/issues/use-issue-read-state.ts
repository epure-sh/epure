import { useInboxReadState } from "@/lib/use-inbox-read-state";

/** Shared inbox read state (issues + linked alerts). */
export function useIssueReadState(projectId: string | null) {
  const { isIssueUnread, markIssueRead, markIssueReadMany, readMap, restoreReadMap } =
    useInboxReadState(projectId);
  return {
    isUnread: isIssueUnread,
    markRead: markIssueRead,
    markReadMany: markIssueReadMany,
    readMap,
    restoreReadMap,
  };
}
