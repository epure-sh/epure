import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchAlerts, fetchWebhooks, type AlertRow } from "../../lib/api";
import { projectPath, projectSettingsPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { ActionButton } from "../../ui/action-button";
import { Button } from "../../ui/button";
import { Empty } from "../../ui/empty";
import { FeedListBody, StackedCardList } from "../../ui/feed-list-shell";
import { SimpleFeedHeader } from "../../ui/simple-feed-header";
import { CardRowSkeleton } from "../../ui/skeleton";
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
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookCount, setWebhookCount] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<AlertsPreferences>(() => loadAlertsPreferences());
  const [viewMode, setViewMode] = useState<AlertViewMode>(preferences.defaultViewMode);
  const [timeWindow, setTimeWindow] = useState<AlertTimeWindow>(preferences.defaultTimeWindow);
  const [retrying, setRetrying] = useState(false);

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

  const activeView = ALERT_VIEW_MODES.find((option) => option.value === viewMode);
  const hasAnyAlerts = timeScopedAlerts.length > 0;
  const alternateViewMode =
    viewMode === "attention" && viewModeCounts.activity > 0
      ? "activity"
      : viewMode !== "all" && viewModeCounts.all > 0
        ? "all"
        : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SimpleFeedHeader
        title="Alerts"
        description="Signal log for spikes, regressions, and thresholds. Triage happens on Issues."
        actions={
          activeProjectId ? (
            canManageWebhooks ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={projectSettingsPath(activeProjectId, "webhooks")}>Notifications</Link>
              </Button>
            ) : (
              <ActionButton
                variant="secondary"
                size="sm"
                disabled
                tooltip="Admin or owner required to manage notifications"
              >
                Notifications
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
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {canManageWebhooks ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={projectSettingsPath(activeProjectId, "webhooks")}>
                        Set up notifications
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
                  viewMode === "attention"
                    ? "Nothing urgent right now"
                    : "No activity in this window"
                }
                description={
                  viewMode === "attention"
                    ? "No velocity spikes, regressions, or ingest caps in this range. Lower-noise signals like new issues and milestones live under Activity."
                    : activeView?.description ?? "Try widening the time range or switching views."
                }
              >
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {alternateViewMode ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleViewModeChange(alternateViewMode)}
                    >
                      {alternateViewMode === "activity"
                        ? `View activity (${viewModeCounts.activity})`
                        : `View all (${viewModeCounts.all})`}
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
                        <AlertListRow key={alert.id} alert={alert} projectId={activeProjectId} />
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
