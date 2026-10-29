import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchAlertRules,
  fetchAlerts,
  fetchHeadlineStats,
  fetchWebhooks,
  patchAlert,
  type AlertRow,
  type HeadlineStats,
} from "../../lib/api";
import { projectPath } from "../../lib/paths";
import { isDemoProject } from "../../lib/demo-utils";
import { useAppContext } from "../../shell/app-context";
import { Button } from "@/components/ui/button";
import { Empty } from "@/ui/empty";
import { FeedListBody, StackedCardList } from "@/ui/feed-list-shell";
import { AlertsDayGroup } from "./alerts-day-group";
import { bulkAlertAvailability } from "./alert-bulk-utils";
import { AlertsHistoryBulkBar } from "./alerts-history-bulk-bar";
import { useAlertReadState } from "./use-alert-read-state";
import { INBOX_FEED_BODY_PAD_CLASS } from "@/components/kit/inbox-read-cue";
import { PageShell } from "@/components/kit/page-shell";
import { AlertCardSkeleton } from "./alert-card-skeleton";
import { toast } from "@/components/ui/sonner";
import { AlertDetailPanel } from "./alert-detail-panel";
import { useAlertExportHotkey } from "./export-markdown";
import { AlertListRow } from "./alert-row";
import { AlertRulesManager, type AlertRulesManagerHandle } from "./alert-rules-manager";
import { CreateAlertRuleDialog } from "./create-alert-rule-dialog";
import {
  buildLastTriggeredByKind,
  buildRuleFiredCounts,
  getIssueLink,
  alertMatchesHistoryRuleFocus,
  type HistoryRuleFocus,
  filterAlerts,
  filterAlertsByIssuesQuery,
  groupAlertsByDay,
  isAlertUnread,
  issueSortToAlertSort,
  loadAlertsPreferences,
  saveAlertsPreferences,
  sortAlerts,
  type AlertTimeWindow,
  type AlertsPreferences,
} from "./alert-utils";
import { parseQuery, resetQuery, type TimeWindowValue } from "../issues/query-utils";
import { useProjectFeedQuery } from "../issues/use-project-feed-query";
import type { AlertsSection } from "./alerts-section-toggle";
import { AlertsToolbar, type RulesStatusFilter } from "./alerts-toolbar";
import type { RuleDestinationKind } from "./alert-rules-display";
import { cn } from "../../lib/cn";

