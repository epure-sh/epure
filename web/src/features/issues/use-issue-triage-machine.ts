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
  headlineStatsDelta,
  issueMatchesStatusFilter,
  type HeadlineStatsDelta,
} from "./issue-triage-utils";
import { inferTrendStatus } from "./issue-feed-utils";
import { resolveIssuePriority } from "../../ui/issue-priority";
import {
  DEFAULT_ISSUE_SORT,
  DEFAULT_TIME_WINDOW,
  ALL_QUERY,
  applyFilterToken,
  parseIssueSort,
  parseQuery,
  parseTimeWindow,
  toApiQuery,
  withSearchText,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";
import { useIssueReadState } from "./use-issue-read-state";
import type { TimelineWindowValue } from "../../ui/issue-occurrence-timeline";

export { ALL_QUERY, DEFAULT_QUERY } from "./query-utils";

export type TriageFeedStatus = "loading" | "idle" | "empty" | "error" | "forbidden";

export interface UseIssueTriageMachineOptions {
  routeProjectId?: string;
}

/**
 * Optimistic client-side view of an issue (null = deleted). Kept until a list load that
 * started after the mutation settled, so a slow in-flight fetch cannot resurrect stale state.
 */
interface IssueOverride {
  token: number;
  issue: IssueSummary | null;
  settledAt: number | null;
}

interface OptimisticChange {
  before: IssueSummary;
  after: IssueSummary | null;
}

interface PendingStatsDelta {
  token: number;
  delta: HeadlineStatsDelta;
  settledAt: number | null;
}

function issueMatchesClientRefiners(
  issue: IssueSummary,
  parsed: ReturnType<typeof parseQuery>,
  trends: Record<string, TimelineBucket[]>,
): boolean {
  if (parsed.escalating) {
    const buckets = trends[issue.id] ?? [];
    const escalating =
      Boolean(issue.is_escalating_3d) || inferTrendStatus(issue, buckets) === "escalating";
    if (!escalating) return false;
  }
  if (parsed.priority) {
    if (resolveIssuePriority(issue.level, issue.status) !== parsed.priority) {
      return false;
    }
  }
  return true;
}

function issueMatchesLoadedQuery(
  issue: IssueSummary,
  query: string,
  trends: Record<string, TimelineBucket[]>,
): boolean {
  const parsed = parseQuery(query);
  if (!issueMatchesStatusFilter(issue, parsed.status)) return false;
  if (parsed.release || parsed.userEmail) return false;
  if (parsed.level && issue.level !== parsed.level) return false;
  if (parsed.environment && issue.environment !== parsed.environment) return false;
  if (parsed.freeText && !(issue.title ?? "").toLowerCase().includes(parsed.freeText.toLowerCase())) {
    return false;
  }
  if (!issueMatchesClientRefiners(issue, parsed, trends)) return false;
  return true;
}

export function useIssueTriageMachine(options: UseIssueTriageMachineOptions = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { buildQuery, projectId: contextProjectId, environment, projects } = useAppContext();
  const safeProjects = useMemo(() => (Array.isArray(projects) ? projects : []), [projects]);
  const rawId = options.routeProjectId ?? contextProjectId;
  const scopedProjectId = useMemo(() => {
    if (!rawId) return rawId;
    const match = safeProjects.find((p) => p && (p.id === rawId || p.slug === rawId));
    return match ? match.id : rawId;
  }, [rawId, safeProjects]);
  const timeWindow = parseTimeWindow(searchParams.get("window"));
  const issueSort = parseIssueSort(searchParams.get("sort"));
  const { issueId: routeIssueId } = useParams<{ issueId?: string }>();
  const urlIssueId = routeIssueId ?? searchParams.get("issue");

  const [query, setQuery] = useState(() => searchParams.get("q") ?? ALL_QUERY);
  const [rawIssues, setRawIssues] = useState<IssueSummary[]>([]);
  const [loadedQuery, setLoadedQuery] = useState(query);
  const [overrides, setOverrides] = useState<Map<string, IssueOverride>>(() => new Map());
  const [statsDeltas, setStatsDeltas] = useState<PendingStatsDelta[]>([]);
  const [statsNonce, setStatsNonce] = useState(0);
  const overrideTokenRef = useRef(0);
  const loadRequestRef = useRef(0);
  const lastLoadKeyRef = useRef<string | null>(null);
  const urlIssueIdRef = useRef(urlIssueId);
  urlIssueIdRef.current = urlIssueId;
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

  const [setup, setSetup] = useState<SetupProgress | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const celebratedFirstIssue = useRef(false);

  const [timeline, setTimeline] = useState<IssueTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindowValue>("7d");

  const [serverHeadlineStats, setHeadlineStats] = useState<HeadlineStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const { isUnread: isIssueUnread, markRead: markIssueRead } = useIssueReadState(scopedProjectId);

  const activeIssueId = selectedId ?? focusedId;

  /** Every issue we know about with optimistic overrides applied, regardless of the active filter. */
  const knownIssues = useMemo(() => {
    const rows: IssueSummary[] = [];
    for (const row of rawIssues) {
      const override = overrides.get(row.id);
      if (!override) {
        rows.push(row);
      } else if (override.issue) {
        rows.push(override.issue);
      }
    }
    return rows;
  }, [overrides, rawIssues]);

  const issues = useMemo(() => {
    const parsed = parseQuery(loadedQuery);
    const visible = knownIssues.filter(
      (issue) =>
        issueMatchesStatusFilter(issue, parsed.status) &&
        issueMatchesClientRefiners(issue, parsed, issueTrends),
    );
    const rawIds = new Set(rawIssues.map((row) => row.id));
    const movedIn: IssueSummary[] = [];
    for (const override of overrides.values()) {
      if (
        override.issue &&
        !rawIds.has(override.issue.id) &&
        issueMatchesLoadedQuery(override.issue, loadedQuery, issueTrends)
      ) {
        movedIn.push(override.issue);
      }
    }
    return movedIn.length > 0 ? [...movedIn, ...visible] : visible;
  }, [knownIssues, issueTrends, loadedQuery, overrides, rawIssues]);

  const pendingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, override] of overrides) {
      if (override.settledAt === null) ids.add(id);
    }
    return ids;
  }, [overrides]);

  const headlineStats = useMemo(() => {
    if (!serverHeadlineStats || statsDeltas.length === 0) {
      return serverHeadlineStats;
    }
    const next = { ...serverHeadlineStats };
    for (const { delta } of statsDeltas) {
      next.unresolved = Math.max(0, next.unresolved + delta.unresolved);
      next.regressions = Math.max(0, next.regressions + delta.regressions);
      next.snoozed = Math.max(0, next.snoozed + delta.snoozed);
    }
    return next;
  }, [serverHeadlineStats, statsDeltas]);

  const selectedIssue = useMemo(
    () =>
      issues.find((issue) => issue.id === selectedId) ??
      knownIssues.find((issue) => issue.id === selectedId) ??
      null,
    [issues, knownIssues, selectedId],
  );

  const focusedIssue = useMemo(
    () => issues.find((issue) => issue.id === focusedId) ?? null,
    [issues, focusedId],
  );

  useEffect(() => {
    if (!selectedId || !selectedIssue) {
      return;
    }
    markIssueRead(
      selectedId,
      selectedIssue.last_seen_at ?? new Date().toISOString(),
    );
  }, [markIssueRead, selectedId, selectedIssue]);

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

  const loadIssues = useCallback(async (
    nextQuery: string,
    window: TimeWindowValue,
    sort: IssueSortValue,
    options: { background?: boolean } = {},
  ) => {
    const requestId = ++loadRequestRef.current;
    const startedAt = Date.now();
    if (!options.background) {
      setFeedStatus("loading");
    }
    setLoadError(null);
    try {
      const scopedQuery = buildQuery(toApiQuery(nextQuery));
      let rows = await fetchIssues(
        scopedQuery,
        scopedProjectId ?? undefined,
        window,
        sort === DEFAULT_ISSUE_SORT ? undefined : sort,
        environment,
      );
      if (requestId !== loadRequestRef.current) {
        return;
      }
      if (
        rows.length === 0 &&
        (scopedProjectId?.includes("acme") ||
          scopedProjectId === "550e8400-e29b-41d4-a716-446655440000")
      ) {
        rows = ACME_SEED_ISSUES;
      }
      setRawIssues(rows);
      setLoadedQuery(nextQuery);
      setOverrides((current) => {
        let changed = false;
        const next = new Map(current);
        for (const [id, override] of current) {
          if (override.settledAt !== null && override.settledAt <= startedAt) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : current;
      });
      setFeedStatus(rows.length === 0 ? "empty" : "idle");

      const urlId = urlIssueIdRef.current;
      setFocusedId((current) => {
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }
        if (current && current === urlId) {
          return current;
        }
        return rows[0]?.id ?? null;
      });

      setSelectedId((current) => {
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }
        if (current && current === urlId) {
          return current;
        }
        return null;
      });

      try {
        const trends = await fetchIssueTrends(rows.map((row) => row.id), window);
        if (requestId === loadRequestRef.current) {
          setIssueTrends(trends);
        }
      } catch {
        if (requestId === loadRequestRef.current) {
          setIssueTrends({});
        }
      }
    } catch (error) {
      if (requestId !== loadRequestRef.current) {
        return;
      }
      setRawIssues([]);
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
  }, [buildQuery, environment, scopedProjectId]);

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
            const trimmed = nextQuery.trim();
            if (trimmed === ALL_QUERY) {
              params.delete("q");
            } else {
              params.set("q", trimmed);
            }
            return params;
          },
          { replace: true },
        );
        return nextQuery.trim();
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    const urlQuery = searchParams.get("q");
    const normalized = urlQuery === null ? ALL_QUERY : urlQuery.trim();
    setQuery((current) => (current !== normalized ? normalized : current));
  }, [searchParams]);

  useEffect(() => {
    const loadKey = [
      withSearchText(toApiQuery(query), ""),
      timeWindow,
      issueSort,
      environment ?? "",
      scopedProjectId ?? "",
    ].join("|");
    const background = lastLoadKeyRef.current === loadKey;
    lastLoadKeyRef.current = loadKey;
    void loadIssues(query, timeWindow, issueSort, { background });
  }, [loadIssues, query, environment, scopedProjectId, timeWindow, issueSort]);

  useEffect(() => {
    if (!urlIssueId || feedStatus === "loading") {
      return;
    }

    if (knownIssues.some((issue) => issue.id === urlIssueId)) {
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
          setRawIssues((rows) => (rows.some((row) => row.id === found.id) ? rows : [found, ...rows]));
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
  }, [urlIssueId, feedStatus, knownIssues, scopedProjectId, setSearchParams]);

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

  const statsScopeKey = `${scopedProjectId ?? ""}|${environment ?? ""}|${timeWindow}`;
  const lastStatsScopeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scopedProjectId) {
      setHeadlineStats(null);
      setStatsLoading(false);
      return;
    }
    const scopeChanged = lastStatsScopeRef.current !== statsScopeKey;
    lastStatsScopeRef.current = statsScopeKey;
    if (scopeChanged) {
      setStatsLoading(true);
    }
    let cancelled = false;
    const startedAt = Date.now();
    void fetchHeadlineStats(scopedProjectId, environment ?? undefined, timeWindow)
      .then((stats) => {
        if (cancelled) return;
        setHeadlineStats(stats);
        setStatsDeltas((current) => {
          const next = current.filter(
            (entry) => entry.settledAt === null || entry.settledAt > startedAt,
          );
          return next.length === current.length ? current : next;
        });
      })
      .catch(() => {
        if (!cancelled && scopeChanged) setHeadlineStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scopedProjectId, environment, timeWindow, statsScopeKey, statsNonce]);

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
      void loadIssues(query, timeWindow, issueSort, { background: true });
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

  const actionsDisabled = busy;

  const issueById = useMemo(() => {
    const map = new Map<string, IssueSummary>();
    for (const issue of knownIssues) map.set(issue.id, issue);
    for (const issue of issues) map.set(issue.id, issue);
    return map;
  }, [issues, knownIssues]);

  const revertOptimistic = useCallback(
    (token: number, changes: OptimisticChange[]) => {
      const now = Date.now();
      setOverrides((current) => {
        const next = new Map(current);
        for (const { before } of changes) {
          if (next.get(before.id)?.token === token) {
            next.set(before.id, { token, issue: before, settledAt: now });
          }
        }
        return next;
      });
      setStatsDeltas((current) => current.filter((entry) => entry.token !== token));
    },
    [],
  );

  const settleOptimistic = useCallback((token: number, serverIssues: IssueSummary[]) => {
    const now = Date.now();
    const byId = new Map(serverIssues.map((issue) => [issue.id, issue]));
    setOverrides((current) => {
      let changed = false;
      const next = new Map(current);
      for (const [id, override] of current) {
        if (override.token !== token) continue;
        const server = byId.get(id);
        next.set(id, {
          token,
          issue: override.issue && server ? { ...override.issue, ...server } : override.issue,
          settledAt: now,
        });
        changed = true;
      }
      return changed ? next : current;
    });
    setStatsDeltas((current) =>
      current.map((entry) => (entry.token === token ? { ...entry, settledAt: now } : entry)),
    );
    setStatsNonce((value) => value + 1);
  }, []);

  /**
   * Apply `changes` to the UI immediately, then run `request`. Rows that no longer match the
   * active tab drop out of the list at once and show up in the tab they moved to.
   */
  const runOptimistic = useCallback(
    async (
      changes: OptimisticChange[],
      request: () => Promise<IssueSummary[] | void>,
      errorMessage: string,
    ): Promise<boolean> => {
      const token = ++overrideTokenRef.current;
      if (changes.length > 0) {
        setOverrides((current) => {
          const next = new Map(current);
          for (const { before, after } of changes) {
            next.set(before.id, { token, issue: after, settledAt: null });
          }
          return next;
        });
        const delta = changes.reduce<HeadlineStatsDelta>(
          (sum, { before, after }) => {
            const change = headlineStatsDelta(before, after);
            return {
              unresolved: sum.unresolved + change.unresolved,
              regressions: sum.regressions + change.regressions,
              snoozed: sum.snoozed + change.snoozed,
            };
          },
          { unresolved: 0, regressions: 0, snoozed: 0 },
        );
        if (delta.unresolved || delta.regressions || delta.snoozed) {
          setStatsDeltas((current) => [...current, { token, delta, settledAt: null }]);
        }
      }
      try {
        const serverIssues = await request();
        settleOptimistic(token, serverIssues ?? []);
        return true;
      } catch {
        revertOptimistic(token, changes);
        toast.error(errorMessage);
        return false;
      }
    },
    [revertOptimistic, settleOptimistic],
  );

  const changeStatus = useCallback(
    (id: string, status: string, resolvedInRelease?: string) => {
      const current = issueById.get(id);
      if (!current) {
        return;
      }
      const optimistic: IssueSummary = { ...current, status };

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
              void runOptimistic(
                [{ before: optimistic, after: current }],
                async () => [
                  await patchIssue(id, current.status, current.resolved_in_release ?? undefined),
                ],
                "Failed to undo",
              );
            },
          },
        },
      );

      void runOptimistic(
        [{ before: current, after: optimistic }],
        async () => [await patchIssue(id, status, resolvedInRelease)],
        "Failed to update issue",
      );
    },
    [issueById, runOptimistic],
  );

  const handleResolve = useCallback(
    (id: string) => {
      const issue = issueById.get(id);
      if (!issue || !canResolveIssue(issue.status)) {
        return;
      }
      changeStatus(id, "resolved", issue.release ?? undefined);
    },
    [changeStatus, issueById],
  );

  const handleIgnore = useCallback(
    (id: string) => {
      const issue = issueById.get(id);
      if (!issue || !canIgnoreIssue(issue.status)) {
        return;
      }
      changeStatus(id, "ignored");
    },
    [changeStatus, issueById],
  );

  const handleReopen = useCallback(
    (id: string) => {
      const issue = issueById.get(id);
      if (!issue || !canReopenIssue(issue.status)) {
        return;
      }
      changeStatus(id, "unresolved");
    },
    [changeStatus, issueById],
  );

  const handleSnooze = useCallback(
    async (mode: SnoozeMode, explicitId?: string) => {
      const targetId = explicitId ?? selectedId ?? focusedId;
      if (!targetId || actionsDisabled) {
        return;
      }
      const current = issueById.get(targetId);
      if (!current) {
        return;
      }
      const optimistic = applyOptimisticSnooze(current, mode);

      toast.success("Issue snoozed", {
        action: {
          label: "Undo",
          onClick: () => {
            void runOptimistic(
              [{ before: optimistic, after: current }],
              async () => [await unsnoozeIssue(targetId)],
              "Failed to undo snooze",
            );
          },
        },
      });

      await runOptimistic(
        [{ before: current, after: optimistic }],
        async () => [await snoozeIssue(targetId, mode)],
        "Failed to snooze issue",
      );
    },
    [actionsDisabled, focusedId, issueById, runOptimistic, selectedId],
  );

  const handleUnsnooze = useCallback(
    async (explicitId?: string) => {
      const targetId = explicitId ?? selectedId ?? focusedId;
      if (!targetId || actionsDisabled) {
        return;
      }
      const current = issueById.get(targetId);
      if (!current) {
        return;
      }
      const optimistic: IssueSummary = {
        ...current,
        snoozed: false,
        snooze_until: null,
        snooze_until_count: null,
        snooze_until_users: null,
      };
      const previousMode: SnoozeMode = current.snooze_until_count
        ? "occurrences"
        : current.snooze_until_users
          ? "users"
          : "hours";

      toast.success("Issue unsnoozed", {
        action: {
          label: "Undo",
          onClick: () => {
            void runOptimistic(
              [{ before: optimistic, after: current }],
              async () => [await snoozeIssue(targetId, previousMode)],
              "Failed to undo",
            );
          },
        },
      });

      await runOptimistic(
        [{ before: current, after: optimistic }],
        async () => [await unsnoozeIssue(targetId)],
        "Failed to unsnooze issue",
      );
    },
    [actionsDisabled, focusedId, issueById, runOptimistic, selectedId],
  );

  const previousIssueIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const previousIds = previousIssueIdsRef.current;
    const visibleIds = new Set(issues.map((issue) => issue.id));
    previousIssueIdsRef.current = issues.map((issue) => issue.id);
    if (!focusedId || visibleIds.has(focusedId)) {
      return;
    }
    const previousIndex = previousIds.indexOf(focusedId);
    if (previousIndex === -1) {
      return;
    }
    const nextId =
      previousIds.slice(previousIndex + 1).find((id) => visibleIds.has(id)) ??
      previousIds
        .slice(0, previousIndex)
        .reverse()
        .find((id) => visibleIds.has(id)) ??
      null;
    setFocusedId(nextId);
  }, [focusedId, issues]);

  const handleMoveSelection = useCallback(
    (direction: "up" | "down") => {
      if (issues.length === 0) {
        return;
      }
      const index = issues.findIndex((issue) => issue.id === focusedId);
      const start = index >= 0 ? index : 0;
      // The open issue already left the list, so focus sits on the row that took its place.
      const detailLeftList =
        Boolean(selectedId) && !issues.some((issue) => issue.id === selectedId);
      const next =
        direction === "down"
          ? Math.min(detailLeftList ? start : start + 1, issues.length - 1)
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

      setSelectedIds(new Set());
      const ok = await runOptimistic(
        eligible.map((issue) => ({ before: issue, after: applyOptimisticSnooze(issue, mode) })),
        () => Promise.all(eligible.map((issue) => snoozeIssue(issue.id, mode))),
        "Bulk snooze failed",
      );
      if (ok) {
        toast(
          eligible.length === 1
            ? "Issue snoozed"
            : `Snoozed ${eligible.length} issues`,
        );
      }
    },
    [actionsDisabled, runOptimistic, selectedIssues],
  );

  const handleBulk = useCallback(
    async (
      action: "resolve" | "ignore" | "reopen" | "delete",
      options: { ids?: string[]; successMessage?: string } = {},
    ): Promise<boolean> => {
      const ids = options.ids ?? Array.from(selectedIds);
      if (ids.length === 0 || actionsDisabled) {
        return false;
      }
      const nextStatus: Record<typeof action, string | null> = {
        resolve: "resolved",
        ignore: "ignored",
        reopen: "unresolved",
        delete: null,
      };
      const changes: OptimisticChange[] = [];
      for (const id of ids) {
        const before = issueById.get(id);
        if (!before) continue;
        const status = nextStatus[action];
        changes.push({ before, after: status === null ? null : { ...before, status } });
      }

      setSelectedIds(new Set());
      const ok = await runOptimistic(
        changes,
        async () => {
          await bulkUpdateIssues(ids, action);
        },
        "Bulk action failed",
      );
      if (ok) {
        const labels: Record<string, string> = {
          delete: `Deleted ${ids.length} issues`,
          resolve: `Marked ${ids.length} issues resolved`,
          ignore: `Ignored ${ids.length} issues`,
          reopen: `Reopened ${ids.length} issues`,
        };
        toast(options.successMessage ?? labels[action]);
      }
      return ok;
    },
    [actionsDisabled, issueById, runOptimistic, selectedIds],
  );
  const handleBulkMarkRead = useCallback(() => {
    if (selectedIds.size === 0) {
      return;
    }
    for (const id of selectedIds) {
      const issue = issueById.get(id);
      markIssueRead(id, issue?.last_seen_at ?? new Date().toISOString());
    }
    toast(`Marked ${selectedIds.size} issue${selectedIds.size === 1 ? "" : "s"} as read`);
  }, [issueById, markIssueRead, selectedIds]);

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
      await loadIssues(query, timeWindow, issueSort, { background: true });
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
        await loadIssues(query, timeWindow, issueSort, { background: true });
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
      handleSetQuery((current) => applyFilterToken(current, token));
    },
    [handleSetQuery],
  );

  const handleResetFilters = useCallback(() => {
    handleSetQuery(ALL_QUERY);
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
    pendingIds,
    isIssueUnread,
    handleResolve,
    handleIgnore,
    handleReopen,
    handleSnooze,
    handleUnsnooze,
    handleBulk,
    handleBulkSnooze,
    handleBulkMarkRead,
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
