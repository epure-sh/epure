import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAlerts, fetchWebhooks, patchAlert, type AlertRow } from "../../lib/api";
import { projectPath, projectSettingsPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { ActionButton } from "../../ui/action-button";
import { Button } from "../../ui/button";
import { Empty } from "../../ui/empty";
import { FeedListBody, StackedCardList } from "../../ui/feed-list-shell";
import { PageShell } from "@/components/kit/page-shell";
import { CardRowSkeleton } from "../../ui/skeleton";
import { useToast } from "../../ui/toast-provider";
import { AlertListRow } from "./alert-row";
import { AlertRulesManager } from "./alert-rules-manager";
import {
  ALERT_VIEW_MODES,
  countAlertsForViewModes,
  filterAlerts,
  filterAlertsByViewMode,
  groupAlertsByDay,
  loadAlertsPreferences,
  saveAlertsPreferences,
  sortAlerts,
  type AlertKindFilter,
  type AlertSort,
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
      <h2 className="sticky top-0 z-10 -mx-4 px-4 md:-mx-6 md:px-6 py-1.5 bg-canvas/95 text-xs font-medium text-fg-muted backdrop-blur-sm border-b border-border-subtle/50">
        {label}
        <span className="ml-1.5 font-mono font-normal tabular-nums text-fg-muted/80">{count}</span>
      </h2>
      {children}
    </section>
  );
}

