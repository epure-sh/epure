import { useCallback, useEffect, useRef, useState } from "react";
import {
  EVENTS_PAGE_SIZE,
  fetchEvents,
  type EventDetail,
} from "../../lib/api";

export interface UseIssueEventsPageResult {
  events: EventDetail[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMore: () => void;
  reset: () => void;
}

export function useIssueEventsPage(issueId: string | null): UseIssueEventsPageResult {
  const [events, setEvents] = useState<EventDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const requestRef = useRef(0);

  const reset = useCallback(() => {
    offsetRef.current = 0;
    setEvents([]);
    setTotal(0);
    setHasMore(false);
    setError(null);
  }, []);

  useEffect(() => {
    reset();
    if (!issueId) {
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);

    void fetchEvents(issueId, { limit: EVENTS_PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (requestRef.current !== requestId) {
          return;
        }
        setEvents(page.events);
        setTotal(page.total);
        setHasMore(page.has_more);
        offsetRef.current = page.events.length;
      })
      .catch(() => {
        if (requestRef.current !== requestId) {
          return;
        }
        setError("Failed to load occurrences");
      })
      .finally(() => {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      });
  }, [issueId, reset]);

  const loadMore = useCallback(() => {
    if (!issueId || loading || loadingMore || !hasMore) {
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoadingMore(true);

    void fetchEvents(issueId, {
      limit: EVENTS_PAGE_SIZE,
      offset: offsetRef.current,
    })
      .then((page) => {
        if (requestRef.current !== requestId) {
          return;
        }
        setEvents((current) => {
          const seen = new Set(current.map((event) => event.id));
          const merged = [...current];
          for (const event of page.events) {
            if (!seen.has(event.id)) {
              merged.push(event);
            }
          }
          return merged;
        });
        setTotal(page.total);
        setHasMore(page.has_more);
        offsetRef.current += page.events.length;
      })
      .catch(() => {
        if (requestRef.current !== requestId) {
          return;
        }
        setError("Failed to load more occurrences");
      })
      .finally(() => {
        if (requestRef.current === requestId) {
          setLoadingMore(false);
        }
      });
  }, [hasMore, issueId, loading, loadingMore]);

  return {
    events,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    reset,
  };
}
