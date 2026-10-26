import * as React from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "@/components/kit/page-shell";
import { TelemetryChart } from "@/components/kit/telemetry-chart";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/shell/app-context";
import {
  fetchHeadlineStats,
  fetchIssues,
  fetchProjectActivity,
  fetchReleases,
  type HeadlineStats,
  type IssueSummary,
  type ReleaseSummary,
  type TimelineBucket,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format-time";
import { formatCompactCount } from "@/lib/format-count";
import { isDemoProject } from "@/lib/demo-utils";
import { bucketsToTelemetry } from "@/features/org/project-usage";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Users } from "lucide-react";

interface MonitoringData {
  stats24h: HeadlineStats;
  stats7d: HeadlineStats | null;
  issues24h: IssueSummary[];
  activity: TimelineBucket[];
  latestRelease: ReleaseSummary | null;
}

function latestRelease(releases: ReleaseSummary[]): ReleaseSummary | null {
  const seen = (release: ReleaseSummary) =>
    new Date(release.last_seen_at ?? release.first_seen_at ?? 0).getTime();
  return releases.reduce<ReleaseSummary | null>(
    (latest, release) => (!latest || seen(release) > seen(latest) ? release : latest),
    null,
  );
}

function MetricCard({
  label,
  value,
  unit,
  hint,
  aside,
  loading,
}: {
  label: string;
  value: string;
  unit: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        {aside}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold tracking-tight tabular-nums text-fg-primary">
          {loading ? "…" : value}
        </span>
        <span className="font-mono text-xs text-fg-muted">{unit}</span>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-fg-muted">{hint}</p> : null}
    </div>
  );
}

