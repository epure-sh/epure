import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAlerts, fetchWebhooks, patchAlert, type AlertRow } from "../../lib/api";
import { projectPath } from "../../lib/paths";
import { isDemoProject } from "../../lib/demo-utils";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
import { Empty } from "../../ui/empty";
import { FeedListBody, StackedCardList } from "../../ui/feed-list-shell";
import { AlertsHistoryBulkBar } from "./alerts-history-bulk-bar";
import { PageShell } from "@/components/kit/page-shell";
import { CardRowSkeleton } from "../../ui/skeleton";
import { useToast } from "../../ui/toast-provider";
import { AlertDetailPanel } from "./alert-detail-panel";
import { AlertListRow } from "./alert-row";
import { AlertRulesManager } from "./alert-rules-manager";
import {
  ALERT_VIEW_MODES,
  buildLastTriggeredByKind,
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
import { AlertsSectionToggle, type AlertsSection } from "./alerts-section-toggle";
import { AlertsToolbar } from "./alerts-toolbar";
import { cn } from "../../lib/cn";

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
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(() => new Set());
  const lastBulkAnchorId = useRef<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [section, setSection] = useState<AlertsSection>("history");

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject = useMemo(() => {
    const candidate = routeProjectId ?? projectId;
    if (candidate) {
      const match = safeProjects.find((row) => row && (row.id === candidate || row.slug === candidate));
      if (match) return match;
    }
    return safeProjects.find((row) => row && !isDemoProject(row)) ?? safeProjects[0] ?? null;
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

  useEffect(() => {
    const visible = new Set(filteredAlerts.map((row) => row.id));
    setSelectedAlertIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredAlerts]);

  const filteredIds = useMemo(() => filteredAlerts.map((row) => row.id), [filteredAlerts]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedAlertIds.has(id));
  const someFilteredSelected = filteredIds.some((id) => selectedAlertIds.has(id));

  const bulkSelectionAllMuted = useMemo(() => {
    if (selectedAlertIds.size === 0) return false;
    return [...selectedAlertIds].every((id) => {
      const row = filteredAlerts.find((alert) => alert.id === id);
      return row?.ignored === true;
    });
  }, [filteredAlerts, selectedAlertIds]);

  const handleBulkSelect = useCallback(
    (alertId: string, selected: boolean, options?: { shiftKey?: boolean }) => {
      const ids = filteredAlerts.map((row) => row.id);
      if (options?.shiftKey && lastBulkAnchorId.current) {
        const start = ids.indexOf(lastBulkAnchorId.current);
        const end = ids.indexOf(alertId);
        if (start >= 0 && end >= 0) {
          const lo = Math.min(start, end);
          const hi = Math.max(start, end);
          setSelectedAlertIds((prev) => {
            const next = new Set(prev);
            for (let i = lo; i <= hi; i += 1) {
              const id = ids[i];
              if (id) next.add(id);
            }
            return next;
          });
          lastBulkAnchorId.current = alertId;
          return;
        }
      }
      lastBulkAnchorId.current = alertId;
      setSelectedAlertIds((prev) => {
        const next = new Set(prev);
        if (selected) next.add(alertId);
        else next.delete(alertId);
        return next;
      });
    },
    [filteredAlerts],
  );

  const toggleSelectAllFiltered = () => {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  };

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

  const applyBulkPatch = useCallback(
    async (patch: { read?: boolean; ignored?: boolean }) => {
      const ids = [...selectedAlertIds];
      if (ids.length === 0) return;
      setBulkBusy(true);
      try {
        await Promise.all(ids.map((id) => applyAlertPatch(id, patch)));
        setSelectedAlertIds(new Set());
      } finally {
        setBulkBusy(false);
      }
    },
    [applyAlertPatch, selectedAlertIds],
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
      actions={
        activeProjectId ? <AlertsSectionToggle value={section} onChange={setSection} /> : null
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
          {section === "configure" ? (
            <div className="px-4 py-4 md:px-6">
              <AlertRulesManager
                projectId={activeProjectId}
                canManage={canManageWebhooks}
                lastTriggered={buildLastTriggeredByKind(safeAlerts)}
              />
            </div>
          ) : null}

          {section === "history" ? (
          <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:max-w-[min(100%,28rem)] lg:border-r lg:border-border-subtle">
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

          <AlertsHistoryBulkBar
            selectedCount={selectedAlertIds.size}
            totalCount={filteredAlerts.length}
            allSelected={allFilteredSelected}
            someSelected={someFilteredSelected}
            busy={bulkBusy}
            onToggleSelectAll={toggleSelectAllFiltered}
            onClear={() => setSelectedAlertIds(new Set())}
            onAcknowledge={() => void applyBulkPatch({ read: true })}
            onMute={() => void applyBulkPatch({ ignored: true })}
            showUnmute={bulkSelectionAllMuted}
            onUnmute={() => void applyBulkPatch({ ignored: false, read: false })}
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
                  <Button variant="primary" size="sm" onClick={() => setSection("configure")}>
                    Create alert
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
                    : viewMode === "resolved"
                      ? "Nothing resolved yet"
                      : viewMode === "ignored"
                        ? "Nothing muted"
                        : "No activity in this window"
                }
                description={
                  viewMode === "unread"
                    ? "No alerts need attention in this range."
                    : viewMode === "resolved"
                      ? "No resolved alerts in this range."
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
              <div className="space-y-4 -mx-4 md:-mx-6">
                {(groupedAlerts ?? []).map((group) => (
                  <AlertsDayGroup key={group.key} label={group.label} count={group.alerts?.length ?? 0}>
                    <ul className="space-y-2">
                      {(group.alerts ?? []).map((alert, alertIdx) =>
                        alert ? (
                          <AlertListRow
                            key={alert.id || `alert-${alertIdx}`}
                            alert={alert}
                            detailActive={alert.id === focusedId}
                            bulkSelected={selectedAlertIds.has(alert.id)}
                            onBulkSelectChange={(checked, options) =>
                              handleBulkSelect(alert.id, checked, options)
                            }
                            onActivate={() => setFocusedId(alert.id)}
                          />
                        ) : null,
                      )}
                    </ul>
                  </AlertsDayGroup>
                ))}
              </div>
            )}
          </FeedListBody>
          </div>

          <aside
            className={cn(
              "hidden min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-border-subtle bg-surface-1 lg:flex lg:max-w-none lg:flex-1 lg:border-t-0",
              focusedId && "max-lg:flex max-lg:min-h-[40vh]",
            )}
          >
            <AlertDetailPanel
              alert={filteredAlerts.find((row) => row.id === focusedId) ?? null}
              projectId={activeProjectId ?? ""}
              webhookCount={webhookCount}
              busy={busyId != null}
              onAcknowledge={() => {
                const id = focusedId;
                if (id) void applyAlertPatch(id, { read: true });
              }}
              onReopen={() => {
                const id = focusedId;
                if (id) void applyAlertPatch(id, { read: false });
              }}
              onMute={() => {
                const id = focusedId;
                if (id) void applyAlertPatch(id, { ignored: true });
              }}
              onUnmute={() => {
                const id = focusedId;
                if (id) void applyAlertPatch(id, { ignored: false, read: false });
              }}
            />
          </aside>
          </div>

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
