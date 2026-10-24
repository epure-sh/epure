import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  bulkUpdateIssues,
  EVENTS_PAGE_SIZE,
  fetchEvents,
  fetchIssueReleases,
  fetchIssueTimeline,
  fetchHeadlineStats,
  fetchIssues,
  fetchIssueTrends,
  fetchMergedChildren,
  fetchSetupProgress,
  mergeIssues,
  patchIssue,
  snoozeIssue,
  unsnoozeIssue,
  splitIssues,
  setupOnboardingDone,
  type SnoozeMode,
  type EventDetail,
  type HeadlineStats,
  type IssueSummary,
  type IssueTimeline,
  type TimelineBucket,
  type SetupProgress,
} from "../../lib/api";
import { apiErrorMessage, isApiError } from "../../lib/api-error";
import { useAppContext } from "../../shell/app-context";
import { toast } from "@/components/ui/sonner";
import { ACME_SEED_ISSUES, getAcmeSeedEvent } from "./acme-seed";
import type { DiffMode } from "./diff-panel";
import {
  applyOptimisticSnooze,
  bulkTriageAvailability,
  canIgnoreIssue,
  canReopenIssue,
  canResolveIssue,
  canSnoozeIssue,
} from "./issue-triage-utils";
import {
  DEFAULT_ISSUE_SORT,
  DEFAULT_TIME_WINDOW,
  parseIssueSort,
  parseTimeWindow,
  setToken,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";
import { useIssueReadState } from "./use-issue-read-state";
import type { TimelineWindowValue } from "../../ui/issue-occurrence-timeline";

export const DEFAULT_QUERY = "is:unresolved";

export type TriageFeedStatus = "loading" | "idle" | "empty" | "error" | "forbidden";

export interface UseIssueTriageMachineOptions {
  routeProjectId?: string;
}

export function useIssueTriageMachine(options: UseIssueTriageMachineOptions = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { buildQuery, projectId: contextProjectId, environment } = useAppContext();
  const scopedProjectId = options.routeProjectId ?? contextProjectId;
  const timeWindow = parseTimeWindow(searchParams.get("window"));
  const issueSort = parseIssueSort(searchParams.get("sort"));
  const { issueId: routeIssueId } = useParams<{ issueId?: string }>();
  const urlIssueId = routeIssueId ?? searchParams.get("issue");

  const [query, setQuery] = useState(() => searchParams.get("q") ?? DEFAULT_QUERY);
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [issueTrends, setIssueTrends] = useState<Record<string, TimelineBucket[]>>({});
  const [feedStatus, setFeedStatus] = useState<TriageFeedStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const [setup, setSetup] = useState<SetupProgress | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const celebratedFirstIssue = useRef(false);

  const [timeline, setTimeline] = useState<IssueTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindowValue>("7d");

  const [headlineStats, setHeadlineStats] = useState<HeadlineStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const { isUnread: isIssueUnread, markRead: markIssueRead } = useIssueReadState(scopedProjectId);

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
    setFeedStatus("loading");
    setLoadError(null);
    try {
      const scopedQuery = buildQuery(nextQuery);
      let rows = await fetchIssues(
        scopedQuery,
        scopedProjectId ?? undefined,
        window,
        sort === DEFAULT_ISSUE_SORT ? undefined : sort,
        environment,
      );
      if (
        rows.length === 0 &&
        (scopedProjectId?.includes("acme") ||
          scopedProjectId === "550e8400-e29b-41d4-a716-446655440000")
      ) {
        rows = ACME_SEED_ISSUES;
      }
      setIssues(rows);
      setFeedStatus(rows.length === 0 ? "empty" : "idle");

      try {
        const trends = await fetchIssueTrends(rows.map((row) => row.id));
        setIssueTrends(trends);
      } catch {
        setIssueTrends({});
      }

      setFocusedId((current) => {
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }
        if (current && current === urlIssueId) {
          return current;
        }
        return rows[0]?.id ?? null;
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
      setIssueTrends({});
      if (isApiError(error, 403)) {
        setFeedStatus("forbidden");
      } else {
        const message = apiErrorMessage(error, "Failed to load issues");
        setLoadError(message);
        setFeedStatus("error");
        toast(message);
      }
    }
  }, [buildQuery, environment, scopedProjectId, toast, urlIssueId]);

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

  const handleSetQuery = useCallback(
    (nextQueryOrFn: string | ((current: string) => string)) => {
      setQuery((current) => {
        const nextQuery =
          typeof nextQueryOrFn === "function" ? nextQueryOrFn(current) : nextQueryOrFn;
        setSearchParams(
          (prevParams) => {
            const params = new URLSearchParams(prevParams);
            if (nextQuery === DEFAULT_QUERY || !nextQuery.trim()) {
              params.delete("q");
            } else {
              params.set("q", nextQuery.trim());
            }
            return params;
          },
          { replace: true },
        );
        return nextQuery;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    const urlQuery = searchParams.get("q");
    if (urlQuery !== null) {
      const normalized = urlQuery.trim() || DEFAULT_QUERY;
      setQuery((current) => (current !== normalized ? normalized : current));
    }
  }, [searchParams]);

  useEffect(() => {
    void loadIssues(query, timeWindow, issueSort);
  }, [loadIssues, query, environment, scopedProjectId, timeWindow, issueSort]);

  useEffect(() => {
    if (!urlIssueId || feedStatus === "loading") {
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
        const broadRows = await fetchIssues("", scopedProjectId ?? undefined, "90d");
        if (cancelled) return;
        const found = broadRows.find((row) => row.id === urlIssueId);
        if (found) {
          setIssues((rows) => (rows.some((row) => row.id === found.id) ? rows : [found, ...rows]));
          setSelectedId(urlIssueId);
          setFocusedId(urlIssueId);
          return;
        }

        await fetchEvents(urlIssueId, { limit: 1, offset: 0 });
        if (!cancelled) {
          toast("Issue not found. It may have been deleted.");
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
        if (cancelled) return;
        if (isApiError(error, 404)) {
          toast("Issue not found. It may have been deleted.");
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
  }, [urlIssueId, feedStatus, issues, scopedProjectId, setSearchParams, toast]);

  useEffect(() => {
    setSearchParams(
      (currentParams) => {
        const current = currentParams.get("issue");
        if (selectedId === current || (!selectedId && !current)) {
          return currentParams;
        }
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
  }, [selectedId, setSearchParams]);

  useEffect(() => {
    if (!scopedProjectId) {
      setHeadlineStats(null);
      setStatsLoading(false);
      return;
    }
    setStatsLoading(true);
    void fetchHeadlineStats(scopedProjectId, environment ?? undefined, timeWindow)
      .then(setHeadlineStats)
      .catch(() => setHeadlineStats(null))
      .finally(() => setStatsLoading(false));
  }, [scopedProjectId, environment, timeWindow]);

  useEffect(() => {
    if (!scopedProjectId) {
      setSetup(null);
      setSetupLoading(false);
      return;
    }
    setSetupLoading(true);
    void fetchSetupProgress(scopedProjectId)
      .then(setSetup)
      .catch(() => setSetup(null))
      .finally(() => setSetupLoading(false));
  }, [scopedProjectId]);

  const waitingForFirstIssue = Boolean(
    setup &&
      !setupOnboardingDone(setup) &&
      setup.project_named &&
      setup.has_active_key &&
      setup.dsn_copied_at,
  );

  useEffect(() => {
    if (!waitingForFirstIssue || issues.length > 0 || feedStatus === "loading") {
      return;
    }
    const intervalId = window.setInterval(() => {
      void loadIssues(query, timeWindow, issueSort);
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [issueSort, issues.length, loadIssues, feedStatus, query, timeWindow, waitingForFirstIssue]);

  useEffect(() => {
    if (!scopedProjectId || !setup || setupOnboardingDone(setup) || !setup.dsn_copied_at) {
      return;
    }
    if (issues.length === 0) {
      return;
    }
    void fetchSetupProgress(scopedProjectId)
      .then((progress) => {
        setSetup(progress);
        if (setupOnboardingDone(progress) && !celebratedFirstIssue.current) {
          celebratedFirstIssue.current = true;
          toast("First issue received");
        }
      })
      .catch(() => {
        // ignore
      });
  }, [issues.length, scopedProjectId, setup, toast]);

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
        if (cancelled) return;
        const eventList =
          page.events.length > 0
            ? page.events
            : selectedId.startsWith("acme-issue-")
              ? [getAcmeSeedEvent(selectedId)]
              : [];
        setEvents(eventList);
        setSelectedEventId((current) => {
          if (current && eventList.some((event) => event.id === current)) {
            return current;
          }
          return eventList[0]?.id ?? null;
        });
        setSelectedEventRecord((current) => {
          if (current && eventList.some((event) => event.id === current.id)) {
            return current;
          }
          return eventList[0] ?? null;
        });
        setDiffEventId(null);
      })
      .catch(() => {
        if (!cancelled) {
          if (selectedId.startsWith("acme-issue-")) {
            const seedEvent = getAcmeSeedEvent(selectedId);
            setEvents([seedEvent]);
            setSelectedEventId(seedEvent.id);
            setSelectedEventRecord(seedEvent);
            setDiffEventId(null);
            return;
          }
          toast("Failed to load events");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, toast]);

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
        if (cancelled) return;
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
      const current = issues.find((row) => row.id === id);
      setPatchingId(id);
      setIssues((rows) =>
        rows.map((row) => (row.id === id ? { ...row, status } : row)),
      );

      toast.success(
        status === "resolved"
          ? "Issue resolved"
          : status === "ignored"
            ? "Issue ignored"
            : "Issue updated",
        {
          action: {
            label: "Undo",
            onClick: () => {
              setIssues(previous);
              if (current) {
                void patchIssue(id, current.status, current.resolved_in_release ?? undefined);
              }
            },
          },
        },
      );

      try {
        await patchIssue(id, status, resolvedInRelease);
      } catch {
        setIssues(previous);
        toast.error("Failed to update issue");
      } finally {
        setPatchingId(null);
      }
    },
    [busy, issues, patchingId],
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
    async (mode: SnoozeMode, explicitId?: string) => {
      const targetId = explicitId ?? selectedId ?? focusedId;
      if (!targetId || actionsDisabled) {
        return;
      }
      const current = issues.find((row) => row.id === targetId);
      if (!current) {
        return;
      }

      const previous = issues;
      const optimistic = applyOptimisticSnooze(current, mode);
      setSnoozingId(targetId);
      setIssues((rows) =>
        rows.map((row) => (row.id === targetId ? optimistic : row)),
      );

      toast.success("Issue snoozed", {
        action: {
          label: "Undo",
          onClick: () => {
            setIssues(previous);
            void patchIssue(targetId, current.status);
          },
        },
      });

      try {
        const updated = await snoozeIssue(targetId, mode);
        setIssues((rows) =>
          rows.map((row) => (row.id === targetId ? updated : row)),
        );
      } catch {
        setIssues(previous);
        toast.error("Failed to snooze issue");
      } finally {
        setSnoozingId(null);
      }
    },
    [actionsDisabled, issues, selectedId, focusedId],
  );

  const handleUnsnooze = useCallback(
    async (explicitId?: string) => {
      const targetId = explicitId ?? selectedId ?? focusedId;
      if (!targetId || actionsDisabled) {
        return;
      }
      const current = issues.find((row) => row.id === targetId);
      if (!current) {
        return;
      }

      const previous = issues;
      const optimistic: IssueSummary = {
        ...current,
        status: "unresolved",
        snoozed: false,
        snooze_until: null,
        snooze_until_count: null,
        snooze_until_users: null,
      };
      setSnoozingId(targetId);
      setIssues((rows) =>
        rows.map((row) => (row.id === targetId ? optimistic : row)),
      );

      toast.success("Issue unsnoozed", {
        action: {
          label: "Undo",
          onClick: () => {
            setIssues(previous);
            if (current.snooze_until_count) {
              void snoozeIssue(targetId, "occurrences");
            } else if (current.snooze_until_users) {
              void snoozeIssue(targetId, "users");
            } else {
              void snoozeIssue(targetId, "hours");
            }
          },
        },
      });

      try {
        const updated = await unsnoozeIssue(targetId);
        setIssues((rows) =>
          rows.map((row) => (row.id === targetId ? updated : row)),
        );
      } catch {
        setIssues(previous);
        toast.error("Failed to unsnooze issue");
      } finally {
        setSnoozingId(null);
      }
    },
    [actionsDisabled, issues, selectedId, focusedId],
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
      const nextId = issues[next]?.id ?? null;
      setFocusedId(nextId);
      // If detail drawer is already open, move selectedId fluidly along with focusedId
      if (selectedId && nextId) {
        setSelectedId(nextId);
        if (scopedProjectId && routeIssueId) {
          const search = searchParams.toString();
          navigate(`/p/${scopedProjectId}/issues/${nextId}${search ? `?${search}` : ""}`, { replace: true });
        }
      }
    },
    [issues, focusedId, selectedId, scopedProjectId, routeIssueId, searchParams, navigate],
  );

  const handleOpenDetail = useCallback(() => {
    const target = focusedId ?? issues[0]?.id ?? null;
    if (target) {
      setFocusedId(target);
      setSelectedId(target);
      if (scopedProjectId && routeIssueId !== target) {
        const search = searchParams.toString();
        navigate(`/p/${scopedProjectId}/issues/${target}${search ? `?${search}` : ""}`, { replace: true });
      }
    }
  }, [focusedId, issues, scopedProjectId, routeIssueId, searchParams, navigate]);

  const handleSelect = useCallback((id: string, extend = false) => {
    setFocusedId(id);
    setSelectedId(id);
    if (scopedProjectId && routeIssueId !== id) {
      const search = searchParams.toString();
      navigate(`/p/${scopedProjectId}/issues/${id}${search ? `?${search}` : ""}`, { replace: true });
    }
    if (extend) {
      setSelectedIds((current) => {
        const next = new Set(current);
        next.add(id);
        return next;
      });
    }
  }, [scopedProjectId, routeIssueId, searchParams, navigate]);

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
    [actionsDisabled, issueSort, issues, loadIssues, query, selectedIssues, timeWindow, toast],
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
    [actionsDisabled, loadIssues, query, selectedIds, timeWindow, issueSort, toast],
  );

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

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    if (routeIssueId && scopedProjectId) {
      const search = searchParams.toString();
      navigate(`/p/${scopedProjectId}/issues${search ? `?${search}` : ""}`, { replace: true });
    }
  }, [routeIssueId, scopedProjectId, searchParams, navigate]);

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
  }, [actionsDisabled, loadIssues, query, selectedId, selectedIds, timeWindow, issueSort, toast]);

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
    [actionsDisabled, loadIssues, query, selectedId, timeWindow, issueSort, toast],
  );

  const applyFilter = useCallback(
    (token: string) => {
      handleSetQuery((current) => setToken(current, token));
    },
    [handleSetQuery],
  );

  const handleResetFilters = useCallback(() => {
    handleSetQuery(DEFAULT_QUERY);
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
  }, [handleSetQuery, setSearchParams]);

  return {
    scopedProjectId,
    query,
    setQuery: handleSetQuery,
    timeWindow,
    setTimeWindow,
    issueSort,
    setIssueSort,
    feedStatus,
    loadError,
    issues,
    issueTrends,
    loadIssues,
    focusedId,
    setFocusedId,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    activeIssueId,
    selectedIssue,
    focusedIssue,
    selectedIssues,
    bulkAvailability,
    events,
    selectedEventId,
    selectedEventRecord,
    selectedEvent,
    handleSelectEvent,
    diffEventId,
    setDiffEventId,
    diffMode,
    setDiffMode,
    mergedChildren,
    issueReleases,
    leftRelease,
    setLeftRelease,
    rightRelease,
    setRightRelease,
    timeline,
    timelineLoading,
    timelineWindow,
    setTimelineWindow,
    headlineStats,
    statsLoading,
    setup,
    setupLoading,
    waitingForFirstIssue,
    actionsDisabled,
    busy,
    setBusy,
    patchingId,
    snoozingId,
    isIssueUnread,
    handleResolve,
    handleIgnore,
    handleReopen,
    handleSnooze,
    handleUnsnooze,
    handleBulk,
    handleBulkSnooze,
    handleClearSelection,
    handleToggleSelectAll,
    handleMoveSelection,
    handleOpenDetail,
    handleCloseDetail,
    handleSelect,
    handleToggleSelect,
    handleMerge,
    handleSplit,
    applyFilter,
    handleResetFilters,
  };
}
