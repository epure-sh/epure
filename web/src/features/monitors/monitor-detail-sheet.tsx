import { useEffect, useMemo, useState } from "react";
import { MonitorStatusIcon } from "@/components/kit/monitor-row";
import { TelemetryChart } from "@/components/kit/telemetry-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/format-time";
import {
  fetchMonitorDetails,
  type MonitorCheckIn,
  type MonitorItem,
} from "@/lib/api";
import { humanizeSchedule, parseStoredSchedule } from "./schedule";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export interface MonitorDetailSheetProps {
  monitor: MonitorItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPauseToggle: (monitor: MonitorItem) => void;
  onEdit: (monitor: MonitorItem) => void;
  onCopySnippet: (monitor: MonitorItem) => void;
}

export function MonitorDetailSheet({
  monitor,
  open,
  onOpenChange,
  onPauseToggle,
  onEdit,
  onCopySnippet,
}: MonitorDetailSheetProps) {
  const [loading, setLoading] = useState(false);
  const [checkIns, setCheckIns] = useState<MonitorCheckIn[]>([]);
  const [failuresOnly, setFailuresOnly] = useState(false);

  useEffect(() => {
    if (!open || !monitor) return;
    setLoading(true);
    setCheckIns([]);
    void fetchMonitorDetails(monitor.id)
      .then((res) => setCheckIns(res.check_ins))
      .catch(() => setCheckIns([]))
      .finally(() => setLoading(false));
  }, [open, monitor?.id]);

  const schedule = parseStoredSchedule(monitor?.schedule, monitor?.timezone ?? "UTC");
  const filtered = useMemo(() => {
    if (!failuresOnly) return checkIns;
    return checkIns.filter((c) => ["error", "timeout", "missed"].includes(c.status));
  }, [checkIns, failuresOnly]);

  const chartPoints = useMemo(
    () =>
      [...checkIns]
        .reverse()
        .slice(-50)
        .map((c) => ({
          time: c.created_at,
          value: c.duration_ms ?? 0,
        })),
    [checkIns],
  );

  const maxRuntimeMs = (monitor?.max_runtime_mins ?? 30) * 60_000;

  if (!monitor) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]"
      >
        <SheetHeader className="shrink-0 space-y-2 border-b border-border-subtle px-4 py-3 pr-12 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <MonitorStatusIcon
              status={monitor.paused ? "paused" : monitor.status}
              paused={monitor.paused}
            />
            <SheetTitle className="text-base font-medium tracking-ui">
              {monitor.name || monitor.slug}
            </SheetTitle>
          </div>
          <SheetDescription className="font-mono text-xs text-fg-muted">
            {monitor.slug}
            {monitor.environment ? ` · ${monitor.environment}` : ""}
          </SheetDescription>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button type="button" size="xs" variant="secondary" onClick={() => onPauseToggle(monitor)}>
              {monitor.paused ? "Resume" : "Pause"}
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => onEdit(monitor)}>
              Edit thresholds
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => onCopySnippet(monitor)}>
              Copy SDK snippet
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <section className="space-y-1.5">
            <p className="font-mono text-2xs uppercase tracking-wide text-fg-muted">Schedule</p>
            <p className="text-sm text-fg-primary">
              {schedule ? humanizeSchedule(schedule) : "Heartbeat / on-demand"}
            </p>
            <p className="font-mono text-2xs text-fg-muted">
              {monitor.schedule || "—"}
              {monitor.timezone ? ` · ${monitor.timezone}` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="neutral" size="sm">
                Grace {monitor.checkin_margin_mins}m
              </Badge>
              <Badge variant="neutral" size="sm">
                Max {monitor.max_runtime_mins}m
              </Badge>
              <Badge variant="neutral" size="sm">
                Fail after {monitor.failure_issue_threshold}
              </Badge>
            </div>
          </section>

          <section className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-2xs uppercase tracking-wide text-fg-muted">
                Duration trend
              </p>
              <span className="text-2xs text-fg-muted">
                Ceiling {monitor.max_runtime_mins}m
              </span>
            </div>
            {chartPoints.length > 1 ? (
              <div className="rounded-md border border-border-subtle bg-surface-1 p-2">
                <TelemetryChart
                  data={chartPoints}
                  height={120}
                  color="info"
                  showAxes={false}
                />
                <p className="mt-1 text-2xs text-fg-muted">
                  Max runtime ceiling ≈ {(maxRuntimeMs / 1000).toFixed(0)}s
                </p>
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-fg-muted">Not enough runs for a trend yet.</p>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-2xs uppercase tracking-wide text-fg-muted">
                Check-in log
              </p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant={!failuresOnly ? "secondary" : "ghost"}
                  onClick={() => setFailuresOnly(false)}
                >
                  All
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={failuresOnly ? "secondary" : "ghost"}
                  onClick={() => setFailuresOnly(true)}
                >
                  Failures
                </Button>
              </div>
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-fg-muted">Loading check-ins…</p>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-fg-muted">No check-ins yet.</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border-subtle">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((ci) => (
                      <TableRow key={ci.id}>
                        <TableCell>
                          <MonitorStatusIcon
                            status={
                              ci.status as
                                | "ok"
                                | "in_progress"
                                | "error"
                                | "missed"
                                | "timeout"
                            }
                          />
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {formatDuration(ci.duration_ms)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-fg-muted">
                          {formatRelativeTime(ci.created_at)}
                        </TableCell>
                        <TableCell className="max-w-[90px] truncate font-mono text-2xs text-fg-muted">
                          {ci.check_in_id || ci.id.slice(0, 8)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