export function AlertsPage() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { environment, projectId, projects, projectsLoading, user } = useAppContext();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookCount, setWebhookCount] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<AlertsPreferences>(() => loadAlertsPreferences());
  const [viewMode, setViewMode] = useState<AlertViewMode>(preferences.defaultViewMode);
  const [timeWindow, setTimeWindow] = useState<AlertTimeWindow>(preferences.defaultTimeWindow);
  const [kindFilter, setKindFilter] = useState<AlertKindFilter>("all");
  const [sort, setSort] = useState<AlertSort>("newest");
  const [retrying, setRetrying] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [section, setSection] = useState<"rules" | "history">("rules");

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject = useMemo(() => {
    const candidate = routeProjectId ?? projectId;
    if (candidate) {
      const match = safeProjects.find((row) => row && (row.id === candidate || row.slug === candidate));
      if (match) return match;
    }
    return safeProjects[0] ?? null;
  }, [routeProjectId, projectId, safeProjects]);

  const activeProjectId = activeProject?.id ?? null;
  const canManageWebhooks = user?.role === "owner" || user?.role === "admin";

  const loadAlerts = useCallback(async () => {
    if (projectsLoading) {
      return;
    }
    if (!activeProjectId) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rows = await fetchAlerts(activeProjectId, environment);
      setAlerts(Array.isArray(rows) ? rows : []);
    } catch {
      setAlerts([]);
      setError("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [projectsLoading, activeProjectId, environment]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (projectsLoading || !activeProjectId || !canManageWebhooks) {
      setWebhookCount(canManageWebhooks ? 0 : null);
      return;
    }

    let cancelled = false;
    void fetchWebhooks(activeProjectId)
      .then((rows) => {
        if (!cancelled) {
          setWebhookCount(Array.isArray(rows) ? rows.length : 0);
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
  }, [projectsLoading, activeProjectId, canManageWebhooks]);

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

  const handleResetFilters = () => {
    setKindFilter("all");
    setSort("newest");
    handleTimeWindowChange("7d");
  };

  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const viewModeCounts = useMemo(
    () => countAlertsForViewModes(safeAlerts, timeWindow, kindFilter),
    [safeAlerts, timeWindow, kindFilter],
  );

  const timeScopedAlerts = useMemo(
    () => filterAlerts(safeAlerts, { kind: kindFilter, timeWindow }),
    [safeAlerts, kindFilter, timeWindow],
  );

  const filteredAlerts = useMemo(
    () => sortAlerts(filterAlertsByViewMode(timeScopedAlerts, viewMode), sort),
    [timeScopedAlerts, viewMode, sort],
  );

  const groupedAlerts = useMemo(() => groupAlertsByDay(filteredAlerts, sort), [filteredAlerts, sort]);

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
        (Array.isArray(rows) ? rows : []).map((row) => {
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
          toast("Alert muted — will not notify again for this issue");
        } else if (patch.ignored === false) {
          toast("Alert unmuted");
        } else if (patch.read === true) {
          toast("Alert resolved");
        } else if (patch.read === false) {
          toast("Alert marked unread");
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
      if ((event.key === "e" || event.key === "r") && !focused.ignored) {
        event.preventDefault();
        void applyAlertPatch(focused.id, { read: !focused.read_at });
      }
      if (event.key === "i" || event.key === "m") {
        event.preventDefault();
        if (focused.ignored) {
          void applyAlertPatch(focused.id, { ignored: false, read: false });
        } else {
          void applyAlertPatch(focused.id, { ignored: true });
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [applyAlertPatch, busyId, filteredAlerts, focusedId]);

  const activeView = ALERT_VIEW_MODES.find((option) => option.value === viewMode);
  const hasAnyAlerts = safeAlerts.length > 0;
  const alternateViewMode =
    viewMode !== "all" && viewModeCounts.all > 0
      ? "all"
      : null;

  return (
    <PageShell
      title="Alerts"
      description="Rules say when to notify you. History shows what actually fired."
      actions={
        activeProjectId ? (
          <div className="flex items-center gap-2">
            <Button
              variant={section === "rules" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSection("rules")}
            >
              Rules
            </Button>
            <Button
              variant={section === "history" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSection("history")}
            >
              History
            </Button>
            {canManageWebhooks ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={projectSettingsPath(activeProjectId, "alerts")}>Configure Rules</Link>
              </Button>
            ) : (
              <ActionButton
                variant="secondary"
                size="sm"
                disabled
                tooltip="Admin or owner required to manage alert rules"
              >
                Configure Rules
              </ActionButton>
            )}
          </div>
        ) : null
      }
      density="full-bleed"
    >
      {projectsLoading ? (
        <FeedListBody>
          <StackedCardList>
            {Array.from({ length: 5 }).map((_, index) => (
              <CardRowSkeleton key={index} />
            ))}
          </StackedCardList>
        </FeedListBody>
      ) : !activeProjectId ? (
        <FeedListBody>
          <Empty title="No project selected" description="Choose a project to view alerts." />
        </FeedListBody>
      ) : (
        <>
          {section === "rules" ? (
            <div className="px-4 py-4 md:px-6">
              <AlertRulesManager projectId={activeProjectId} canManage={canManageWebhooks} />
            </div>
          ) : null}

          {section === "history" ? (
          <>
          <AlertsToolbar
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            viewModeCounts={viewModeCounts}
            timeWindow={timeWindow}
            onTimeWindowChange={handleTimeWindowChange}
            kindFilter={kindFilter}
            onKindFilterChange={setKindFilter}
            sort={sort}
            onSortChange={setSort}
            onResetFilters={handleResetFilters}
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
                  <Button variant="primary" size="sm" onClick={() => setSection("rules")}>
                    Create alert
                  </Button>
                  {canManageWebhooks ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={projectSettingsPath(activeProjectId, "alerts")}>Configure Rules</Link>
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
                    : viewMode === "resolved"
                      ? "No resolved alerts"
                      : viewMode === "ignored"
                        ? "Nothing muted"
                        : "No activity in this window"
                }
                description={
                  viewMode === "unread"
                    ? "No unresolved alerts in this range."
                    : viewMode === "resolved"
                      ? "No alerts have been marked as resolved in this range."
                      : viewMode === "ignored"
                        ? "No alerts are currently muted."
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
                  {timeWindow !== "all" && safeAlerts.length > 0 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTimeWindowChange("all")}
                    >
                      All time ({safeAlerts.length})
                    </Button>
                  ) : null}
                  {kindFilter !== "all" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                    >
                      Reset type filter
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={projectPath(activeProjectId, "issues")}>Open Issues</Link>
                  </Button>
                </div>
              </Empty>
            ) : (
              <div className="space-y-5">
                {(groupedAlerts ?? []).map((group) => (
                  <AlertsDayGroup key={group.key} label={group.label} count={group.alerts?.length ?? 0}>
                    <StackedCardList>
                      {(group.alerts ?? []).map((alert, alertIdx) => alert ? (
                        <AlertListRow
                          key={alert.id || `alert-${alertIdx}`}
                          alert={alert}
                          projectId={alert.project_id || activeProjectId || ""}
                          selected={alert.id === focusedId}
                          onMarkRead={() => void applyAlertPatch(alert.id, { read: true })}
                          onMarkUnread={() => void applyAlertPatch(alert.id, { read: false })}
                          onIgnore={() => void applyAlertPatch(alert.id, { ignored: true })}
                          onUnignore={() => void applyAlertPatch(alert.id, { ignored: false, read: false })}
                        />
                      ) : null)}
                    </StackedCardList>
                  </AlertsDayGroup>
                ))}
              </div>
            )}
          </FeedListBody>

          <AlertsRulesPanel
            projectId={activeProjectId ?? ""}
            webhookCount={webhookCount}
            canManageWebhooks={canManageWebhooks}
          />
          </>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
