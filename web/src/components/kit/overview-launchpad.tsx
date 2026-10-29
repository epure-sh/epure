import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Key, Plus, Rocket } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-time";
import type { AlertRow, ReleaseSummary } from "@/lib/api";

export interface OverviewLaunchpadProps {
  latestRelease: ReleaseSummary | null;
  latestAlert: AlertRow | null;
  newAlertHref: string;
  newMonitorHref: string;
  dsnHref: string;
  releasesHref: string;
  alertsHref: string;
  loading?: boolean;
  className?: string;
}

function alertTitle(alert: AlertRow): string {
  const payload = alert.payload_json ?? {};
  const title =
    (typeof payload.title === "string" && payload.title) ||
    (typeof payload.issue_title === "string" && payload.issue_title) ||
    alert.kind;
  return title;
}

export function OverviewLaunchpad({
  latestRelease,
  latestAlert,
  newAlertHref,
  newMonitorHref,
  dsnHref,
  releasesHref,
  alertsHref,
  loading = false,
  className,
}: OverviewLaunchpadProps) {
  return (
    <div data-slot="overview-launchpad" className={cn("flex h-full flex-col gap-4", className)}>
      <div className="space-y-2.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-xs bg-surface-2 text-fg-secondary">
            <Rocket className="size-3.5" weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-wide text-fg-muted">Latest release</p>
            {loading ? (
              <p className="mt-1 text-xs text-fg-muted">…</p>
            ) : latestRelease ? (
              <>
                <Link
                  to={releasesHref}
                  className="mt-0.5 block truncate font-mono text-sm font-medium text-fg-primary hover:underline"
                >
                  {latestRelease.version}
                </Link>
                <p className="mt-0.5 text-[11px] text-fg-muted">
                  {(() => {
                    const seenAt = latestRelease.last_seen_at ?? latestRelease.first_seen_at;
                    return seenAt ? formatRelativeTime(seenAt) : "No timestamp";
                  })()}
                  {latestRelease.new_issue_count > 0
                    ? ` · ${latestRelease.new_issue_count} new issue${latestRelease.new_issue_count === 1 ? "" : "s"}`
                    : " · no new issues"}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-fg-muted">No releases recorded yet.</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-xs bg-surface-2 text-fg-secondary">
            <Bell className="size-3.5" weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-wide text-fg-muted">Alert activity</p>
            {loading ? (
              <p className="mt-1 text-xs text-fg-muted">…</p>
            ) : latestAlert ? (
              <>
                <Link
                  to={alertsHref}
                  className="mt-0.5 block truncate text-sm font-medium text-fg-primary hover:underline"
                >
                  {alertTitle(latestAlert)}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="neutral" size="sm">
                    {latestAlert.kind}
                  </Badge>
                  <span className="font-mono text-[11px] text-fg-muted">
                    {formatRelativeTime(latestAlert.fired_at)}
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-fg-muted">No alerts fired recently.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">
        <Button variant="secondary" size="xs" asChild>
          <Link to={newAlertHref}>
            <Plus className="size-3" weight="bold" />
            New alert rule
          </Link>
        </Button>
        <Button variant="ghost" size="xs" asChild>
          <Link to={newMonitorHref}>
            <Plus className="size-3" weight="bold" />
            New cron monitor
          </Link>
        </Button>
        <Button variant="ghost" size="xs" asChild>
          <Link to={dsnHref}>
            <Key className="size-3" weight="bold" />
            DSN &amp; SDK
          </Link>
        </Button>
      </div>
    </div>
  );
}
