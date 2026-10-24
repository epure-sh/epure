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
import { AlertBuilder } from "./alert-builder";
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
  const [retrying, setRetrying] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);

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

  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const viewModeCounts = useMemo(
    () => countAlertsForViewModes(safeAlerts, timeWindow),
    [safeAlerts, timeWindow],
  );

  const timeScopedAlerts = useMemo(
    () => filterAlerts(safeAlerts, { kind: "all", timeWindow }),
    [safeAlerts, timeWindow],
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
    <PageShell
      title="Alerts"
      description="Triage spikes, regressions, and thresholds. Ignore mutes that rule for the issue."
      actions={
        activeProjectId ? (
          <div className="flex items-center gap-2">
            <Button
              variant={isCreatingRule ? "outline" : "primary"}
              size="sm"
              onClick={() => setIsCreatingRule(!isCreatingRule)}
            >
              {isCreatingRule ? "Close Builder" : "+ New Alert Rule"}
            </Button>
            {canManageWebhooks ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={projectSettingsPath(activeProjectId, "alerts")}>Settings</Link>
              </Button>
            ) : (
              <ActionButton
                variant="secondary"
                size="sm"
                disabled
                tooltip="Admin or owner required to manage alert rules"
              >
                Settings
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
          {isCreatingRule && (
            <div className="border-b border-border-subtle bg-surface-base p-4 md:p-6">
              <AlertBuilder
                projectId={activeProjectId}
                onSuccess={() => {
                  setIsCreatingRule(false);
                  void loadAlerts();
                }}
                onCancel={() => setIsCreatingRule(false)}
              />
            </div>
          )}

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
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreatingRule(true)}
                  >
                    + New Alert Rule
                  </Button>
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
                {(groupedAlerts ?? []).map((group) => (
                  <AlertsDayGroup key={group.key} label={group.label} count={group.alerts?.length ?? 0}>
                    <StackedCardList>
                      {(group.alerts ?? []).map((alert, alertIdx) => alert ? (
                        <AlertListRow
                          key={alert.id || `alert-${alertIdx}`}
                          alert={alert}
                          projectId={activeProjectId ?? ""}
                          selected={alert.id === focusedId}
                          onMarkRead={() => void applyAlertPatch(alert.id, { read: true })}
                          onIgnore={() => void applyAlertPatch(alert.id, { ignored: true })}
                          onUnignore={() => void applyAlertPatch(alert.id, { ignored: false })}
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
      )}
    </PageShell>
  );
}
