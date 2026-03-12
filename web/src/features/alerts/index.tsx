import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchAlerts, fetchWebhooks, patchAlert, type AlertRow } from "../../lib/api";
import { projectPath, projectSettingsPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { ActionButton } from "../../ui/action-button";
import { Button } from "../../ui/button";
import { Empty } from "../../ui/empty";
import { FeedListBody, StackedCardList } from "../../ui/feed-list-shell";
import { SimpleFeedHeader } from "../../ui/simple-feed-header";
import { CardRowSkeleton } from "../../ui/skeleton";
import { useToast } from "../../ui/toast-provider";
import { AlertListRow } from "./alert-row";
import {
  ALERT_VIEW_MODES,
  countAlertsForViewModes,
  filterAlerts,
  filterAlertsByViewMode,
  groupAlertsByDay,
  loadAlertsPreferences,
  saveAlertsPreferences,
  sortAlerts,
  type AlertTimeWindow,
  type AlertViewMode,
  type AlertsPreferences,
} from "./alert-utils";
import { AlertsRulesPanel } from "./alerts-rules-panel";
import { AlertsToolbar } from "./alerts-toolbar";

function AlertsDayGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h2 className="sticky top-0 z-10 -mx-1 bg-bg/95 px-1 py-1 text-xs font-medium text-ink-muted backdrop-blur-sm">
        {label}
        <span className="ml-1.5 font-mono font-normal tabular-nums text-ink-muted/80">{count}</span>
      </h2>
      {children}
    </section>
  );
}

