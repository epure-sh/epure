import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format-time";

export interface DurationStripRun {
  id: string;
  status: string;
  duration_ms: number | null;
  created_at: string;
  issue_id?: string | null;
}

export interface MonitorDurationStripProps {
  runs: DurationStripRun[];
  /** Keep runs from the last N days (default 7). */
  days?: number;
  maxSlots?: number;
  /** Always render at least this many slots (pads empties). */
  minSlots?: number;
  className?: string;
  showAvgPercent?: boolean;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function filterRunsLastDays(
  runs: DurationStripRun[],
  days = 7,
): DurationStripRun[] {
  const cutoff = Date.now() - days * 86_400_000;
  return runs.filter((r) => {
    const t = Date.parse(r.created_at);
    return Number.isFinite(t) && t >= cutoff;
  });
}

export function monitorStripStats(runs: DurationStripRun[]) {
  const terminal = runs.filter(
    (r) => r.status !== "in_progress" && r.status !== "empty",
  );
  const ok = terminal.filter((r) => r.status === "ok").length;
  const uptime = terminal.length === 0 ? 100 : (ok / terminal.length) * 100;
  const durations = runs
    .map((r) => r.duration_ms)
    .filter((d): d is number => typeof d === "number" && d >= 0);
  const avg =
    durations.length === 0
      ? null
      : durations.reduce((a, b) => a + b, 0) / durations.length;
  const latestFail = [...runs]
    .reverse()
    .find((r) => ["error", "timeout"].includes(r.status));
  return { uptime, avg, latestFail, count: runs.length };
}

/** Status + duration-vs-avg. Slow ok runs turn amber/orange before they fail. */
function dotClass(
  status: string,
  durationMs: number | null,
  avgMs: number | null,
): string {
  switch (status) {
    case "error":
    case "timeout":
      return "bg-escalating";
    case "missed":
      return "border border-dashed border-regression bg-transparent";
    case "in_progress":
      return "animate-pulse bg-info";
    case "ok": {
      if (avgMs == null || avgMs <= 0 || durationMs == null) return "bg-healthy";
      const ratio = durationMs / avgMs;
      if (ratio >= 1.5) return "bg-warning";
      if (ratio >= 1.1) return "bg-regression";
      return "bg-healthy";
    }
    default:
      return "bg-border-subtle/60";
  }
}

export function MonitorDurationStrip({
  runs,
  days = 7,
  maxSlots = 36,
  minSlots = 10,
  className,
  showAvgPercent = true,
}: MonitorDurationStripProps) {
  const recent = useMemo(() => {
    const filtered = filterRunsLastDays(runs, days).slice(-maxSlots);
    const floor = Math.min(minSlots, maxSlots);
    if (filtered.length >= floor) return filtered;
    const pad = floor - filtered.length;
    const empties: DurationStripRun[] = Array.from({ length: pad }, (_, i) => ({
      id: `empty-${i}`,
      status: "empty",
      duration_ms: null,
      created_at: "",
      issue_id: null,
    }));
    return [...empties, ...filtered];
  }, [runs, days, maxSlots, minSlots]);

  const stats = monitorStripStats(
    recent.filter((r) => r.status !== "empty"),
  );

  return (
    <TooltipProvider delayDuration={120}>
      <div data-slot="monitor-duration-strip" className={cn("min-w-0", className)}>
        <div
          className="flex h-4 flex-wrap content-center items-center gap-0.5"
          role="img"
          aria-label={`Last ${days} days · ${recent.length} check-ins`}
        >
          {recent.length === 0 ? (
            <span className="text-2xs text-fg-muted">No runs</span>
          ) : (
            recent.map((run) => (
              <Tooltip key={run.id}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-block size-2 shrink-0 rounded-[2px]",
                      dotClass(run.status, run.duration_ms, stats.avg),
                    )}
                    aria-label={`${run.status} ${formatDuration(run.duration_ms)}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <div className="font-mono text-2xs text-fg-muted">
                    {run.created_at ? formatRelativeTime(run.created_at) : "—"}
                  </div>
                  <div className="mt-0.5 text-fg-primary">
                    {run.status}
                    {run.duration_ms != null ? ` · ${formatDuration(run.duration_ms)}` : ""}
                    {stats.avg != null && run.status === "ok" && run.duration_ms != null
                      ? ` · ${((run.duration_ms / stats.avg) * 100).toFixed(0)}% of avg`
                      : ""}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))
          )}
        </div>
        {showAvgPercent ? (
          <p className="mt-0.5 font-mono-slash text-2xs tabular-nums text-fg-muted">
            avg {stats.uptime.toFixed(0)}%
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
