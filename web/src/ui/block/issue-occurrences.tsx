// web/src/ui/block/issue-occurrences.tsx
// Tier 3 Block: Consolidated Issue Occurrences Block
// Consolidates issue-recent-occurrences.tsx and issue-occurrences-table.tsx with mode="table" | "list" | "detail".
// Drop-in backward-compatible wrappers for IssueRecentOccurrences and IssueOccurrencesTable.

import { useEffect, useRef, useState } from "react";
import type { EventDetail, IssueSummary } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format-time";
import { cn } from "../../lib/cn";
import { Section, SectionHeader } from "../components/section";

// ---------------------------------------------------------------------------
// Helpers & Formatters
// ---------------------------------------------------------------------------

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
    return "-";
  }
  return String(event.stack_frames.length);
}

const TH =
  "epure-table-header sticky top-0 z-10 border-b border-border bg-surface-inset px-3 py-2.5 text-left text-xs font-medium text-ink-muted whitespace-nowrap";

const TD =
  "epure-table-cell border-b border-border px-3 py-2.5 align-top text-xs whitespace-nowrap";

const SECTION_CLASS = "epure-occurrences-table px-5 py-2.5";

// ---------------------------------------------------------------------------
// Type Contracts
// ---------------------------------------------------------------------------

export type IssueOccurrencesMode = "table" | "list" | "detail";

export interface IssueOccurrencesProps {
  mode?: IssueOccurrencesMode;
  issue: IssueSummary;
  events: EventDetail[];
  selectedEventId?: string | null;
  onSelectEvent: (eventId: string, event: EventDetail) => void;

  // Table mode specific
  total?: number;
  hasMore?: boolean;
  loading?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;

  // List mode specific
  limit?: number; // defaults to 5
  spacious?: boolean;

  // Custom styling
  className?: string;
}

// ---------------------------------------------------------------------------
// Consolidated Component: IssueOccurrences
// ---------------------------------------------------------------------------