export function AlertsPage() {
  const { environment, projectId, projects, user } = useAppContext();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookCount, setWebhookCount] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<AlertsPreferences>(() => loadAlertsPreferences());
  const [viewMode, setViewMode] = useState<AlertViewMode>(preferences.defaultViewMode);
  const [timeWindow, setTimeWindow] = useState<AlertTimeWindow>(preferences.defaultTimeWindow);
  const [retrying, setRetrying] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const canManageWebhooks = user?.role === "owner" || user?.role === "admin";

  const loadAlerts = useCallback(async () => {
    if (!activeProjectId) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rows = await fetchAlerts(activeProjectId, environment);
      setAlerts(rows);
    } catch {
      setAlerts([]);
      setError("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, environment]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (!activeProjectId || !canManageWebhooks) {
      setWebhookCount(canManageWebhooks ? 0 : null);
      return;
    }

    let cancelled = false;
    void fetchWebhooks(activeProjectId)
      .then((rows) => {
        if (!cancelled) {
          setWebhookCount(rows.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWebhookCount(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, canManageWebhooks]);

  const handleViewModeChange = (nextViewMode: AlertViewMode) => {
    setViewMode(nextViewMode);
    const next = { ...preferences, defaultViewMode: nextViewMode };
    setPreferences(next);
    saveAlertsPreferences(next);
  };

  const handleTimeWindowChange = (nextTimeWindow: AlertTimeWindow) => {
    setTimeWindow(nextTimeWindow);
    const next = { ...preferences, defaultTimeWindow: nextTimeWindow };
    setPreferences(next);
    saveAlertsPreferences(next);
  };

  const viewModeCounts = useMemo(
    () => countAlertsForViewModes(alerts, timeWindow),
    [alerts, timeWindow],
  );

  const timeScopedAlerts = useMemo(
    () => filterAlerts(alerts, { kind: "all", timeWindow }),
    [alerts, timeWindow],
  );

  const filteredAlerts = useMemo(
    () => sortAlerts(filterAlertsByViewMode(timeScopedAlerts, viewMode), "newest"),
    [timeScopedAlerts, viewMode],
  );

  const groupedAlerts = useMemo(() => groupAlertsByDay(filteredAlerts), [filteredAlerts]);

  useEffect(() => {
    if (filteredAlerts.length === 0) {
      setFocusedId(null);
      return;
    }
    if (!focusedId || !filteredAlerts.some((alert) => alert.id === focusedId)) {
      setFocusedId(filteredAlerts[0]?.id ?? null);
    }
  }, [filteredAlerts, focusedId]);

  const applyAlertPatch = useCallback(
    async (alertId: string, patch: { read?: boolean; ignored?: boolean }) => {
      const previous = alerts;
      setBusyId(alertId);
      setAlerts((rows) =>
        rows.map((row) => {
          if (row.id !== alertId) {
            return row;
          }
          return {
            ...row,
            read_at:
              patch.read === true
                ? new Date().toISOString()
                : patch.read === false
                  ? null
                  : row.read_at,
            ignored: patch.ignored ?? row.ignored,
          };
        }),
      );
      try {
        const updated = await patchAlert(alertId, patch);
        setAlerts((rows) => rows.map((row) => (row.id === alertId ? updated : row)));
        if (patch.ignored === true) {
          toast("Ignored — this rule won’t notify again for that issue");
        } else if (patch.ignored === false) {
          toast("Alert unignored");
        }
      } catch {
        setAlerts(previous);
        toast("Failed to update alert");
      } finally {
        setBusyId(null);
      }
    },
    [alerts, toast],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        setFocusedId((current) => {
          if (filteredAlerts.length === 0) {
            return current;
          }
          const index = filteredAlerts.findIndex((alert) => alert.id === current);
          const nextIndex =
            event.key === "j"
              ? Math.min(filteredAlerts.length - 1, Math.max(0, index) + 1)
              : Math.max(0, (index < 0 ? 0 : index) - 1);
          return filteredAlerts[nextIndex]?.id ?? current;
        });
        return;
      }

      const focused = filteredAlerts.find((alert) => alert.id === focusedId);
      if (!focused || busyId) {
        return;
      }
      if (event.key === "e" && !focused.read_at && !focused.ignored) {
        event.preventDefault();
        void applyAlertPatch(focused.id, { read: true });
      }
      if (event.key === "i" && !focused.ignored) {
        event.preventDefault();
        void applyAlertPatch(focused.id, { ignored: true });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [applyAlertPatch, busyId, filteredAlerts, focusedId]);

  const activeView = ALERT_VIEW_MODES.find((option) => option.value === viewMode);
  const hasAnyAlerts = timeScopedAlerts.length > 0;
  const alternateViewMode =
    viewMode === "unread" && viewModeCounts.all > 0
      ? "all"
      : viewMode === "ignored" && viewModeCounts.all > 0
        ? "all"
        : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SimpleFeedHeader
        title="Alerts"
        description="Triage spikes, regressions, and thresholds. Ignore mutes that rule for the issue."
        actions={
          activeProjectId ? (
            canManageWebhooks ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={projectSettingsPath(activeProjectId, "alerts")}>Alert rules</Link>
              </Button>
            ) : (
              <ActionButton
                variant="secondary"
                size="sm"
                disabled
                tooltip="Admin or owner required to manage alert rules"
              >
                Alert rules
              </ActionButton>
            )
          ) : null
        }
      />

      {!activeProjectId ? (
        <FeedListBody>
          <Empty title="No project selected" description="Choose a project to view alerts." />
        </FeedListBody>
      ) : (
        <>
          <AlertsToolbar
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            viewModeCounts={viewModeCounts}
            timeWindow={timeWindow}
            onTimeWindowChange={handleTimeWindowChange}
          />

          <FeedListBody>
            {loading ? (
              <StackedCardList>
                {Array.from({ length: 5 }).map((_, index) => (
                  <CardRowSkeleton key={index} />
                ))}
              </StackedCardList>
            ) : error ? (
              <div className="space-y-3">
                <p className="text-sm text-semantic-danger">{error}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={retrying}
                  onClick={() => {
                    setRetrying(true);
                    void loadAlerts().finally(() => setRetrying(false));
                  }}
                >
                  {retrying ? "Retrying…" : "Try again"}
                </Button>
              </div>
            ) : !hasAnyAlerts ? (
              <Empty
                title="No signals yet"
                description="Alerts fire when event velocity spikes, a resolved exception comes back, or volume thresholds are crossed."
              >
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {canManageWebhooks ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={projectSettingsPath(activeProjectId, "alerts")}>
                        Set up alert rules
                      </Link>
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={projectPath(activeProjectId, "issues")}>Open Issues</Link>
                  </Button>
                </div>
              </Empty>
            ) : filteredAlerts.length === 0 ? (
              <Empty
                title={
                  viewMode === "unread"
                    ? "Caught up"
                    : viewMode === "ignored"
                      ? "Nothing ignored"
                      : "No activity in this window"
                }
                description={
                  viewMode === "unread"
                    ? "No unread alerts in this range."
                    : activeView?.description ?? "Try widening the time range or switching views."
                }
              >
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {alternateViewMode ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleViewModeChange(alternateViewMode)}
                    >
                      View all ({viewModeCounts.all})
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={projectPath(activeProjectId, "issues")}>Open Issues</Link>
                  </Button>
                </div>
              </Empty>
            ) : (
              <div className="space-y-5">
                {groupedAlerts.map((group) => (
                  <AlertsDayGroup key={group.key} label={group.label} count={group.alerts.length}>
                    <StackedCardList>
                      {group.alerts.map((alert) => (
                        <AlertListRow
                          key={alert.id}
                          alert={alert}
                          projectId={activeProjectId}
                          selected={alert.id === focusedId}
                          onMarkRead={() => void applyAlertPatch(alert.id, { read: true })}
                          onIgnore={() => void applyAlertPatch(alert.id, { ignored: true })}
                          onUnignore={() => void applyAlertPatch(alert.id, { ignored: false })}
                        />
                      ))}
                    </StackedCardList>
                  </AlertsDayGroup>
                ))}
              </div>
            )}
          </FeedListBody>

          <AlertsRulesPanel
            projectId={activeProjectId}
            webhookCount={webhookCount}
            canManageWebhooks={canManageWebhooks}
          />
        </>
      )}
    </div>
  );
}
