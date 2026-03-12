import {
  AlertTriangle,
  Globe,
  MousePointerClick,
  Navigation,
  Search,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { EventDetail } from "../lib/api";
import { cn } from "../lib/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { FilterChip } from "./filter-chip";
import { Input } from "./input";
import { OccurrencePicker } from "./occurrence-picker";

const INLINE_CAP = 10;

type BreadcrumbFilter = "all" | "http" | "console" | "errors";

interface Breadcrumb {
  category?: string;
  message?: string;
  level?: string;
  timestamp?: number;
  data?: Record<string, unknown>;
}

interface OrderedCrumb {
  crumb: Breadcrumb;
  index: number;
  sortKey: number;
}

function asBreadcrumbs(value: unknown): Breadcrumb[] {
  if (Array.isArray(value)) {
    return value as Breadcrumb[];
  }
  if (value && typeof value === "object" && Array.isArray((value as { values?: unknown }).values)) {
    return (value as { values: Breadcrumb[] }).values;
  }
  return [];
}

function crumbTimestampMs(timestamp?: number): number | null {
  if (timestamp == null) {
    return null;
  }
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return Number.isNaN(ms) ? null : ms;
}

function matchesFilter(crumb: Breadcrumb, filter: BreadcrumbFilter): boolean {
  const category = (crumb.category ?? "").toLowerCase();
  const level = (crumb.level ?? "").toLowerCase();

  switch (filter) {
    case "http":
      return category.includes("fetch") || category.includes("http") || category.includes("xhr");
    case "console":
      return category.includes("console");
    case "errors":
      return level === "error" || level === "fatal" || level === "warning";
    default:
      return true;
  }
}

function filterLabel(value: BreadcrumbFilter): string {
  switch (value) {
    case "http":
      return "HTTP";
    case "console":
      return "Console";
    case "errors":
      return "Errors";
    default:
      return "All";
  }
}

function isErrorLevel(level?: string): boolean {
  const value = (level ?? "").toLowerCase();
  return value === "error" || value === "fatal" || value === "warning";
}

function categoryKind(category?: string): "http" | "console" | "nav" | "ui" | "error" | "default" {
  const value = (category ?? "").toLowerCase();
  if (value.includes("fetch") || value.includes("http") || value.includes("xhr")) {
    return "http";
  }
  if (value.includes("console")) {
    return "console";
  }
  if (value.includes("navigation")) {
    return "nav";
  }
  if (value.includes("ui") || value.includes("click")) {
    return "ui";
  }
  if (value.includes("error")) {
    return "error";
  }
  return "default";
}

function categoryIcon(kind: ReturnType<typeof categoryKind>, isError: boolean): LucideIcon {
  if (isError) {
    return AlertTriangle;
  }
  switch (kind) {
    case "http":
      return Globe;
    case "console":
      return Terminal;
    case "nav":
      return Navigation;
    case "ui":
      return MousePointerClick;
    default:
      return Terminal;
  }
}

function displayMessage(crumb: Breadcrumb): string {
  const data = crumb.data;
  if (data) {
    const method = typeof data.method === "string" ? data.method : null;
    const url = typeof data.url === "string" ? data.url : null;
    const status = typeof data.status_code === "number" ? data.status_code : null;
    const label = typeof data.label === "string" ? data.label : null;

    if (method && url) {
      return status != null ? `${method} ${url} → ${status}` : `${method} ${url}`;
    }
    if (label) {
      return label;
    }
  }

  return crumb.message ?? "";
}

function orderCrumbs(crumbs: Breadcrumb[]): OrderedCrumb[] {
  return crumbs
    .map((crumb, index) => ({
      crumb,
      index,
      sortKey: crumbTimestampMs(crumb.timestamp) ?? index,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

function formatRelativeOffset(sortKey: number, baseMs: number): string {
  const deltaSec = (sortKey - baseMs) / 1000;
  if (deltaSec < 0.05) {
    return "+0.0s";
  }
  if (deltaSec < 60) {
    return `+${deltaSec.toFixed(1)}s`;
  }
  const minutes = Math.floor(deltaSec / 60);
  const seconds = Math.floor(deltaSec % 60);
  return `+${minutes}m ${seconds}s`;
}

function trailSummary(ordered: OrderedCrumb[]): string | null {
  if (ordered.length === 0) {
    return null;
  }
  const baseMs = ordered[0].sortKey;
  const lastMs = ordered[ordered.length - 1].sortKey;
  const spanSec = Math.max(0, (lastMs - baseMs) / 1000);
  const steps = ordered.length;
  const spanLabel = spanSec < 60 ? `${spanSec.toFixed(1)}s` : `${Math.floor(spanSec / 60)}m ${Math.floor(spanSec % 60)}s`;
  return `${steps} step${steps === 1 ? "" : "s"} · ${spanLabel} trail`;
}

function BreadcrumbFilterBar({
  filter,
  onFilterChange,
}: {
  filter: BreadcrumbFilter;
  onFilterChange: (value: BreadcrumbFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(["all", "http", "console", "errors"] as const).map((value) => (
        <FilterChip
          key={value}
          label={filterLabel(value)}
          active={filter === value}
          onClick={() => onFilterChange(value)}
        />
      ))}
    </div>
  );
}

function BreadcrumbTimelineList({
  crumbs,
  showRelativeTime = true,
}: {
  crumbs: Breadcrumb[];
  showRelativeTime?: boolean;
}) {
  if (crumbs.length === 0) {
    return (
      <p className="px-4 py-8 text-center font-mono text-xs text-ink-muted">
        No breadcrumbs match this filter.
      </p>
    );
  }

  const ordered = orderCrumbs(crumbs);
  const baseMs = ordered[0]?.sortKey ?? 0;

  return (
    <ol className="epure-breadcrumb-trail divide-y divide-border/50">
      {ordered.map(({ crumb, index, sortKey }, position) => {
        const kind = categoryKind(crumb.category);
        const isError = isErrorLevel(crumb.level) || kind === "error";
        const isLast = position === ordered.length - 1;
        const isClimax = isLast && isError;
        const Icon = categoryIcon(kind, isError);
        const message = displayMessage(crumb);

        return (
          <li
            key={`${crumb.timestamp ?? index}-${message}-${index}`}
            className={cn(
              "epure-breadcrumb-row relative flex items-start gap-3 px-4 py-2.5",
              isClimax && "bg-semantic-danger/5",
            )}
          >
            {showRelativeTime ? (
              <span
                className="w-12 shrink-0 pt-px text-right font-mono text-2xs tabular-nums text-ink-muted"
                title={
                  crumb.timestamp != null
                    ? new Date(sortKey).toLocaleTimeString()
                    : undefined
                }
              >
                {formatRelativeOffset(sortKey, baseMs)}
              </span>
            ) : null}

            <div className="relative flex w-5 shrink-0 flex-col items-center self-stretch pt-0.5">
              {position > 0 ? (
                <span
                  className="absolute -top-2.5 bottom-3 w-px bg-border/80"
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-surface",
                  isClimax
                    ? "border-semantic-danger bg-semantic-danger/10 text-semantic-danger"
                    : isError
                      ? "border-semantic-danger/50 text-semantic-danger"
                      : kind === "http"
                        ? "border-accent/30 text-accent"
                        : "border-border text-ink-muted",
                )}
              >
                <Icon className="h-2.5 w-2.5" aria-hidden />
              </span>
            </div>

            <div className="min-w-0 flex-1 pt-px">
              <p
                className={cn(
                  "font-mono text-xs leading-snug break-words",
                  isClimax ? "font-medium text-semantic-danger" : "text-ink",
                )}
              >
                {message}
              </p>
              {crumb.category && message !== crumb.message ? (
                <p className="mt-0.5 truncate font-mono text-2xs text-ink-muted">
                  {crumb.message}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface BreadcrumbTimelineProps {
  events: EventDetail[];
  selectedEventId: string | null;
  selectedEvent?: EventDetail | null;
  onSelectEvent: (id: string, event?: EventDetail) => void;
}

export function BreadcrumbTimeline({
  events,
  selectedEventId,
  selectedEvent: selectedEventProp,
  onSelectEvent,
}: BreadcrumbTimelineProps) {
  const [filter, setFilter] = useState<BreadcrumbFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedEvent =
    selectedEventProp ??
    events.find((event) => event.id === selectedEventId) ??
    events[0] ??
    null;

  const allCrumbs = useMemo(
    () => asBreadcrumbs(selectedEvent?.breadcrumbs),
    [selectedEvent?.breadcrumbs],
  );

  const filteredCrumbs = useMemo(() => {
    let filtered = allCrumbs.filter((crumb) => matchesFilter(crumb, filter));

    if (searchQuery.trim()) {
      try {
        const pattern = new RegExp(searchQuery, "i");
        filtered = filtered.filter(
          (crumb) =>
            pattern.test(crumb.message ?? "") || pattern.test(displayMessage(crumb)),
        );
      } catch {
        const needle = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (crumb) =>
            (crumb.message ?? "").toLowerCase().includes(needle) ||
            displayMessage(crumb).toLowerCase().includes(needle),
        );
      }
    }

    return filtered;
  }, [allCrumbs, filter, searchQuery]);

  const inlineCrumbs = filteredCrumbs.slice(0, INLINE_CAP);
  const hasMore = filteredCrumbs.length > INLINE_CAP;
  const summary = trailSummary(orderCrumbs(filteredCrumbs));

  if (!selectedEvent) {
    return (
      <div className="px-4 py-4">
        <div className="epure-inset-well px-3 py-6 text-center font-mono text-xs text-ink-muted">
          Select an issue to inspect the trail.
        </div>
      </div>
    );
  }

  if (allCrumbs.length === 0) {
    return (
      <div className="epure-breadcrumb-timeline flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center border-b border-border px-4 py-2 md:px-5">
          <OccurrencePicker
            events={events}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            onSelectEvent={onSelectEvent}
          />
        </div>
        <div className="px-4 py-4 md:px-5">
          <div className="epure-inset-well px-3 py-6 text-center font-mono text-xs text-ink-muted">
            No breadcrumbs captured for this occurrence.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="epure-breadcrumb-timeline flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center border-b border-border px-4 py-2 md:px-5">
        <OccurrencePicker
          events={events}
          selectedEventId={selectedEventId}
          selectedEvent={selectedEvent}
          onSelectEvent={onSelectEvent}
        />
      </div>

      <div className="space-y-4 px-4 py-4 md:px-5">
        {summary ? (
          <p className="font-mono text-2xs uppercase tracking-wide text-ink-muted">{summary}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <BreadcrumbFilterBar filter={filter} onFilterChange={setFilter} />
          <div className="relative min-w-0 sm:max-w-[14rem] sm:flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter trail…"
              aria-label="Filter breadcrumbs"
              className="h-7 border-border/80 bg-surface py-1 pr-2 pl-8 font-mono text-xs shadow-none"
            />
          </div>
        </div>

        <div className="epure-breadcrumb-well overflow-hidden rounded-md border border-border bg-surface">
          <BreadcrumbTimelineList crumbs={inlineCrumbs} />
        </div>

        {hasMore ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="text-xs text-accent hover:underline focus-ring"
          >
            View all {filteredCrumbs.length} steps →
          </button>
        ) : null}
      </div>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="fixed inset-y-0 right-0 left-auto top-0 flex h-full w-full max-w-lg translate-x-0 translate-y-0 flex-col rounded-none border-l border-border p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle>Breadcrumb trail</DialogTitle>
            <DialogDescription>
              {summary ?? `${filteredCrumbs.length} entries`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 border-b border-border px-4 py-3">
            <BreadcrumbFilterBar filter={filter} onFilterChange={setFilter} />
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Filter trail…"
                aria-label="Filter breadcrumbs in drawer"
                className="h-8 border-border/80 bg-surface py-1 pr-2 pl-8 font-mono text-xs shadow-none"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-bg-subtle">
            <BreadcrumbTimelineList crumbs={filteredCrumbs} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
