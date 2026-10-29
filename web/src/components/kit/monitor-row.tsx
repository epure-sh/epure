import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DotsThree,
  Pause,
  Play,
  Copy,
  Warning,
  WarningCircle,
  Clock,
  CheckCircle,
  CircleNotch,
  Eye,
  PencilSimple,
  Trash,
} from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format-time";
import { fetchMonitorDetails, type MonitorCheckIn } from "@/lib/api";
import { TelemetryChart } from "@/components/kit/telemetry-chart";
import {
  MonitorDurationStrip,
  type DurationStripRun,
} from "./monitor-duration-strip";

/** Equal-track list aligned with Issues feed chrome (soft hairline only). */
export const MONITOR_ROW_GRID =
  "grid-cols-[1.75rem_minmax(7rem,1.05fr)_minmax(8.5rem,1.2fr)_minmax(8rem,1.1fr)_4.25rem_5rem_2.25rem] gap-x-3";

export type MonitorRowStatus =
  | "ok"
  | "in_progress"
  | "error"
  | "missed"
  | "timeout"
  | "paused";

export interface MonitorRowData {
  id: string;
  name: string;
  slug: string;
  environment: string | null;
  status: MonitorRowStatus;
  paused: boolean;
  scheduleHuman: string;
  scheduleRaw: string | null;
  timezone: string | null;
  lastCheckInAt: string | null;
  lastDurationMs: number | null;
  nextLabel: string;
  runs: DurationStripRun[];
  checkinMarginMins?: number;
  maxRuntimeMins?: number;
  failureIssueThreshold?: number;
}