export function MonitoringPage({ isEmbed = false }: { isEmbed?: boolean }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, environment } = useAppContext();
  const safeProjects = Array.isArray(projects) ? projects : [];
  const project =
    safeProjects.find((p) => p && (p.id === projectId || p.slug === projectId)) ??
    safeProjects.find((p) => p && !isDemoProject(p)) ??
    safeProjects[0] ??
    null;
  const activeProjectId = project?.id ?? null;

  const [data, setData] = React.useState<MonitoringData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  React.useEffect(() => {
    if (!activeProjectId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchHeadlineStats(activeProjectId, environment, "24h"),
      fetchHeadlineStats(activeProjectId, environment, "7d").catch(() => null),
      fetchIssues("", activeProjectId, "24h", undefined, environment).catch(() => [] as IssueSummary[]),
      fetchProjectActivity(activeProjectId).catch(() => [] as TimelineBucket[]),
      fetchReleases(activeProjectId).catch(() => [] as ReleaseSummary[]),
    ])
      .then(([stats24h, stats7d, issues24h, activity, releases]) => {
        if (cancelled) return;
        setData({ stats24h, stats7d, issues24h, activity, latestRelease: latestRelease(releases) });
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("Could not load monitoring data for this project.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, environment, reloadNonce]);

  const events24h = data?.stats24h.events_7d ?? 0;
  const dailyBaseline = data?.stats7d ? data.stats7d.events_7d / 7 : null;
  const changeVsBaseline =
    dailyBaseline && dailyBaseline > 0 ? ((events24h - dailyBaseline) / dailyBaseline) * 100 : null;
  const affectedUsers = (data?.issues24h ?? []).reduce(
    (sum, issue) => sum + (issue.affected_users_count ?? issue.unique_user_count ?? 0),
    0,
  );
  const regressions = data?.stats24h.regressions ?? 0;
  const unresolved = data?.stats24h.unresolved ?? 0;
  const snoozed = data?.stats24h.snoozed ?? 0;
  const health: "calm" | "attention" | "regressions" =
    regressions > 0 ? "regressions" : unresolved > 0 ? "attention" : "calm";
  const chartData = React.useMemo(() => bucketsToTelemetry(data?.activity ?? []), [data?.activity]);
  const hasActivity = (data?.activity ?? []).some((bucket) => bucket.count > 0);

  const content = !activeProjectId ? (
    <EmptyState title="No project selected" description="Create or select a project to see its health." />
  ) : error ? (
    <EmptyState
      title="Monitoring unavailable"
      description={error}
      actionLabel="Retry"
      onAction={() => setReloadNonce((value) => value + 1)}
    />
  ) : (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div
            className={
              health === "calm"
                ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-healthy/15 text-healthy"
                : health === "attention"
                  ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-regression/15 text-regression"
                  : "flex size-10 shrink-0 items-center justify-center rounded-full bg-escalating/15 text-escalating"
            }
          >
            {health === "calm" ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-fg-primary">
                {loading
                  ? "Checking project health…"
                  : health === "calm"
                    ? "All calm"
                    : health === "attention"
                      ? "Needs attention"
                      : "Regressions detected"}
              </h2>
              {!loading ? (
                <Badge
                  variant={health === "calm" ? "healthy" : health === "attention" ? "regression" : "escalating"}
                  size="sm"
                >
                  {environment}
                </Badge>
              ) : null}
            </div>
            {!loading ? (
              <p className="mt-1 text-xs text-fg-muted">
                <span className="tabular-nums">{unresolved}</span> unresolved ·{" "}
                <span className="tabular-nums">{regressions}</span> came back ·{" "}
                <span className="tabular-nums">{snoozed}</span> snoozed
                {data?.latestRelease ? (
                  <>
                    {" "}
                    · latest release{" "}
                    <span className="font-mono font-medium text-fg-secondary">{data.latestRelease.version}</span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Exceptions (24h)"
          value={events24h.toLocaleString()}
          unit="events"
          loading={loading}
          aside={
            changeVsBaseline !== null && !loading ? (
              <span
                className={
                  changeVsBaseline > 0
                    ? "flex items-center gap-0.5 text-xs font-medium tabular-nums text-escalating"
                    : "flex items-center gap-0.5 text-xs font-medium tabular-nums text-healthy"
                }
              >
                {changeVsBaseline > 0 ? "+" : ""}
                {changeVsBaseline.toFixed(1)}%
                {changeVsBaseline > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              </span>
            ) : null
          }
          hint={
            dailyBaseline !== null ? (
              <>
                7-day daily average:{" "}
                <span className="tabular-nums">{formatCompactCount(Math.round(dailyBaseline))}</span> events
              </>
            ) : undefined
          }
        />
        <MetricCard
          label="Affected users (24h)"
          value={affectedUsers.toLocaleString()}
          unit="users"
          loading={loading}
          aside={<Users className="size-3.5 text-fg-muted" />}
          hint={
            <>
              Summed across <span className="tabular-nums">{data?.issues24h.length ?? 0}</span> issues seen in
              the last 24h
            </>
          }
        />
        <MetricCard
          label="Open issues"
          value={(unresolved + regressions).toLocaleString()}
          unit="issues"
          loading={loading}
          hint={
            <>
              <span className="tabular-nums">{regressions}</span> came back after being resolved
            </>
          }
        />
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-1 p-5 shadow-xs">
        <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Exception volume (last 30 days)
            </h3>
            <p className="mt-0.5 text-xs text-fg-muted">Daily stored events across all environments</p>
          </div>
          {data?.latestRelease ? (
            <span className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-0.5 font-mono text-2xs text-fg-secondary">
              <span className="size-1.5 rounded-full bg-intent-primary" />
              {data.latestRelease.version}
              {data.latestRelease.last_seen_at
                ? ` · seen ${formatRelativeTime(data.latestRelease.last_seen_at)}`
                : ""}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="h-[200px] animate-pulse rounded-md bg-surface-2/60" />
        ) : hasActivity ? (
          <TelemetryChart data={chartData} height={200} color="primary" />
        ) : (
          <p className="py-16 text-center text-xs text-fg-muted">No events in the last 30 days.</p>
        )}
      </div>
    </div>
  );

  if (isEmbed) {
    return (
      <div className="min-h-screen bg-canvas p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">{content}</div>
      </div>
    );
  }

  return (
    <PageShell
      title="Monitoring"
      description={project ? `Live health and exception volume for ${project.name}.` : "Live project health."}
      density="standard"
    >
      {content}
    </PageShell>
  );
}
