import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  bulkUpdateIssues,
  EVENTS_PAGE_SIZE,
  fetchEvents,
  fetchIssueReleases,
  fetchIssueTimeline,
  fetchHeadlineStats,
  fetchIssues,
  fetchMergedChildren,
  fetchSetupProgress,
  mergeIssues,
  patchIssue,
  patchSetupProgress,
  snoozeIssue,
  splitIssues,
  type SnoozeMode,
  type EventDetail,
  type HeadlineStats,
  type IssueSummary,
  type IssueTimeline,
  type SetupProgress,
} from "../../lib/api";
import { apiErrorMessage, isApiError } from "../../lib/api-error";
import { projectPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { useIssuesLayoutMode } from "../../lib/style-theme";
import { useFocusQueryListener } from "../../shell/command-palette";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { IssuePriorityBadge } from "../../ui/issue-priority";
import { ActionButton } from "../../ui/action-button";
import { BreadcrumbTimeline } from "../../ui/breadcrumb-timeline";
import { ErrorState, ForbiddenState } from "../../ui/error-state";
import { IssueDetailOverlay } from "../../ui/issue-detail-overlay";
import { IssueDetailTabs, type IssueDetailTab } from "../../ui/issue-detail-tabs";
import { IssueOverviewPanel } from "../../ui/issue-overview-panel";
import { IssueMorePanel } from "../../ui/issue-more-panel";
import type { TimelineWindowValue } from "../../ui/issue-occurrence-timeline";
import { SetupChecklist } from "../../ui/setup-checklist";
import { SetupWaitingPanel } from "../../ui/setup-waiting-panel";
import { IssueRowSkeleton } from "../../ui/skeleton";
import { StackTracePanel } from "../../ui/stack-trace-panel";
import { useToast } from "../../ui/toast-provider";
import { BulkActions } from "./bulk-actions";
import { BulkDeleteDialog } from "./bulk-delete-dialog";
import { DiffPanel, type DiffMode } from "./diff-panel";
import {
  applyOptimisticSnooze,
  bulkTriageAvailability,
  canIgnoreIssue,
  canReopenIssue,
  canResolveIssue,
  canSnoozeIssue,
} from "./issue-triage-utils";
import { copyIssueExport, useExportHotkey } from "./export-markdown";
import { IssueList } from "./issue-list";
import { IssuesFeedHeader } from "./issues-feed-header";
import {
  DEFAULT_ISSUE_SORT,
  DEFAULT_TIME_WINDOW,
  parseIssueSort,
  parseTimeWindow,
  setToken,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";
import { registerIssuesTriage } from "./triage-bridge";
import { SnoozeMenu } from "./snooze-menu";
import { useIssueReadState } from "./use-issue-read-state";
import { useResizableIssueDetail } from "./use-resizable-issue-detail";

const DEFAULT_QUERY = "is:unresolved";

export function IssuesPage() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { buildQuery, projectId, environment, projects, setEnvironment } = useAppContext();
  const scopedProjectId = routeProjectId ?? projectId;
  const timeWindow = parseTimeWindow(searchParams.get("window"));
  const issueSort = parseIssueSort(searchParams.get("sort"));
  const urlIssueId = searchParams.get("issue");
  const filterInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? DEFAULT_QUERY);
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadForbidden, setLoadForbidden] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(urlIssueId);
  const [selectedId, setSelectedId] = useState<string | null>(urlIssueId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [events, setEvents] = useState<EventDetail[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventRecord, setSelectedEventRecord] = useState<EventDetail | null>(null);
  const [diffEventId, setDiffEventId] = useState<string | null>(null);
  const [mergedChildren, setMergedChildren] = useState<IssueSummary[]>([]);
  const [issueReleases, setIssueReleases] = useState<string[]>([]);
  const [diffMode, setDiffMode] = useState<DiffMode>("occurrence");
  const [leftRelease, setLeftRelease] = useState<string | null>(null);
  const [rightRelease, setRightRelease] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { toast } = useToast();
  const [setup, setSetup] = useState<SetupProgress | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [testSent, setTestSent] = useState(false);
  const celebratedFirstIssue = useRef(false);
  const [detailTab, setDetailTab] = useState<IssueDetailTab>("overview");
  const [timeline, setTimeline] = useState<IssueTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindowValue>("7d");
  const [headlineStats, setHeadlineStats] = useState<HeadlineStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const {
    width: detailWidth,
    isFullscreen: detailFullscreen,
    isResizing: detailResizing,
    toggleFullscreen: toggleDetailFullscreen,
    startResize: startDetailResize,
  } = useResizableIssueDetail();

  const { isUnread: isIssueUnread, markRead: markIssueRead } = useIssueReadState(projectId);

  const activeIssueId = selectedId ?? focusedId;

  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedId) ?? null,
    [issues, selectedId],
  );

  const focusedIssue = useMemo(
    () => issues.find((issue) => issue.id === focusedId) ?? null,
    [issues, focusedId],
  );

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    markIssueRead(selectedId);
  }, [markIssueRead, selectedId, selectedIssue?.last_seen_at]);

  const selectedEvent = useMemo(() => {
    if (selectedEventRecord?.id === selectedEventId) {
      return selectedEventRecord;
    }
    return events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;
  }, [events, selectedEventId, selectedEventRecord]);

  const handleSelectEvent = useCallback((eventId: string, event?: EventDetail) => {
    setSelectedEventId(eventId);
    if (event) {
      setSelectedEventRecord(event);
      setEvents((rows) => {
        if (rows.some((row) => row.id === eventId)) {
          return rows;
        }
        return [event, ...rows];
      });
      return;
    }
    const resolved = events.find((row) => row.id === eventId);
    if (resolved) {
      setSelectedEventRecord(resolved);
    }
  }, [events]);

  const loadIssues = useCallback(async (nextQuery: string, window: TimeWindowValue, sort: IssueSortValue) => {
    setLoading(true);
    setLoadError(null);
    setLoadForbidden(false);
    try {
      const scopedQuery = buildQuery(nextQuery);
      const rows = await fetchIssues(
        scopedQuery,
        projectId ?? undefined,
        window,
        sort === DEFAULT_ISSUE_SORT ? undefined : sort,
      );
      setIssues(rows);
      setFocusedId((current) => {
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }
        if (current && current === urlIssueId) {
          return current;
        }
        return null;
      });
      setSelectedId((current) => {
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }
        if (current && current === urlIssueId) {
          return current;
        }
        return null;
      });
    } catch (error) {
      setIssues([]);
      if (isApiError(error, 403)) {
        setLoadForbidden(true);
      } else {
        const message = apiErrorMessage(error, "Failed to load issues");
        setLoadError(message);
        toast(message);
      }
    } finally {
      setLoading(false);
    }
  }, [buildQuery, projectId, toast, urlIssueId]);

  const setTimeWindow = useCallback(
    (nextWindow: TimeWindowValue) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (nextWindow === DEFAULT_TIME_WINDOW) {
            params.delete("window");
          } else {
            params.set("window", nextWindow);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setIssueSort = useCallback(
    (nextSort: IssueSortValue) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (nextSort === DEFAULT_ISSUE_SORT) {
            params.delete("sort");
          } else {
            params.set("sort", nextSort);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    const urlQuery = searchParams.get("q");
    if (urlQuery !== null) {
      setQuery(urlQuery.trim() || DEFAULT_QUERY);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadIssues(query, timeWindow, issueSort);
  }, [loadIssues, query, environment, projectId, timeWindow, issueSort]);

  useEffect(() => {
    if (!urlIssueId || loading) {
      return;
    }

    if (issues.some((issue) => issue.id === urlIssueId)) {
      setSelectedId(urlIssueId);
      setFocusedId(urlIssueId);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const broadRows = await fetchIssues("", projectId ?? undefined, "90d");
        if (cancelled) {
          return;
        }
        const found = broadRows.find((row) => row.id === urlIssueId);
        if (found) {
          setIssues((rows) =>
            rows.some((row) => row.id === found.id) ? rows : [found, ...rows],
          );
          setSelectedId(urlIssueId);
          setFocusedId(urlIssueId);
          return;
        }

        await fetchEvents(urlIssueId, { limit: 1, offset: 0 });
        if (!cancelled) {
          toast("Issue not found — it may have been deleted");
          setSelectedId(null);
          setFocusedId(null);
          setSearchParams(
            (current) => {
              const params = new URLSearchParams(current);
              params.delete("issue");
              return params;
            },
            { replace: true },
          );
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (isApiError(error, 404)) {
          toast("Issue not found — it may have been deleted");
          setSelectedId(null);
          setFocusedId(null);
          setSearchParams(
            (current) => {
              const params = new URLSearchParams(current);
              params.delete("issue");
              return params;
            },
            { replace: true },
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urlIssueId, loading, issues, projectId, setSearchParams, toast]);

  useEffect(() => {
    const current = searchParams.get("issue");
    if (selectedId === current || (!selectedId && !current)) {
      return;
    }
    setSearchParams(
      (currentParams) => {
        const params = new URLSearchParams(currentParams);
        if (selectedId) {
          params.set("issue", selectedId);
        } else {
          params.delete("issue");
        }
        return params;
      },
      { replace: true },
    );
  }, [selectedId, searchParams, setSearchParams]);

  useEffect(() => {
    if (!projectId) {
      setHeadlineStats(null);
      setStatsLoading(false);
      return;
    }
    setStatsLoading(true);
    void fetchHeadlineStats(projectId, environment ?? undefined, timeWindow)
      .then(setHeadlineStats)
      .catch(() => setHeadlineStats(null))
      .finally(() => setStatsLoading(false));
  }, [projectId, environment, timeWindow]);

  useEffect(() => {
    if (!projectId) {
      setSetup(null);
      setSetupLoading(false);
      setTestSent(false);
      return;
    }
    setSetupLoading(true);
    setTestSent(localStorage.getItem(`epure.setup.testSent.${projectId}`) === "1");
    void fetchSetupProgress(projectId)
      .then(setSetup)
      .catch(() => setSetup(null))
      .finally(() => setSetupLoading(false));
  }, [projectId]);

  const markTestSent = useCallback(() => {
    if (!projectId) {
      return;
    }
    localStorage.setItem(`epure.setup.testSent.${projectId}`, "1");
    setTestSent(true);
  }, [projectId]);

  const waitingForFirstIssue =
    Boolean(
      setup &&
        !setup.complete &&
        setup.project_named &&
        setup.dsn_copied_at,
    );

  useEffect(() => {
    if (!waitingForFirstIssue || issues.length > 0 || loading) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void loadIssues(query, timeWindow, issueSort);
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [issueSort, issues.length, loadIssues, loading, query, timeWindow, waitingForFirstIssue]);

  useEffect(() => {
    if (!projectId || !setup || setup.complete || issues.length === 0) {
      return;
    }
    if (!celebratedFirstIssue.current) {
      celebratedFirstIssue.current = true;
      toast("First issue received — you're live!");
    }
    void patchSetupProgress({ project_id: projectId, first_issue_seen: true })
      .then(setSetup)
      .catch(() => {
        // ignore
      });
  }, [issues.length, projectId, setup, toast]);

  useFocusQueryListener(() => {
    window.requestAnimationFrame(() => filterInputRef.current?.focus());
  });

  useEffect(() => {
    if (!selectedId) {
      setEvents([]);
      setSelectedEventId(null);
      setSelectedEventRecord(null);
      setDiffEventId(null);
      return;
    }

    let cancelled = false;
    void fetchEvents(selectedId, { limit: EVENTS_PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (cancelled) {
          return;
        }
        setEvents(page.events);
        setSelectedEventId((current) => {
          if (current && page.events.some((event) => event.id === current)) {
            return current;
          }
          return page.events[0]?.id ?? null;
        });
        setSelectedEventRecord((current) => {
          if (current && page.events.some((event) => event.id === current.id)) {
            return current;
          }
          return page.events[0] ?? null;
        });
        setDiffEventId(null);
      })
      .catch(() => {
        if (!cancelled) {
          toast("Failed to load events");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setTimeline(null);
      setTimelineLoading(false);
      return;
    }

    let cancelled = false;
    setTimelineLoading(true);
    void fetchIssueTimeline(selectedId, timelineWindow)
      .then((data) => {
        if (!cancelled) {
          setTimeline(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTimeline(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTimelineLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, timelineWindow]);

  useEffect(() => {
    setTimelineWindow("7d");
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setMergedChildren([]);
      setIssueReleases([]);
      setLeftRelease(null);
      setRightRelease(null);
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetchMergedChildren(selectedId),
      fetchIssueReleases(selectedId),
    ])
      .then(([children, releases]) => {
        if (cancelled) {
          return;
        }
        setMergedChildren(children);
        setIssueReleases(releases);
        setLeftRelease(releases[0] ?? null);
        setRightRelease(releases[1] ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setMergedChildren([]);
          setIssueReleases([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const actionsDisabled = busy || patchingId !== null || snoozingId !== null;

  const optimisticStatus = useCallback(
    async (id: string, status: string, resolvedInRelease?: string) => {
      if (busy || patchingId !== null) {
        return;
      }
      const previous = issues;
      setPatchingId(id);
      setIssues((rows) =>
        rows.map((row) => (row.id === id ? { ...row, status } : row)),
      );
      try {
        await patchIssue(id, status, resolvedInRelease);
      } catch {
        setIssues(previous);
        toast("Failed to update issue");
      } finally {
        setPatchingId(null);
      }
    },
    [busy, issues, patchingId, toast],
  );

  const handleResolve = useCallback(
    (id: string) => {
      const issue = issues.find((row) => row.id === id);
      if (!issue || !canResolveIssue(issue.status)) {
        return;
      }
      const release = issue.release ?? undefined;
      void optimisticStatus(id, "resolved", release);
    },
    [issues, optimisticStatus],
  );

  const handleIgnore = useCallback(
    (id: string) => {
      const issue = issues.find((row) => row.id === id);
      if (!issue || !canIgnoreIssue(issue.status)) {
        return;
      }
      void optimisticStatus(id, "ignored");
    },
    [issues, optimisticStatus],
  );

  const handleReopen = useCallback(
    (id: string) => {
      const issue = issues.find((row) => row.id === id);
      if (!issue || !canReopenIssue(issue.status)) {
        return;
      }
      void optimisticStatus(id, "unresolved");
    },
    [issues, optimisticStatus],
  );

  const handleSnooze = useCallback(
    async (mode: SnoozeMode) => {
      if (!selectedId || actionsDisabled) {
        return;
      }
      const current = issues.find((row) => row.id === selectedId);
      if (!current) {
        return;
      }

      const previous = issues;
      const optimistic = applyOptimisticSnooze(current, mode);
      setSnoozingId(selectedId);
      setIssues((rows) =>
        rows.map((row) => (row.id === selectedId ? optimistic : row)),
      );

      try {
        const updated = await snoozeIssue(selectedId, mode);
        setIssues((rows) =>
          rows.map((row) => (row.id === selectedId ? updated : row)),
        );
        toast(
          updated.snoozed
            ? "Issue snoozed"
            : "Snooze did not apply — try another duration",
        );
      } catch {
        setIssues(previous);
        toast("Failed to snooze issue");
      } finally {
        setSnoozingId(null);
      }
    },
    [actionsDisabled, issues, selectedId, toast],
  );

  const handleMoveSelection = useCallback(
    (direction: "up" | "down") => {
      if (issues.length === 0) {
        return;
      }
      const index = issues.findIndex((issue) => issue.id === focusedId);
      const start = index >= 0 ? index : 0;
      const next =
        direction === "down"
          ? Math.min(start + 1, issues.length - 1)
          : Math.max(start - 1, 0);
      setFocusedId(issues[next]?.id ?? null);
    },
    [issues, focusedId],
  );

  const handleOpenDetail = useCallback(() => {
    if (focusedId) {
      setSelectedId(focusedId);
      return;
    }
    if (issues.length > 0) {
      const firstId = issues[0].id;
      setFocusedId(firstId);
      setSelectedId(firstId);
    }
  }, [focusedId, issues]);

  const handleSelect = useCallback(
    (id: string, extend = false) => {
      setFocusedId(id);
      setSelectedId(id);
      if (extend) {
        setSelectedIds((current) => {
          const next = new Set(current);
          next.add(id);
          return next;
        });
      }
    },
    [],
  );

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedIssues = useMemo(
    () => issues.filter((issue) => selectedIds.has(issue.id)),
    [issues, selectedIds],
  );
  const bulkAvailability = useMemo(
    () => bulkTriageAvailability(selectedIssues),
    [selectedIssues],
  );

  const handleBulkSnooze = useCallback(
    async (mode: SnoozeMode) => {
      const eligible = selectedIssues.filter(canSnoozeIssue);
      if (eligible.length === 0 || actionsDisabled) {
        return;
      }

      const ids = new Set(eligible.map((issue) => issue.id));
      const previous = issues;
      setBusy(true);
      setIssues((rows) =>
        rows.map((row) => (ids.has(row.id) ? applyOptimisticSnooze(row, mode) : row)),
      );

      try {
        await Promise.all(eligible.map((issue) => snoozeIssue(issue.id, mode)));
        setSelectedIds(new Set());
        await loadIssues(query, timeWindow, issueSort);
        toast(
          eligible.length === 1
            ? "Issue snoozed"
            : `Snoozed ${eligible.length} issues`,
        );
      } catch {
        setIssues(previous);
        toast("Bulk snooze failed");
      } finally {
        setBusy(false);
      }
    },
    [
      actionsDisabled,
      issueSort,
      issues,
      loadIssues,
      query,
      selectedIssues,
      timeWindow,
      toast,
    ],
  );

  const handleBulk = useCallback(
    async (action: "resolve" | "ignore" | "reopen" | "delete") => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0 || actionsDisabled) {
        return;
      }
      setBusy(true);
      try {
        await bulkUpdateIssues(ids, action);
        setSelectedIds(new Set());
        await loadIssues(query, timeWindow, issueSort);
        const labels: Record<string, string> = {
          delete: `Deleted ${ids.length} issues`,
          resolve: `Marked ${ids.length} issues resolved`,
          ignore: `Ignored ${ids.length} issues`,
          reopen: `Reopened ${ids.length} issues`,
        };
        toast(labels[action]);
      } catch {
        toast("Bulk action failed");
      } finally {
        setBusy(false);
      }
    },
    [actionsDisabled, loadIssues, query, selectedIds, timeWindow, issueSort],
  );

  const handleConfirmBulkDelete = useCallback(() => {
    void handleBulk("delete").finally(() => setDeleteConfirmOpen(false));
  }, [handleBulk]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((current) => {
      if (current.size === issues.length && issues.length > 0) {
        return new Set();
      }
      return new Set(issues.map((issue) => issue.id));
    });
  }, [issues]);

  const openMoreGrouping = useCallback(() => setDetailTab("more"), []);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleMerge = useCallback(async () => {
    if (!selectedId || actionsDisabled) {
      return;
    }
    const mergeIds = Array.from(selectedIds).filter((id) => id !== selectedId);
    if (mergeIds.length === 0) {
      return;
    }
    setBusy(true);
    try {
      await mergeIssues(selectedId, mergeIds);
      setSelectedIds(new Set());
      await loadIssues(query, timeWindow, issueSort);
      toast(`Merged ${mergeIds.length} issues`);
    } catch {
      toast("Merge failed");
    } finally {
      setBusy(false);
    }
  }, [actionsDisabled, loadIssues, query, selectedId, selectedIds, timeWindow, issueSort]);

  const handleSplit = useCallback(
    async (splitIds: string[]) => {
      if (!selectedId || splitIds.length === 0 || actionsDisabled) {
        return;
      }
      setBusy(true);
      try {
        await splitIssues(selectedId, splitIds);
        setMergedChildren([]);
        await loadIssues(query, timeWindow, issueSort);
        toast(`Split ${splitIds.length} issues`);
      } catch {
        toast("Split failed");
      } finally {
        setBusy(false);
      }
    },
    [actionsDisabled, loadIssues, query, selectedId, timeWindow, issueSort],
  );

  const applyFilter = useCallback((token: string) => {
    setQuery((current) => setToken(current, token));
  }, []);

  const handleResetFilters = useCallback(() => {
    setQuery(DEFAULT_QUERY);
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete("q");
        params.delete("window");
        params.delete("sort");
        return params;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const needsSetupRedirect =
    !setupLoading &&
    projectId &&
    setup &&
    !setup.complete &&
    (!setup.project_named || !setup.dsn_copied_at);

  const setupIncomplete =
    setup && !setup.complete && setup.project_named && Boolean(setup.dsn_copied_at);

  const showSetupEmpty =
    !loading &&
    issues.length === 0 &&
    query === DEFAULT_QUERY &&
    setupIncomplete;

  const layoutMode = useIssuesLayoutMode();
  const isOverlayLayout = layoutMode === "overlay";

  const handleExport = useCallback(() => {
    if (!selectedIssue) {
      return;
    }
    void copyIssueExport(selectedIssue, selectedEvent).then(() =>
      toast("Copied — paste into Cursor or your AI assistant"),
    );
  }, [selectedEvent, selectedIssue]);

  useExportHotkey(Boolean(selectedIssue), selectedIssue, selectedEvent, () => {
    toast("Copied — paste into Cursor or your AI assistant");
  });

  useEffect(() => {
    const triageIssue = selectedIssue ?? focusedIssue;
    registerIssuesTriage({
      active: true,
      busy: actionsDisabled,
      hasSelectedIssue: Boolean(triageIssue),
      selectedCount: selectedIds.size,
      canResolve: triageIssue ? canResolveIssue(triageIssue.status) : false,
      canIgnore: triageIssue ? canIgnoreIssue(triageIssue.status) : false,
      canReopen: triageIssue ? canReopenIssue(triageIssue.status) : false,
      canMerge: selectedIds.size >= 2 && Boolean(activeIssueId) && !actionsDisabled,
      handlers: {
        applyFilter,
        resolveSelected: () => {
          if (activeIssueId) {
            handleResolve(activeIssueId);
          }
        },
        ignoreSelected: () => {
          if (activeIssueId) {
            handleIgnore(activeIssueId);
          }
        },
        reopenSelected: () => {
          if (activeIssueId) {
            handleReopen(activeIssueId);
          }
        },
        exportSelected: handleExport,
        openDiff: () => setDetailTab("more"),
        mergeSelected: () => void handleMerge(),
      },
    });
    return () => registerIssuesTriage(null);
  }, [
    actionsDisabled,
    applyFilter,
    handleExport,
    handleIgnore,
    handleMerge,
    handleReopen,
    handleResolve,
    activeIssueId,
    focusedIssue,
    selectedIds.size,
    selectedIssue,
  ]);

  useEffect(() => {
    setDetailTab("overview");
  }, [selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (selectedId) {
        event.preventDefault();
        setSelectedId(null);
        return;
      }
      if (selectedIds.size > 0) {
        event.preventDefault();
        setSelectedIds(new Set());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, selectedIds.size]);

  if (needsSetupRedirect && scopedProjectId) {
    return <Navigate to={projectPath(scopedProjectId, "setup")} replace />;
  }

  const filtersActive =
    query !== DEFAULT_QUERY ||
    timeWindow !== DEFAULT_TIME_WINDOW ||
    issueSort !== DEFAULT_ISSUE_SORT;

  const canMerge = selectedIds.size >= 2 && Boolean(selectedId);
  const canSplit = Boolean(selectedId) && mergedChildren.length > 0;
  const allSelected = issues.length > 0 && selectedIds.size === issues.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const issueDetailContent = selectedIssue ? (
    <>
      <IssueDetailTabs
        tab={detailTab}
        onTabChange={setDetailTab}
        onClose={handleCloseDetail}
        showBackLink={!isOverlayLayout}
        issueTitle={selectedIssue.title ?? "Untitled issue"}
        statusBadges={
          <>
            <IssuePriorityBadge
              level={selectedIssue.level}
              status={selectedIssue.status}
              compact
            />
            <Badge
              size="compact"
              variant={
                selectedIssue.status === "resolved"
                  ? "resolved"
                  : selectedIssue.status === "regression"
                    ? "warning"
                    : "env"
              }
            >
              {selectedIssue.status}
            </Badge>
            {selectedIssue.status === "regression" ? (
              <Badge size="compact" variant="warning">Came back</Badge>
            ) : null}
            {selectedIssue.snoozed ? (
              <Badge size="compact" variant="info">Snoozed</Badge>
            ) : null}
          </>
        }
        actions={
          <>
            {canResolveIssue(selectedIssue.status) ? (
              <ActionButton
                variant="primary"
                size="toolbar"
                disabled={actionsDisabled}
                tooltip={actionsDisabled ? "Saving changes…" : undefined}
                onClick={() => void handleResolve(selectedIssue.id)}
              >
                {patchingId === selectedIssue.id ? "Saving…" : "Resolve"}
              </ActionButton>
            ) : null}
            {canIgnoreIssue(selectedIssue.status) ? (
              <ActionButton
                variant="ghost"
                size="toolbar"
                disabled={actionsDisabled}
                tooltip={actionsDisabled ? "Saving changes…" : undefined}
                onClick={() => void handleIgnore(selectedIssue.id)}
              >
                Ignore
              </ActionButton>
            ) : null}
            {canReopenIssue(selectedIssue.status) ? (
              <ActionButton
                variant="ghost"
                size="toolbar"
                disabled={actionsDisabled}
                tooltip={actionsDisabled ? "Saving changes…" : undefined}
                onClick={() => void handleReopen(selectedIssue.id)}
              >
                {patchingId === selectedIssue.id ? "Saving…" : "Unresolve"}
              </ActionButton>
            ) : null}
            <SnoozeMenu
              issue={selectedIssue}
              disabled={actionsDisabled}
              onSnooze={handleSnooze}
            />
            <ActionButton
              variant="ghost"
              size="toolbar"
              disabled={actionsDisabled}
              tooltip={actionsDisabled ? "Saving changes…" : undefined}
              onClick={handleExport}
            >
              Copy for AI
            </ActionButton>
          </>
        }
        overview={
          <IssueOverviewPanel
            issue={selectedIssue}
            event={selectedEvent}
            events={events}
            timeline={timeline}
            timelineLoading={timelineLoading}
            timelineWindow={timelineWindow}
            onTimelineWindowChange={setTimelineWindow}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
          />
        }
        stack={
          <StackTracePanel
            events={events}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            onSelectEvent={handleSelectEvent}
            onViewGrouping={openMoreGrouping}
          />
        }
        breadcrumbs={
          <BreadcrumbTimeline
            events={events}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            onSelectEvent={handleSelectEvent}
          />
        }
        more={
          <IssueMorePanel
            issue={selectedIssue}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            selectedEvent={selectedEvent}
            diffSection={
              <DiffPanel
                issueId={selectedIssue.id}
                mode={diffMode}
                onModeChange={setDiffMode}
                events={events}
                leftEventId={selectedEventId}
                rightEventId={diffEventId}
                onRightEventChange={setDiffEventId}
                releases={issueReleases}
                leftRelease={leftRelease}
                rightRelease={rightRelease}
                onLeftReleaseChange={setLeftRelease}
                onRightReleaseChange={setRightRelease}
              />
            }
            mergedChildren={mergedChildren}
            onSplit={(splitIds) => void handleSplit(splitIds)}
            busy={busy}
          />
        }
      />
    </>
  ) : null;

  if (loadForbidden) {
    return (
      <ForbiddenState
        title="Access denied"
        description="You do not have permission to view issues in this project."
        backHref={scopedProjectId ? projectPath(scopedProjectId, "issues") : "/"}
        backLabel="Back to workspace"
      />
    );
  }

  if (showSetupEmpty && scopedProjectId) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-auto">
        {setup ? (
          <SetupChecklist
            projectNamed={setup.project_named}
            dsnCopied={Boolean(setup.dsn_copied_at)}
            testSent={testSent}
            firstIssueSeen={Boolean(setup.first_issue_seen_at)}
            complete={setup.complete}
            onResumeSetup={() => navigate(projectPath(scopedProjectId, "setup"))}
          />
        ) : null}
        <SetupWaitingPanel
          projectId={scopedProjectId}
          environment={environment}
          onEnvironmentSync={() => setEnvironment("production")}
          testSent={testSent}
          onTestSent={markTestSent}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {setup && !setup.complete ? (
        <SetupChecklist
          projectNamed={setup.project_named}
          dsnCopied={Boolean(setup.dsn_copied_at)}
          testSent={testSent}
          firstIssueSeen={Boolean(setup.first_issue_seen_at)}
          complete={setup.complete}
          onResumeSetup={() =>
            scopedProjectId && navigate(projectPath(scopedProjectId, "setup"))
          }
        />
      ) : null}

      <IssuesFeedHeader
        query={query}
        onQueryChange={setQuery}
        onApply={() => void loadIssues(query, timeWindow, issueSort)}
        timeWindow={timeWindow}
        onTimeWindowChange={setTimeWindow}
        issueSort={issueSort}
        onIssueSortChange={setIssueSort}
        filterInputRef={filterInputRef}
        issueCount={issues.length}
        loading={loading}
        stats={headlineStats}
        statsLoading={statsLoading}
        onFilterToken={applyFilter}
      />

      <div
        className={cn(
          "epure-issues-layout relative flex min-h-0 flex-1 overflow-hidden",
          !isOverlayLayout && "lg:flex-row",
          issues.length === 0 && !loading && "epure-issues-layout--empty",
        )}
      >
        <aside
          className={cn(
            "epure-issues-layout__list flex min-h-0 flex-col overflow-hidden px-4 md:px-6",
            issues.length === 0 && !loading ? "w-full shrink-0 grow-0" : "min-h-0 flex-1",
            isOverlayLayout
              ? "min-w-0 flex-1 bg-bg"
              : layoutMode === "split-narrow"
                ? "w-full shrink-0 border-r border-border bg-bg lg:w-issue-list"
                : "w-full shrink-0 border-r border-border bg-surface-inset lg:w-issue-list",
            selectedIssue && (isOverlayLayout ? "hidden lg:flex" : "max-lg:hidden"),
          )}
        >
          <BulkActions
            selectedIds={selectedIds}
            availability={bulkAvailability}
            canMerge={canMerge}
            canSplit={canSplit}
            onResolve={() => void handleBulk("resolve")}
            onIgnore={() => void handleBulk("ignore")}
            onReopen={() => void handleBulk("reopen")}
            onSnooze={handleBulkSnooze}
            onDelete={() => setDeleteConfirmOpen(true)}
            onMerge={() => void handleMerge()}
            onSplit={() =>
              void handleSplit(mergedChildren.map((child) => child.id))
            }
            onClear={handleClearSelection}
            busy={actionsDisabled}
          />
          {loading ? (
            <div className="mb-3 flex min-h-0 min-w-0 w-full flex-1 flex-col">
              <div className="epure-issue-list flex min-h-0 flex-1 flex-col overflow-auto rounded-lg border border-border bg-surface">
                {Array.from({ length: 8 }).map((_, index) => (
                  <IssueRowSkeleton key={index} />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <ErrorState
                title="Could not load issues"
                description={loadError}
                onRetry={() => void loadIssues(query, timeWindow, issueSort)}
                retrying={loading}
                backHref={scopedProjectId ? projectPath(scopedProjectId, "issues") : "/"}
                backLabel="Back to workspace"
              />
            </div>
          ) : (
            <IssueList
              issues={issues}
              projects={projects}
              focusedId={focusedId}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onToggleSelect={handleToggleSelect}
              onResolve={handleResolve}
              onIgnore={handleIgnore}
              actionsDisabled={actionsDisabled}
              onMoveSelection={handleMoveSelection}
              onOpenDetail={handleOpenDetail}
              onFocusQuery={() => {
                window.requestAnimationFrame(() => filterInputRef.current?.focus());
              }}
              selectAllChecked={allSelected}
              selectAllIndeterminate={someSelected}
              onToggleSelectAll={issues.length > 0 ? handleToggleSelectAll : undefined}
              filtersActive={filtersActive}
              onResetFilters={handleResetFilters}
              isIssueUnread={isIssueUnread}
            />
          )}
        </aside>

        {isOverlayLayout ? (
          <IssueDetailOverlay
            open={Boolean(selectedIssue)}
            onClose={handleCloseDetail}
            width={detailWidth}
            isFullscreen={detailFullscreen}
            isResizing={detailResizing}
            onToggleFullscreen={toggleDetailFullscreen}
            onResizeStart={startDetailResize}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {issueDetailContent}
            </div>
          </IssueDetailOverlay>
        ) : selectedIssue ? (
          <aside
            className="epure-issues-layout__detail flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface"
            aria-label="Issue detail"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {issueDetailContent}
            </div>
          </aside>
        ) : null}
      </div>

      <BulkDeleteDialog
        count={selectedIds.size}
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={() => void handleConfirmBulkDelete()}
        busy={busy}
      />
    </div>
  );
}
