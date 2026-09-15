import { useEffect, useRef, useState } from "react";
import type { EventDetail, IssueSummary } from "../lib/api";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";
import { Section, SectionHeader } from "./section";

function formatUser(event: EventDetail): string {
  return event.user_email ?? event.user_id ?? "—";
}

function formatRuntime(event: EventDetail): string {
  if (!event.runtime_name) {
    return "—";
  }
  return event.runtime_version
    ? `${event.runtime_name}@${event.runtime_version}`
    : event.runtime_name;
}

function errorFromPayload(payload: Record<string, unknown>): string {
  const exception = payload.exception as
    | { values?: Array<{ type?: string; value?: string }> }
    | undefined;
  const first = exception?.values?.[0];
  if (!first) {
    return "—";
  }
  if (first.type && first.value) {
    return `${first.type}: ${first.value}`;
  }
  return first.type ?? first.value ?? "—";
}

function transactionFromPayload(payload: Record<string, unknown>): string {
  const transaction = payload.transaction;
  return typeof transaction === "string" ? transaction : "—";
}

function frameCount(event: EventDetail): string {
  if (!Array.isArray(event.stack_frames)) {
    return "—";
  }
  return String(event.stack_frames.length);
}

const TH =
  "epure-table-header sticky top-0 z-10 border-b border-border bg-surface-inset px-3 py-2.5 text-left text-xs font-medium text-ink-muted whitespace-nowrap";

const TD = "epure-table-cell border-b border-border px-3 py-2.5 align-top text-xs whitespace-nowrap";

const SECTION_CLASS = "epure-occurrences-table px-5 py-2.5";

export interface IssueOccurrencesTableProps {
  issue: IssueSummary;
  events: EventDetail[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string, event: EventDetail) => void;
  onLoadMore: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function IssueOccurrencesTable({
  issue,
  events,
  total,
  hasMore,
  loading,
  loadingMore,
  selectedEventId,
  onSelectEvent,
  onLoadMore,
  collapsible = true,
  defaultExpanded = true,
}: IssueOccurrencesTableProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadedCount = events.length;
  const hasStoredGap = total > loadedCount;

  const countLabel = hasStoredGap
    ? `${loadedCount.toLocaleString()} of ${total.toLocaleString()} loaded`
    : `${total.toLocaleString()} total`;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !expanded || !hasMore || loading || loadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { root, rootMargin: "120px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [expanded, hasMore, loading, loadingMore, onLoadMore, events.length]);

  useEffect(() => {
    if (!selectedEventId || !expanded) {
      return;
    }
    const row = scrollRef.current?.querySelector(`[data-event-id="${selectedEventId}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [expanded, selectedEventId]);

  const collapseAction = collapsible ? (
    <button
      type="button"
      onClick={() => setExpanded((open) => !open)}
      className="text-xs text-accent hover:underline focus-ring"
    >
      {expanded ? "Hide" : "Show"}
    </button>
  ) : null;

  if (loading && events.length === 0) {
    return (
      <Section className={SECTION_CLASS}>
        <SectionHeader title="Occurrences" />
        <p className="py-4 text-center text-sm text-ink-muted">Loading occurrences…</p>
      </Section>
    );
  }

  if (!loading && events.length === 0) {
    return (
      <Section className={SECTION_CLASS}>
        <SectionHeader title="Occurrences" />
        <p className="py-4 text-center text-sm text-ink-muted">
          No stored occurrences — counter may reflect pruned history.
        </p>
      </Section>
    );
  }

  return (
    <Section className={SECTION_CLASS}>
      <SectionHeader
        title="Occurrences"
        description={countLabel}
        actions={collapseAction}
        className="mb-1.5"
      />

      {expanded ? (
        <div className="epure-inset-well overflow-hidden">
          <div
            ref={scrollRef}
            className="epure-table-scroll max-h-[min(18rem,32vh)] overflow-auto"
          >
            <div className="overflow-x-auto">
              <table className="epure-table w-full min-w-[56rem] border-collapse text-left">
                <thead>
                  <tr>
                    <th className={TH}>Time</th>
                    <th className={TH}>User</th>
                    <th className={TH}>Environment</th>
                    <th className={TH}>Release</th>
                    <th className={TH}>Platform</th>
                    <th className={TH}>Browser</th>
                    <th className={TH}>OS</th>
                    <th className={TH}>Runtime</th>
                    <th className={cn(TH, "min-w-[12rem]")}>Error</th>
                    <th className={TH}>Transaction</th>
                    <th className={TH}>Frames</th>
                    <th className={TH}>Event ID</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const selected = event.id === selectedEventId;
                    return (
                      <tr
                        key={event.id}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selected ? "bg-state-selected" : "hover:bg-state-hover",
                        )}
                        onClick={() => onSelectEvent(event.id, event)}
                        data-event-id={event.id}
                      >
                        <td className={TD} title={new Date(event.occurred_at).toLocaleString()}>
                          <span className="text-ink-muted">{formatRelativeTime(event.occurred_at)}</span>
                          <span className="mt-0.5 block font-mono text-2xs text-ink-muted/80">
                            {new Date(event.occurred_at).toLocaleString()}
                          </span>
                        </td>
                        <td className={cn(TD, "max-w-[10rem] truncate font-mono")} title={formatUser(event)}>
                          {formatUser(event)}
                        </td>
                        <td className={cn(TD, "font-mono")}>
                          {event.environment ?? issue.environment ?? "—"}
                        </td>
                        <td className={cn(TD, "font-mono-slash")}>{event.release ?? "—"}</td>
                        <td className={cn(TD, "font-mono")}>{event.platform ?? "—"}</td>
                        <td className={cn(TD, "font-mono")}>{event.browser_name ?? "—"}</td>
                        <td className={cn(TD, "font-mono")}>{event.os_name ?? "—"}</td>
                        <td className={cn(TD, "font-mono")}>{formatRuntime(event)}</td>
                        <td className={cn(TD, "max-w-[16rem] whitespace-normal font-mono text-ink")}>
                          {errorFromPayload(event.payload_json)}
                        </td>
                        <td
                          className={cn(TD, "max-w-[10rem] truncate font-mono")}
                          title={transactionFromPayload(event.payload_json)}
                        >
                          {transactionFromPayload(event.payload_json)}
                        </td>
                        <td className={cn(TD, "font-mono text-ink-muted")}>{frameCount(event)}</td>
                        <td className={cn(TD, "font-mono text-2xs text-ink-muted")} title={event.id}>
                          {event.id.slice(0, 8)}…
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div ref={sentinelRef} className="px-3 py-2.5 text-center text-xs text-ink-muted">
              {loadingMore ? "Loading more…" : hasMore ? "Scroll for more" : "All loaded"}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">
          {total.toLocaleString()} occurrences hidden —{" "}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-accent hover:underline focus-ring"
          >
            show table
          </button>
        </p>
      )}
    </Section>
  );
}