export interface MonitorRowProps {
  monitor: MonitorRowData;
  expanded?: boolean;
  onToggle?: () => void;
  onTogglePause?: () => void;
  onDetails?: () => void;
  onEdit?: () => void;
  onCopySnippet?: () => void;
  onDelete?: () => void;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_LABEL: Record<MonitorRowStatus, string> = {
  ok: "Healthy",
  in_progress: "Running",
  error: "Crashed",
  missed: "Missed",
  timeout: "Timed out",
  paused: "Paused",
};

export function MonitorStatusIcon({
  status,
  paused,
}: {
  status: MonitorRowStatus;
  paused?: boolean;
}) {
  const resolved: MonitorRowStatus = paused || status === "paused" ? "paused" : status;
  const label = STATUS_LABEL[resolved];

  let icon = <CheckCircle size={16} weight="fill" className="text-healthy" />;
  if (resolved === "paused") {
    icon = <Pause size={16} weight="fill" className="text-fg-muted" />;
  } else if (resolved === "in_progress") {
    icon = <CircleNotch size={16} className="animate-spin text-info" />;
  } else if (resolved === "error") {
    icon = <WarningCircle size={16} weight="fill" className="text-escalating" />;
  } else if (resolved === "timeout") {
    icon = <Clock size={16} weight="fill" className="text-escalating" />;
  } else if (resolved === "missed") {
    icon = <Warning size={16} weight="fill" className="text-regression" />;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex size-5 items-center justify-center" aria-label={label}>
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** @deprecated Prefer MonitorStatusIcon. */
export function MonitorStatusBadge({
  status,
  paused,
}: {
  status: MonitorRowStatus;
  paused?: boolean;
}) {
  return <MonitorStatusIcon status={status} paused={paused} />;
}

type LogSortKey = "status" | "duration_ms" | "created_at";

function formatPreciseTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${ms.toFixed(0)}ms`;
}

function ExpandedDetail({ monitor }: { monitor: MonitorRowData }) {
  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState<MonitorCheckIn[]>([]);
  const [sortKey, setSortKey] = useState<LogSortKey>("created_at");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchMonitorDetails(monitor.id)
      .then((res) => {
        if (!cancelled) setCheckIns(res.check_ins);
      })
      .catch(() => {
        if (!cancelled) setCheckIns([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [monitor.id]);

  const chartPoints = useMemo(
    () =>
      [...checkIns]
        .slice()
        .reverse()
        .map((c) => ({
          time: new Date(c.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          value: Math.round(c.duration_ms ?? 0),
        })),
    [checkIns],
  );

  const sortedLogs = useMemo(() => {
    const dir = sortDesc ? -1 : 1;
    return [...checkIns].sort((a, b) => {
      if (sortKey === "duration_ms") {
        return ((a.duration_ms ?? -1) - (b.duration_ms ?? -1)) * dir;
      }
      if (sortKey === "created_at") {
        return (Date.parse(a.created_at) - Date.parse(b.created_at)) * dir;
      }
      return String(a.status).localeCompare(String(b.status)) * dir;
    });
  }, [checkIns, sortKey, sortDesc]);

  function toggleSort(key: LogSortKey) {
    if (sortKey === key) {
      setSortDesc((d) => !d);
      return;
    }
    setSortKey(key);
    setSortDesc(key === "created_at");
  }

  const overdue = monitor.nextLabel.startsWith("Overdue");

  return (
    <div
      data-slot="monitor-row-expanded"
      className="space-y-2.5 border-b border-border-subtle px-3 pt-2.5 pb-4"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {monitor.environment ? (
          <Badge variant="env" size="sm">
            {monitor.environment}
          </Badge>
        ) : null}
        <Badge variant={overdue ? "regression" : "info"} size="sm">
          <Clock size={11} weight="fill" />
          {monitor.nextLabel}
        </Badge>
        {monitor.timezone ? (
          <Badge variant="neutral" size="sm">
            {monitor.timezone}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <div className="overflow-hidden rounded-md border border-border-subtle bg-surface-1">
          <div className="flex items-center justify-between border-b border-border-subtle/80 px-2.5 py-1.5">
            <p className="text-[11px] font-medium text-fg-muted">Duration trend</p>
            <p className="font-mono text-2xs text-fg-muted">ms</p>
          </div>
          <div className="px-1.5 py-2">
            {chartPoints.length > 1 ? (
              <TelemetryChart
                data={chartPoints}
                height={120}
                color="info"
                showAxes
                fitYToData
                valueSuffix="ms"
              />
            ) : (
              <p className="px-2 py-8 text-center text-xs text-fg-muted">
                {loading ? "Loading trend…" : "Not enough runs for a trend yet."}
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border-subtle bg-surface-1">
          <div className="flex items-center justify-between border-b border-border-subtle/80 px-2.5 py-1.5">
            <p className="text-[11px] font-medium text-fg-muted">Check-in log</p>
            <p className="font-mono text-2xs tabular-nums text-fg-muted">
              {checkIns.length} runs
            </p>
          </div>
          <div className="max-h-52 overflow-x-hidden overflow-y-auto">
            {loading ? (
              <p className="px-2.5 py-6 text-center text-xs text-fg-muted">Loading…</p>
            ) : sortedLogs.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-xs text-fg-muted">No check-ins yet.</p>
            ) : (
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 z-[1] bg-surface-1">
                  <TableRow className="hover:bg-transparent border-border-subtle/70">
                    <TableHead className="h-7 w-[28%] px-2 text-[10px] font-medium">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-auto px-0 py-0 text-[10px] text-fg-muted hover:text-fg-secondary"
                        onClick={() => toggleSort("status")}
                      >
                        Status{sortKey === "status" ? (sortDesc ? " ↓" : " ↑") : ""}
                      </Button>
                    </TableHead>
                    <TableHead className="h-7 w-[22%] px-2 text-[10px] font-medium">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-auto px-0 py-0 text-[10px] text-fg-muted hover:text-fg-secondary"
                        onClick={() => toggleSort("duration_ms")}
                      >
                        Duration{sortKey === "duration_ms" ? (sortDesc ? " ↓" : " ↑") : ""}
                      </Button>
                    </TableHead>
                    <TableHead className="h-7 w-[50%] px-2 text-right text-[10px] font-medium">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-auto px-0 py-0 text-[10px] text-fg-muted hover:text-fg-secondary"
                        onClick={() => toggleSort("created_at")}
                      >
                        Timestamp{sortKey === "created_at" ? (sortDesc ? " ↓" : " ↑") : ""}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLogs.map((ci) => (
                    <TableRow
                      key={ci.id}
                      className="border-border-subtle/50 hover:bg-state-hover/50"
                    >
                      <TableCell className="h-7 px-2 py-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <MonitorStatusIcon status={ci.status as MonitorRowStatus} />
                          <span className="truncate text-2xs capitalize text-fg-secondary">
                            {ci.status.replace("_", " ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="h-7 px-2 py-0 font-mono text-2xs tabular-nums text-fg-secondary">
                        {formatDurationMs(ci.duration_ms)}
                      </TableCell>
                      <TableCell className="h-7 truncate px-2 py-0 text-right font-mono text-2xs tabular-nums text-fg-muted">
                        {formatPreciseTimestamp(ci.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MonitorRow({
  monitor,
  expanded,
  onToggle,
  onTogglePause,
  onDetails,
  onEdit,
  onCopySnippet,
  onDelete,
}: MonitorRowProps) {
  const displayStatus: MonitorRowStatus = monitor.paused ? "paused" : monitor.status;

  return (
    <div
      data-slot="monitor-row"
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle?.();
        }
      }}
      className={cn(
        "w-full cursor-pointer transition-colors duration-200",
        !expanded && "hover:bg-state-hover",
      )}
    >
      {/* Summary keeps collapsed chrome; its border-b is the expand separator. */}
      <div
        className={cn(
          "grid w-full items-start border-b border-border-subtle px-3 py-2.5",
          MONITOR_ROW_GRID,
        )}
      >
        <div className="flex h-8 items-center">
          <MonitorStatusIcon status={displayStatus} paused={monitor.paused} />
        </div>

        <div className="min-w-0 py-0.5">
          <div className="truncate text-sm font-medium tracking-ui text-fg-primary">
            {monitor.name}
          </div>
          <div className="truncate font-mono text-2xs text-fg-muted">{monitor.slug}</div>
        </div>

        <div className="min-w-0 py-0.5">
          <div className="whitespace-normal break-words text-xs leading-snug text-fg-secondary">
            {monitor.scheduleHuman}
          </div>
          <div className="mt-0.5 whitespace-normal break-all font-mono text-2xs text-fg-muted">
            {monitor.scheduleRaw || "heartbeat"}
          </div>
        </div>

        <div className="min-w-0 py-0.5">
          <MonitorDurationStrip runs={monitor.runs} days={7} maxSlots={36} minSlots={10} />
        </div>

        <div className="flex h-8 items-center font-mono text-xs tabular-nums text-fg-secondary">
          {formatDuration(monitor.lastDurationMs)}
        </div>

        <div className="flex h-8 items-center text-xs text-fg-secondary">
          {monitor.lastCheckInAt ? formatRelativeTime(monitor.lastCheckInAt) : "Never"}
        </div>

        <div
          className="flex h-8 items-center justify-end gap-0.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onTogglePause}
            aria-label={monitor.paused ? "Resume monitor" : "Pause monitor"}
          >
            {monitor.paused ? (
              <Play size={15} weight="fill" />
            ) : (
              <Pause size={15} weight="fill" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Monitor actions">
                <DotsThree size={14} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  (onDetails ?? onToggle)?.();
                }}
              >
                <Eye size={12} />
                Details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onCopySnippet}>
                <Copy size={12} />
                Copy snippet
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit}>
                <PencilSimple size={12} />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} className="text-escalating">
                <Trash size={12} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {expanded ? <ExpandedDetail monitor={monitor} /> : null}
    </div>
  );
}

export function MonitorTable({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="monitor-table"
      className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-xs"
    >
      <div
        className={cn(
          "sticky top-0 z-10 grid h-8 w-full items-center border-b border-border-subtle bg-surface-2/90 px-3 text-[11px] font-medium text-fg-muted backdrop-blur-xs select-none",
          MONITOR_ROW_GRID,
        )}
      >
        <span className="sr-only">Status</span>
        <span>Monitor</span>
        <span>Schedule</span>
        <span>History</span>
        <span>Duration</span>
        <span>Last fired</span>
        <span className="sr-only">Actions</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
