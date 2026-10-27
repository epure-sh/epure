import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAlerts, fetchHeadlineStats, type AlertRow } from "../lib/api";
import { useInboxReadState } from "../lib/use-inbox-read-state";

const REFRESH_MS = 45_000;

export interface ProjectNavCounts {
  unresolved: number | null;
  alertsUnread: number | null;
}

/** Sidebar pastilles: unresolved issues (API) + unread alerts (inbox read state). */
export function useProjectNavCounts(
  projectId: string | null | undefined,
  environment?: string,
): ProjectNavCounts {
  const [unresolved, setUnresolved] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const { isAlertUnread } = useInboxReadState(projectId);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setUnresolved(null);
      setAlerts([]);
      return;
    }
    try {
      const [stats, rows] = await Promise.all([
        fetchHeadlineStats(projectId, environment),
        fetchAlerts(projectId, environment),
      ]);
      setUnresolved(stats.unresolved);
      setAlerts(Array.isArray(rows) ? rows : []);
    } catch {
      setUnresolved(null);
      setAlerts([]);
    }
  }, [projectId, environment]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const alertsUnread = useMemo(
    () => alerts.filter((row) => isAlertUnread(row)).length,
    [alerts, isAlertUnread],
  );

  return {
    unresolved,
    alertsUnread: projectId ? alertsUnread : null,
  };
}