export function IssueOccurrences({
  mode: modeProp,
  issue,
  events,
  selectedEventId = null,
  onSelectEvent,
  total,
  hasMore = false,
  loading = false,
  loadingMore = false,
  onLoadMore,
  collapsible = true,
  defaultExpanded = true,
  limit = 5,
  spacious = false,
  className,
}: IssueOccurrencesProps) {
  // Infer mode: if total or onLoadMore is passed without explicit mode, default to "table"
  const mode: IssueOccurrencesMode =
    modeProp ?? (total !== undefined || onLoadMore !== undefined ? "table" : "list");

  // -------------------------------------------------------------------------
  // Mode: List (Recent Occurrences)
  // -------------------------------------------------------------------------
  if (mode === "list") {
    const recent = events.slice(0, limit);
    const effectiveSelectedId = selectedEventId ?? events[0]?.id ?? null;
    const storedCount = events.length;
    const totalCount = issue.event_count;
    const hasStoredGap = totalCount > storedCount;
    const sectionClass = cn(spacious ? "px-6 py-5" : "px-5 py-3", className);

    if (recent.length === 0) {
      return (
        <Section className={sectionClass}>
          <SectionHeader
            title="Recent occurrences"
            className={spacious ? "mb-4" : "mb-2"}
          />
          <p className={spacious ? "text-base text-ink-muted" : "text-sm text-ink-muted"}>
            Occurrence details not available — counter may reflect pruned history.
          </p>
        </Section>
      );
    }

    const description = hasStoredGap
      ? `Showing last ${storedCount} stored of ${totalCount.toLocaleString()} total`
      : undefined;

    return (
      <div data-slot="issue-occurrences" data-mode="list" className="epure-issue-occurrences">
        <Section className={sectionClass}>
        <SectionHeader
          title="Recent occurrences"
          description={description}
          className={spacious ? "mb-4" : undefined}
        />
        <div className="epure-inset-well overflow-hidden">
          <ul>
            {recent.map((event, index) => {
              const selected = event.id === effectiveSelectedId;
              return (
                <li
                  key={event.id}
                  className={cn(index > 0 && "border-t border-border")}
                >
                  <button
                    type="button"
                    className={cn(
                      "epure-occurrence-list-item flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 text-left transition-colors duration-fast focus-ring select-none",
                      spacious ? "px-3 py-3 text-base" : "px-2 py-1 text-sm",
                      selected ? "bg-state-selected" : "hover:bg-state-hover",
                    )}
                    onClick={() => onSelectEvent(event.id, event)}
                  >
                    <span
                      className="shrink-0 text-ink-muted"
                      title={new Date(event.occurred_at).toLocaleString()}
                    >
                      {formatRelativeTime(event.occurred_at)}
                    </span>
                    <span className="min-w-0 truncate font-mono text-ink">
                      {formatUser(event)}
                    </span>
                    <span className="font-mono text-ink-muted">
                      {event.environment ?? issue.environment ?? "-"}
                    </span>
                    <span className="font-mono-slash text-ink-muted">
                      {event.release ?? "-"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>
    </div>
    );
  }

  // -------------------------------------------------------------------------
  // Mode: Detail (Selected Occurrence Card + List)
  // -------------------------------------------------------------------------
  if (mode === "detail") {
    const selectedEvent = events.find((e) => e.id === selectedEventId) ?? events[0];
    return (
      <div data-slot="issue-occurrences" data-mode="detail" className={cn("space-y-4", className)}>
        {selectedEvent ? (
          <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
              <span className="font-mono text-xs font-semibold text-fg-primary">
                Event {selectedEvent.id.slice(0, 8)}
              </span>
              <span className="font-mono text-2xs text-fg-muted">
                {new Date(selectedEvent.occurred_at).toLocaleString()}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-fg-muted">User: </span>
                <span className="font-mono text-fg-primary">{formatUser(selectedEvent)}</span>
              </div>
              <div>
                <span className="text-fg-muted">Runtime: </span>
                <span className="font-mono text-fg-primary">{formatRuntime(selectedEvent)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-fg-muted">Error: </span>
                <span className="font-mono text-fg-primary">
                  {errorFromPayload(selectedEvent.payload_json)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <IssueOccurrences
          mode="list"
          issue={issue}
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          limit={limit}
          spacious={spacious}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Mode: Table (Infinite Scrolling Occurrences Table)
  // -------------------------------------------------------------------------
  return (
    <TableOccurrencesSection
      issue={issue}
      events={events}
      total={total ?? events.length}
      hasMore={hasMore}
      loading={loading}
      loadingMore={loadingMore}
      selectedEventId={selectedEventId}
      onSelectEvent={onSelectEvent}
      onLoadMore={onLoadMore}
      collapsible={collapsible}
      defaultExpanded={defaultExpanded}
      className={className}
    />
  );
}

function TableOccurrencesSection({
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
  className,
}: {
  issue: IssueSummary;
  events: EventDetail[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string, event: EventDetail) => void;
  onLoadMore?: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}) {
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
    if (!sentinel || !root || !expanded || !hasMore || loading || loadingMore || !onLoadMore) {
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
      <Section className={cn(SECTION_CLASS, className)}>
        <SectionHeader title="Occurrences" />
        <p className="py-4 text-center text-sm text-ink-muted">Loading occurrences…</p>
      </Section>
    );
  }

  if (!loading && events.length === 0) {
    return (
      <Section className={cn(SECTION_CLASS, className)}>
        <SectionHeader title="Occurrences" />
        <p className="py-4 text-center text-sm text-ink-muted">
          No stored occurrences — counter may reflect pruned history.
        </p>
      </Section>
    );
  }

  return (
    <div data-slot="issue-occurrences" data-mode="table" className="epure-issue-occurrences">
      <Section className={cn(SECTION_CLASS, className)}>
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
                          <span className="text-ink-muted">
                            {formatRelativeTime(event.occurred_at)}
                          </span>
                          <span className="mt-0.5 block font-mono text-2xs text-ink-muted/80">
                            {new Date(event.occurred_at).toLocaleString()}
                          </span>
                        </td>
                        <td
                          className={cn(TD, "max-w-[10rem] truncate font-mono")}
                          title={formatUser(event)}
                        >
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backwards-Compatible Drop-In Wrappers
// ---------------------------------------------------------------------------

export interface IssueRecentOccurrencesProps {
  issue: IssueSummary;
  events: EventDetail[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string, event?: EventDetail) => void;
  spacious?: boolean;
}

export function IssueRecentOccurrences({
  issue,
  events,
  selectedEventId,
  onSelectEvent,
  spacious = false,
}: IssueRecentOccurrencesProps) {
  return (
    <IssueOccurrences
      mode="list"
      issue={issue}
      events={events}
      selectedEventId={selectedEventId}
      onSelectEvent={onSelectEvent}
      spacious={spacious}
    />
  );
}

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
  return (
    <IssueOccurrences
      mode="table"
      issue={issue}
      events={events}
      total={total}
      hasMore={hasMore}
      loading={loading}
      loadingMore={loadingMore}
      selectedEventId={selectedEventId}
      onSelectEvent={onSelectEvent}
      onLoadMore={onLoadMore}
      collapsible={collapsible}
      defaultExpanded={defaultExpanded}
    />
  );
}
