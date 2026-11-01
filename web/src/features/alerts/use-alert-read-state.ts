import { useInboxReadState } from "@/lib/use-inbox-read-state";

/** Shared inbox read state (alerts + linked issues). */
export function useAlertReadState(projectId: string | null | undefined) {
  const { isAlertUnread, markAlertRead, markReadMany, readMap, restoreReadMap } =
    useInboxReadState(projectId);
  return {
    isUnread: isAlertUnread,
    markRead: markAlertRead,
    markReadMany,
    readMap,
    restoreReadMap,
  };
}
