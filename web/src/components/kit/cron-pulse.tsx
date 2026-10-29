import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-time";
import type { MonitorItem } from "@/lib/api";

export interface CronPulseProps {
  monitors: MonitorItem[];
  viewAllHref: string;
  loading?: boolean;
  className?: string;
}

function statusVariant(status: MonitorItem["status"]): "healthy" | "escalating" | "regression" | "info" {
  switch (status) {
    case "ok":
      return "healthy";
    case "error":
      return "escalating";
    case "missed":
      return "regression";
    default:
      return "info";
  }
}

function statusLabel(status: MonitorItem["status"]): string {
  switch (status) {
    case "ok":
      return "Healthy";
    case "error":
      return "Failed";
    case "missed":
      return "Missed";
    case "in_progress":
      return "Running";
    default:
      return status;
  }
}

export function CronPulse({ monitors, viewAllHref, loading = false, className }: CronPulseProps) {
  const healthy = monitors.filter((m) => m.status === "ok").length;
  const failing = monitors.filter((m) => m.status === "error").length;
  const missed = monitors.filter((m) => m.status === "missed").length;
  const attention = monitors
    .filter((m) => m.status === "error" || m.status === "missed")
    .slice(0, 4);
  const preview = attention.length > 0 ? attention : monitors.slice(0, 4);

  return (
    <div data-slot="cron-pulse" className={cn("flex h-full flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="healthy" size="sm">
          {loading ? "…" : healthy} Healthy
        </Badge>
        <Badge variant="escalating" size="sm">
          {loading ? "…" : failing} Failing
        </Badge>
        <Badge variant="regression" size="sm">
          {loading ? "…" : missed} Missed
        </Badge>
        <span className="ml-auto font-mono text-[11px] text-fg-muted tabular-nums">
          {monitors.length} active
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-control bg-surface-2/60" />
          ))}
        </div>
      ) : monitors.length === 0 ? (
        <p className="py-8 text-center text-xs text-fg-muted">No cron monitors yet.</p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1">
          {preview.map((monitor) => (
            <li
              key={monitor.id}
              className="flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-surface-2/50"
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  monitor.status === "ok" && "bg-healthy",
                  monitor.status === "error" && "bg-escalating",
                  monitor.status === "missed" && "bg-regression",
                  monitor.status === "in_progress" && "bg-info",
                )}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-primary">
                {monitor.slug}
              </span>
              <Badge variant={statusVariant(monitor.status)} size="sm">
                {statusLabel(monitor.status)}
              </Badge>
              <span className="shrink-0 font-mono text-[10px] text-fg-muted tabular-nums">
                {monitor.last_check_in_at ? formatRelativeTime(monitor.last_check_in_at) : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        to={viewAllHref}
        className="mt-auto text-xs font-medium text-fg-secondary transition-colors hover:text-fg-primary"
      >
        View all monitors →
      </Link>
    </div>
  );
}