export function AlertsPage() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { environment, projectId, projects, projectsLoading, user } = useAppContext();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookCount, setWebhookCount] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<AlertsPreferences>(() => loadAlertsPreferences());
  const [headlineStats, setHeadlineStats] = useState<HeadlineStats | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(() => new Set());
  const lastBulkAnchorId = useRef<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [section, setSection] = useState<AlertsSection>("history");
  const [ruleCount, setRuleCount] = useState(0);
  const [historyRuleFocus, setHistoryRuleFocus] = useState<HistoryRuleFocus | null>(null);
  const historyRuleName = historyRuleFocus?.ruleName ?? null;
  const [rulesStatusFilter, setRulesStatusFilter] = useState<RulesStatusFilter>("all");
  const [rulesDestinationFilter, setRulesDestinationFilter] = useState<RuleDestinationKind>("all");
  const [activeRuleCount, setActiveRuleCount] = useState(0);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const rulesManagerRef = useRef<AlertRulesManagerHandle>(null);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rulesVersion, setRulesVersion] = useState(0);
  const alertListRef = useRef<HTMLDivElement>(null);

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
  const { isUnread: isAlertInboxUnread, markRead: markAlertRead, markReadMany } =
    useAlertReadState(activeProjectId);
  const {
    query,
    setQuery: persistFeedQuery,
    timeWindow,
    setTimeWindow: setFeedTimeWindow,
    issueSort,
    setIssueSort,
  } = useProjectFeedQuery(activeProjectId);
  const setQuery = useCallback(
    (next: string | ((current: string) => string)) => {
      setSelectedAlertIds(new Set());
      persistFeedQuery(next);
    },
    [persistFeedQuery],
  );
  const [rulesSearch, setRulesSearch] = useState("");
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
    if (!activeProjectId) {
      setRuleCount(0);
      return;
    }
    let cancelled = false;
    void fetchAlertRules(activeProjectId)
      .then((rows) => {
        if (!cancelled) {
          const list = Array.isArray(rows) ? rows : [];
          setRuleCount(list.length);
          setActiveRuleCount(list.filter((row) => row.enabled).length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuleCount(0);
          setActiveRuleCount(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, rulesVersion]);

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

  const handleTimeWindowChange = (nextTimeWindow: TimeWindowValue) => {
    setFeedTimeWindow(nextTimeWindow);
    const next = { ...preferences, defaultTimeWindow: nextTimeWindow as AlertTimeWindow };
    setPreferences(next);
    saveAlertsPreferences(next);
  };

  useEffect(() => {
    if (!activeProjectId) {
      setHeadlineStats(null);
      return;
    }
    let cancelled = false;
    void fetchHeadlineStats(activeProjectId, environment)
      .then((stats) => {
        if (!cancelled) setHeadlineStats(stats);
      })
      .catch(() => {
        if (!cancelled) setHeadlineStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, environment]);

  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const timeScopedAlerts = useMemo(
    () => filterAlerts(safeAlerts, { kind: "all", timeWindow: timeWindow as AlertTimeWindow }),
    [safeAlerts, timeWindow],
  );

  const historyUnreadCount = useMemo(
    () => timeScopedAlerts.filter((row) => isAlertUnread(row)).length,
    [timeScopedAlerts],
  );

  const alertFilterStats = useMemo((): HeadlineStats | null => {
    const regressions = timeScopedAlerts.filter((row) => row.kind === "regression").length;
    const snoozed = timeScopedAlerts.filter((row) => row.ignored).length;
    if (headlineStats) {
      return {
        ...headlineStats,
        unresolved: historyUnreadCount,
        regressions,
        snoozed,
      };
    }
    if (!activeProjectId) {
      return null;
    }
    return {
      project_id: activeProjectId,
      environment: environment ?? null,
      unresolved: historyUnreadCount,
      events_7d: 0,
      regressions,
      snoozed,
    };
  }, [activeProjectId, environment, headlineStats, historyUnreadCount, timeScopedAlerts]);

  const filteredAlerts = useMemo(() => {
    let rows = filterAlertsByIssuesQuery(timeScopedAlerts, query);
    if (historyRuleFocus) {
      rows = rows.filter((row) => alertMatchesHistoryRuleFocus(row, historyRuleFocus));
    }
    return sortAlerts(rows, issueSortToAlertSort(issueSort));
  }, [timeScopedAlerts, query, issueSort, historyRuleFocus]);

  const focusedAlert = useMemo(
    () => filteredAlerts.find((row) => row.id === focusedId) ?? null,
    [filteredAlerts, focusedId],
  );

  useAlertExportHotkey(
    section === "history" && focusedAlert != null,
    focusedAlert,
    activeProjectId ?? "",
    () => toast("Copied alert brief for AI"),
  );

  const groupedAlerts = useMemo(
    () => groupAlertsByDay(filteredAlerts, issueSortToAlertSort(issueSort)),
    [filteredAlerts, issueSort],
  );

  useEffect(() => {
    if (filteredAlerts.length === 0) {
      setFocusedId(null);
      return;
    }
    if (focusedId && !filteredAlerts.some((alert) => alert.id === focusedId)) {
      setFocusedId(null);
    }
  }, [filteredAlerts, focusedId]);

  useEffect(() => {
    if (!focusedId || !alertListRef.current) {
      return;
    }
    const row = alertListRef.current.querySelector(`[data-alert-id="${focusedId}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [focusedId]);

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

  const selectedAlerts = useMemo(
    () => filteredAlerts.filter((row) => selectedAlertIds.has(row.id)),
    [filteredAlerts, selectedAlertIds],
  );

  const bulkAvailability = useMemo(() => bulkAlertAvailability(selectedAlerts), [selectedAlerts]);

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
      const targetAlert = alerts.find((a) => a.id === alertId);
      const previousState = targetAlert
        ? { read: Boolean(targetAlert.read_at), ignored: Boolean(targetAlert.ignored) }
        : null;
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
        if (patch.read === true) {
          markAlertRead(
            alertId,
            updated.fired_at ?? new Date().toISOString(),
            updated.issue_id,
          );
        }

        const undoAction = previousState
          ? {
              label: "Undo",
              onClick: () => {
                void applyAlertPatch(alertId, previousState);
              },
            }
          : undefined;

        if (patch.ignored === true) {
          toast("Alert snoozed", {
            description: "Will not notify again for this issue.",
            action: undoAction,
          });
        } else if (patch.ignored === false) {
          toast("Alert unsnoozed", { action: undoAction });
        } else if (patch.read === true) {
          toast("Alert resolved", { action: undoAction });
        } else if (patch.read === false) {
          toast("Alert marked unread", { action: undoAction });
        }
      } catch {
        setAlerts(previous);
        toast.error("Failed to update alert");
      } finally {
        setBusyId(null);
      }
    },
    [alerts, markAlertRead],
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

      if (
        event.key === "j" ||
        event.key === "k" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        setFocusedId((current) => {
          if (filteredAlerts.length === 0) {
            return current;
          }
          const index = filteredAlerts.findIndex((alert) => alert.id === current);
          const isForward = event.key === "j" || event.key === "ArrowDown";
          const nextIndex = isForward
            ? index < 0
              ? 0
              : Math.min(filteredAlerts.length - 1, index + 1)
            : Math.max(0, (index < 0 ? 0 : index) - 1);
          const nextAlert = filteredAlerts[nextIndex];
          if (nextAlert) {
            markAlertRead(
              nextAlert.id,
              nextAlert.fired_at ?? new Date().toISOString(),
              nextAlert.issue_id,
            );
            return nextAlert.id;
          }
          return current;
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

  const parsedHistoryQuery = parseQuery(query);
  const hasAnyAlerts = safeAlerts.length > 0;
  const hasStructuredFilters =
    Boolean(parsedHistoryQuery.lifecycle) ||
    Boolean(parsedHistoryQuery.viewModifier) ||
    Boolean(parsedHistoryQuery.escalating) ||
    Boolean(parsedHistoryQuery.environment) ||
    Boolean(parsedHistoryQuery.release) ||
    Boolean(historyRuleName);

  const projectSlug = activeProject?.slug ?? "checkout-web";

  const openCreateRule = useCallback(() => {
    setEditingRuleId(null);
    setCreateRuleOpen(true);
  }, []);

  const openEditRule = useCallback(() => {
    if (!activeRuleId) return;
    setEditingRuleId(activeRuleId);
    setCreateRuleOpen(true);
  }, [activeRuleId]);

  const openEditRuleById = useCallback((ruleId: string) => {
    setEditingRuleId(ruleId);
    setCreateRuleOpen(true);
  }, []);

  return (
    <PageShell density="full-bleed">
      {projectsLoading ? (
        <FeedListBody>
          <StackedCardList>
            {Array.from({ length: 5 }).map((_, index) => (
              <AlertCardSkeleton key={index} />
            ))}
          </StackedCardList>
        </FeedListBody>
      ) : !activeProjectId ? (
        <FeedListBody>
          <Empty title="No project selected" description="Choose a project to view alerts." />
        </FeedListBody>
      ) : (
        <>
          <AlertsToolbar
            section={section}
            onSectionChange={(next) => {
              setSection(next);
              if (next === "configure") {
                setHistoryRuleFocus(null);
              } else {
                setActiveRuleId(null);
              }
            }}
            sectionCounts={{
              rules: ruleCount,
              history: historyUnreadCount,
            }}
            canManageRules={canManageWebhooks}
            onCreateRule={canManageWebhooks ? openCreateRule : undefined}
            onEditRule={canManageWebhooks ? openEditRule : undefined}
            editRuleDisabled={!activeRuleId}
            query={query}
            onQueryChange={setQuery}
            rulesSearch={rulesSearch}
            onRulesSearchChange={setRulesSearch}
            rulesStatusFilter={rulesStatusFilter}
            onRulesStatusFilterChange={setRulesStatusFilter}
            rulesDestinationFilter={rulesDestinationFilter}
            onRulesDestinationFilterChange={setRulesDestinationFilter}
            activeRulesCount={activeRuleCount}
            totalRulesCount={ruleCount}
            timeWindow={timeWindow}
            onTimeWindowChange={handleTimeWindowChange}
            issueSort={issueSort}
            onIssueSortChange={setIssueSort}
            headlineStats={alertFilterStats}
            historyRuleName={historyRuleName}
            onHistoryRuleNameClear={() => setHistoryRuleFocus(null)}
          />

          <CreateAlertRuleDialog
            open={createRuleOpen}
            projectId={activeProjectId}
            ruleId={editingRuleId}
            onOpenChange={(next) => {
              setCreateRuleOpen(next);
              if (!next) setEditingRuleId(null);
            }}
            onCreated={() => setRulesVersion((value) => value + 1)}
          />

          {section === "configure" ? (
            <div className={cn("flex min-h-0 flex-1 flex-col overflow-auto py-4", INBOX_FEED_BODY_PAD_CLASS)}>
                <AlertRulesManager
                  ref={rulesManagerRef}
                  projectId={activeProjectId}
                  projectSlug={projectSlug}
                  canManage={canManageWebhooks}
                  query={rulesSearch}
                  statusFilter={rulesStatusFilter}
                  destinationFilter={rulesDestinationFilter}
                  activeRuleId={activeRuleId}
                  onActiveRuleIdChange={setActiveRuleId}
                  onEditRule={(rule) => openEditRuleById(rule.id)}
                  onViewHistory={(focus) => {
                    setSection("history");
                    setHistoryRuleFocus(focus);
                  }}
                  lastTriggered={buildLastTriggeredByKind(safeAlerts)}
                  firedCounts={buildRuleFiredCounts(safeAlerts)}
                />
            </div>
          ) : null}

          {section === "history" ? (
          <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

          <AlertsHistoryBulkBar
            selectedCount={selectedAlertIds.size}
            totalCount={filteredAlerts.length}
            allSelected={allFilteredSelected}
            someSelected={someFilteredSelected}
            availability={bulkAvailability}
            busy={bulkBusy}
            canJumpToIssue={
              selectedAlertIds.size === 1 &&
              Boolean(
                filteredAlerts.find(
                  (row) =>
                    row.id === [...selectedAlertIds][0] &&
                    row.issue_id &&
                    row.kind !== "ingest_cap_hit",
                ),
              )
            }
            onToggleSelectAll={toggleSelectAllFiltered}
            onClear={() => setSelectedAlertIds(new Set())}
            onResolve={() => void applyBulkPatch({ read: true })}
            onMarkRead={() => {
              markReadMany(
                [...selectedAlertIds].map((alertId) => {
                  const row = alerts.find((item) => item.id === alertId);
                  return {
                    alertId,
                    issueId: row?.issue_id ?? null,
                  };
                }),
              );
              toast(
                `Marked ${selectedAlertIds.size} alert${selectedAlertIds.size === 1 ? "" : "s"} as read`,
              );
              setSelectedAlertIds(new Set());
            }}
            onSnooze={() => void applyBulkPatch({ ignored: true })}
            onUnsnooze={() => void applyBulkPatch({ ignored: false, read: false })}
            onReopen={() => void applyBulkPatch({ read: false })}
            onJumpToIssue={() => {
              const id = [...selectedAlertIds][0];
              const row = filteredAlerts.find((alert) => alert.id === id);
              if (!row || !activeProjectId) return;
              const href = getIssueLink(row, activeProjectId);
              navigate(href);
            }}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div
            className={cn(
              "epure-issues-layout__list flex min-h-0 min-w-0 flex-col overflow-hidden bg-canvas epure-page-gutter-x pt-3 md:pt-4 lg:basis-0 lg:flex-1 lg:border-r lg:border-border-subtle",
              focusedId && "max-lg:hidden",
            )}
          >
            <div className="mb-3 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
            {loading ? (
              <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <AlertCardSkeleton key={index} />
                ))}
              </ul>
            ) : error ? (
              <div className="space-y-3 px-1">
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
                  parsedHistoryQuery.lifecycle === "unresolved"
                    ? "Caught up"
                    : parsedHistoryQuery.lifecycle === "resolved"
                      ? "Nothing resolved yet"
                      : parsedHistoryQuery.viewModifier === "snoozed"
                        ? "Nothing snoozed"
                        : "No activity in this window"
                }
                description={
                  parsedHistoryQuery.lifecycle === "unresolved"
                    ? "No alerts needing review in this range."
                    : parsedHistoryQuery.lifecycle === "resolved"
                      ? "No resolved alerts in this range."
                      : parsedHistoryQuery.viewModifier === "snoozed"
                        ? "No alerts are currently snoozed."
                        : "Try widening the time range or adjusting filters."
                }
              >
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {hasStructuredFilters || historyRuleName ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setHistoryRuleFocus(null);
                        setQuery(resetQuery());
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={projectPath(activeProjectId, "issues")}>Open Issues</Link>
                  </Button>
                </div>
              </Empty>
            ) : (
              <div
                ref={alertListRef}
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto pb-2"
              >
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                  {filteredAlerts.length} alert{filteredAlerts.length === 1 ? "" : "s"} in view
                </p>
                {(groupedAlerts ?? []).map((group) => (
                  <AlertsDayGroup key={group.key} label={group.label} count={group.alerts?.length ?? 0}>
                    {(group.alerts ?? []).map((alert, alertIdx) =>
                      alert ? (
                        <AlertListRow
                          key={alert.id || `alert-${alertIdx}`}
                          alert={alert}
                          unread={isAlertInboxUnread(alert)}
                          detailActive={alert.id === focusedId}
                          bulkSelected={selectedAlertIds.has(alert.id)}
                          selectionActive={selectedAlertIds.size > 0}
                          onBulkSelectChange={(checked, options) =>
                            handleBulkSelect(alert.id, checked, options)
                          }
                          onActivate={() => {
                            setFocusedId(alert.id);
                            markAlertRead(
                              alert.id,
                              alert.fired_at ?? new Date().toISOString(),
                              alert.issue_id,
                            );
                          }}
                        />
                      ) : null,
                    )}
                  </AlertsDayGroup>
                ))}
              </div>
            )}
            </div>
          </div>

          <aside
            aria-label="Alert detail"
            className={cn(
              "hidden min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden border-t border-border-subtle bg-surface-1 lg:flex lg:basis-0 lg:flex-1 lg:border-t-0",
              focusedId && "max-lg:flex",
            )}
          >
            <AlertDetailPanel
              className="min-h-0 flex-1"
              alert={focusedAlert}
              projectId={activeProjectId ?? ""}
              webhookCount={webhookCount}
              busy={busyId != null}
              canManageRules={canManageWebhooks}
              onEditRule={canManageWebhooks ? openEditRuleById : undefined}
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
              onBackToList={() => setFocusedId(null)}
            />
          </aside>
          </div>
          </div>
          </>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
