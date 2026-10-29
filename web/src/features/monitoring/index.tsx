import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { PageShell } from "@/components/kit/page-shell";
import { SectionCard } from "@/components/kit/section-card";
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableColumnDef,
} from "@/components/kit/data-table";
import {
  MonitorStatusIcon,
  type MonitorRowStatus,
} from "@/components/kit/monitor-row";
import { StabilityHeatmap } from "@/components/kit/stability-heatmap";
import { OverviewLaunchpad } from "@/components/kit/overview-launchpad";
import { EmptyState } from "@/components/kit/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, TrendDown, TrendUp } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useAppContext } from "@/shell/app-context";
import {
  fetchAlerts,
  fetchHeadlineStats,
  fetchIssues,
  fetchMonitors,
  fetchProjectActivity,
  fetchProjectVelocity,
  fetchReleases,
  type AlertRow,
  type HeadlineStats,
  type IssueSummary,
  type MonitorItem,
  type ReleaseSummary,
  type TimelineBucket,
  type VelocityBucket,
} from "@/lib/api";
import { formatCompactCount } from "@/lib/format-count";
import { formatRelativeTime } from "@/lib/format-time";
import { issuesFilterPath, projectAlertRulesPath, projectPath, projectSettingsPath } from "@/lib/paths";
import { IssuePriorityBadge, resolveIssuePriority } from "@/ui/issue-priority";
import { OccurrenceLineChart } from "@/ui/occurrence-line-chart";
import { toast } from "@/components/ui/sonner";

type VelocityWindow = "24h" | "7d" | "30d";

/** Soften Orbit DataTable chrome (gray-200 / polar borders → subtle hairlines). */
const SOFT_DATA_TABLE_CLASS = cn(
  "gap-0",
  "[&>div]:rounded-lg [&>div]:border-border-subtle",
  "[&_thead_tr]:border-border-subtle/70",
  "[&_tbody_tr]:border-border-subtle/50",
  "[&_th]:h-9 [&_th]:text-fg-muted",
  "[&_td]:py-2.5",
);

interface OverviewData {
  stats: HeadlineStats;
  previousStats: HeadlineStats | null;
  triage: IssueSummary[];
  activity: TimelineBucket[];
  velocity: VelocityBucket[];
  monitors: MonitorItem[];
  latestRelease: ReleaseSummary | null;
  latestAlert: AlertRow | null;
}

function latestRelease(releases: ReleaseSummary[]): ReleaseSummary | null {
  const seen = (release: ReleaseSummary) =>
    new Date(release.last_seen_at ?? release.first_seen_at ?? 0).getTime();
  return releases.reduce<ReleaseSummary | null>(
    (latest, release) => (!latest || seen(release) > seen(latest) ? release : latest),
    null,
  );
}

function valvePct(stats: HeadlineStats | null | undefined): number | null {
  const seen = stats?.valve_seen ?? 0;
  const stored = stats?.valve_stored ?? 0;
  if (seen <= 0) return null;
  return Math.max(0, Math.min(100, ((seen - stored) / seen) * 100));
}

function pickTriage(issues: IssueSummary[]): IssueSummary[] {
  return [...issues]
    .filter((issue) => issue.status === "unresolved" || issue.status === "regression" || issue.came_back)
    .sort((a, b) => {
      const rank = (issue: IssueSummary) => {
        const priority = resolveIssuePriority(issue.level, issue.status);
        const priorityScore =
          priority === "critical" ? 0 : priority === "high" ? 1 : priority === "medium" ? 2 : 3;
        const regressionBoost = issue.status === "regression" || issue.came_back ? -0.5 : 0;
        return priorityScore + regressionBoost;
      };
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      return (b.event_count ?? 0) - (a.event_count ?? 0);
    })
    .slice(0, 8);
}

function formatBucketLabel(iso: string, window: VelocityWindow): string {
  const date = new Date(iso);
  if (window === "24h") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function DashboardPage({ isEmbed = false }: { isEmbed?: boolean }) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, environment } = useAppContext();
  const safeProjects = Array.isArray(projects) ? projects : [];
  const project =
    safeProjects.find((p) => p && (p.id === projectId || p.slug === projectId)) ??
    safeProjects[0] ??
    null;
  const activeProjectId = project?.id ?? null;

  const [data, setData] = React.useState<OverviewData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const [velocityWindow, setVelocityWindow] = React.useState<VelocityWindow>("24h");
  const [velocityLoading, setVelocityLoading] = React.useState(false);
  const loadedVelocityWindow = React.useRef<VelocityWindow | null>(null);

  React.useEffect(() => {
    if (!activeProjectId) {
      setData(null);
      setLoading(false);
      loadedVelocityWindow.current = null;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVelocityWindow("24h");
    loadedVelocityWindow.current = null;

    void Promise.all([
      fetchHeadlineStats(activeProjectId, environment, "24h"),
      fetchHeadlineStats(activeProjectId, environment, "7d").catch(() => null),
      fetchIssues("is:unresolved", activeProjectId, "7d", "priority", environment).catch(
        () => [] as IssueSummary[],
      ),
      fetchProjectActivity(activeProjectId, 365).catch(() => [] as TimelineBucket[]),
      fetchProjectVelocity(activeProjectId, "24h", environment).catch(() => [] as VelocityBucket[]),
      fetchMonitors(activeProjectId).catch(() => [] as MonitorItem[]),
      fetchReleases(activeProjectId).catch(() => [] as ReleaseSummary[]),
      fetchAlerts(activeProjectId, environment, "all", 1).catch(() => [] as AlertRow[]),
    ])
      .then(([stats, previousStats, issues, activity, velocity, monitors, releases, alerts]) => {
        if (cancelled) return;
        loadedVelocityWindow.current = "24h";
        setData({
          stats,
          previousStats,
          triage: pickTriage(issues),
          activity,
          velocity,
          monitors,
          latestRelease: latestRelease(releases),
          latestAlert: alerts[0] ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("Could not load the project overview.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, environment, reloadNonce]);

  React.useEffect(() => {
    if (!activeProjectId || loading) return;
    if (loadedVelocityWindow.current === velocityWindow) return;
    let cancelled = false;
    setVelocityLoading(true);
    void fetchProjectVelocity(activeProjectId, velocityWindow, environment)
      .then((velocity) => {
        if (cancelled) return;
        loadedVelocityWindow.current = velocityWindow;
        setData((current) => (current ? { ...current, velocity } : current));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setVelocityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, velocityWindow, environment, loading]);

  const stats = data?.stats ?? null;
  const eventsNow = stats?.events_7d ?? 0;
  const baselineDaily = data?.previousStats ? data.previousStats.events_7d / 7 : null;
  const changeVsBaseline =
    baselineDaily && baselineDaily > 0 ? ((eventsNow - baselineDaily) / baselineDaily) * 100 : null;
  const filteredPct = valvePct(stats);
  const filteredCount = Math.max(0, (stats?.valve_seen ?? 0) - (stats?.valve_stored ?? 0));
  const affectedUsers = stats?.affected_users ?? 0;

  const velocityBuckets = React.useMemo<TimelineBucket[]>(
    () =>
      (data?.velocity ?? []).map((bucket) => ({
        start: bucket.start,
        count: bucket.handled + bucket.unhandled,
      })),
    [data?.velocity],
  );

  const heatmapDays = React.useMemo(
    () =>
      (data?.activity ?? []).map((bucket) => ({
        date: new Date(bucket.start).toISOString().slice(0, 10),
        count: bucket.count,
      })),
    [data?.activity],
  );

  const triageColumns = React.useMemo<DataTableColumnDef<IssueSummary>[]>(
    () => [
      {
        id: "priority",
        accessorFn: (row) => resolveIssuePriority(row.level, row.status, row),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Pri" />,
        cell: ({ row }) => (
          <IssuePriorityBadge
            level={row.original.level}
            status={row.original.status}
            priority={row.original.priority}
            priorityScore={row.original.priority_score}
            compact
          />
        ),
        size: 56,
      },
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Issue" />,
        cell: ({ row }) => (
          <Box flexDirection="column" rowGap="xs" minWidth={0}>
            <Text variant="label" truncate>
              {row.original.title ?? "Untitled issue"}
            </Text>
            <Text variant="caption" color="muted" truncate>
              {row.original.culprit ?? row.original.release ?? "—"}
            </Text>
          </Box>
        ),
      },
      {
        accessorKey: "event_count",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Events" />,
        cell: ({ row }) => (
          <Text variant="caption" monospace tabularNums>
            {formatCompactCount(row.original.event_count)}
          </Text>
        ),
        size: 72,
      },
      {
        accessorKey: "last_seen_at",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Last" />,
        cell: ({ row }) => (
          <Text variant="caption" color="muted" monospace>
            {row.original.last_seen_at ? formatRelativeTime(row.original.last_seen_at) : "—"}
          </Text>
        ),
        size: 88,
      },
    ],
    [],
  );

  const monitorColumns = React.useMemo<DataTableColumnDef<MonitorItem>[]>(
    () => [
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="" />,
        cell: ({ row }) => (
          <MonitorStatusIcon
            status={row.original.status as MonitorRowStatus}
            paused={row.original.paused}
          />
        ),
        size: 40,
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Monitor" />,
        cell: ({ row }) => (
          <Box flexDirection="column" rowGap="xs" minWidth={0}>
            <Text variant="label" truncate>
              {row.original.name ?? row.original.slug}
            </Text>
            <Text variant="caption" color="muted" monospace truncate>
              {row.original.schedule ?? row.original.slug}
            </Text>
          </Box>
        ),
      },
      {
        accessorKey: "last_check_in_at",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Last check-in" />,
        cell: ({ row }) => (
          <Text variant="caption" color="muted" monospace>
            {row.original.last_check_in_at
              ? formatRelativeTime(row.original.last_check_in_at)
              : "—"}
          </Text>
        ),
        size: 110,
      },
    ],
    [],
  );

  const monitorRows = React.useMemo(() => {
    const rank = (monitor: MonitorItem) => {
      if (monitor.paused) return 5;
      switch (monitor.status) {
        case "error":
        case "timeout":
          return 0;
        case "missed":
          return 1;
        case "in_progress":
          return 2;
        case "ok":
          return 3;
        default:
          return 4;
      }
    };
    return [...(data?.monitors ?? [])].sort((a, b) => rank(a) - rank(b)).slice(0, 8);
  }, [data?.monitors]);

  const goIssues = (query: string) => {
    if (!activeProjectId) return;
    navigate(issuesFilterPath(activeProjectId, query));
  };

  const content = !activeProjectId ? (
    <EmptyState title="No project selected" description="Create or select a project to see its health." />
  ) : error ? (
    <EmptyState
      title="Overview unavailable"
      description={error}
      actionLabel="Retry"
      onAction={() => setReloadNonce((value) => value + 1)}
    />
  ) : (
    <Box flexDirection="column" rowGap="l" width="100%">
      <Text as="h2" variant="heading-xs" truncate>
        {project?.name ?? "Project"}
      </Text>

      {/* Top: compact metrics (~30%) + heatmap (~70%) */}
      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", lg: "minmax(200px, 0.3fr) minmax(0, 0.7fr)" }}
        gap="l"
        alignItems="stretch"
        width="100%"
      >
        <Box
          data-slot="metrics-grid"
          borderRadius="s"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          backgroundColor="background-primary"
          overflow="hidden"
          width="100%"
          height="100%"
        >
          <Box display="grid" gridTemplateColumns="1fr 1fr" width="100%" height="100%">
            {(
              [
                {
                  key: "unresolved",
                  label: "Unresolved",
                  value: loading ? "…" : (stats?.unresolved ?? 0).toLocaleString(),
                  onClick: () => goIssues("is:unresolved"),
                  meta: (
                    <Text variant="caption" color="muted">
                      Open issues
                    </Text>
                  ),
                },
                {
                  key: "events",
                  label: "Events (24h)",
                  value: loading ? "…" : formatCompactCount(eventsNow),
                  onClick: undefined as (() => void) | undefined,
                  meta:
                    changeVsBaseline !== null && !loading ? (
                      <Box alignItems="center" columnGap="xs">
                        {changeVsBaseline > 0 ? (
                          <TrendUp className="size-3 text-escalating" weight="bold" />
                        ) : (
                          <TrendDown className="size-3 text-healthy" weight="bold" />
                        )}
                        <Text
                          variant="caption"
                          monospace
                          tabularNums
                          color={changeVsBaseline > 0 ? "danger" : "success"}
                        >
                          {changeVsBaseline > 0 ? "+" : ""}
                          {changeVsBaseline.toFixed(0)}%
                        </Text>
                      </Box>
                    ) : baselineDaily !== null ? (
                      <Text variant="caption" color="muted">
                        vs ~{formatCompactCount(Math.round(baselineDaily))}/day
                      </Text>
                    ) : null,
                },
                {
                  key: "users",
                  label: "Affected users",
                  value: loading ? "…" : affectedUsers.toLocaleString(),
                  onClick: undefined as (() => void) | undefined,
                  meta: (
                    <Text variant="caption" color="muted">
                      {affectedUsers === 0 && !loading ? "None identified" : "Unique users"}
                    </Text>
                  ),
                },
                {
                  key: "valve",
                  label: "Valve",
                  value: loading ? "…" : filteredPct === null ? "—" : `${filteredPct.toFixed(1)}%`,
                  onClick: undefined as (() => void) | undefined,
                  meta:
                    filteredPct !== null ? (
                      <Box alignItems="center" columnGap="xs">
                        <ShieldCheck className="size-3 text-healthy" weight="fill" />
                        <Text variant="caption" color="success">
                          {filteredCount > 0
                            ? `${formatCompactCount(filteredCount)} dropped`
                            : "filtered"}
                        </Text>
                      </Box>
                    ) : (
                      <Text variant="caption" color="muted">
                        Idle
                      </Text>
                    ),
                },
              ] as const
            ).map((cell, index) => {
              const interactive = typeof cell.onClick === "function";
              return (
                <Box
                  key={cell.key}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={cell.onClick}
                  onKeyDown={
                    interactive
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            cell.onClick?.();
                          }
                        }
                      : undefined
                  }
                  paddingHorizontal="m"
                  paddingVertical="m"
                  flexDirection="column"
                  rowGap="s"
                  justifyContent="between"
                  minHeight={88}
                  textAlign="left"
                  cursor={interactive ? "pointer" : undefined}
                  backgroundColor={
                    interactive
                      ? { base: "background-primary", hover: "background-secondary" }
                      : "background-primary"
                  }
                  borderRightWidth={index % 2 === 0 ? 1 : 0}
                  borderBottomWidth={index < 2 ? 1 : 0}
                  borderStyle="solid"
                  borderColor="border-primary"
                  transitionProperty={interactive ? "common" : undefined}
                  transitionDuration={interactive ? "fast" : undefined}
                >
                  <Text variant="label" color="muted">
                    {cell.label}
                  </Text>
                  <Text as="div" variant="heading-xs" tabularNums>
                    {cell.value}
                  </Text>
                  {cell.meta}
                </Box>
              );
            })}
          </Box>
        </Box>

        <SectionCard contentClassName="pt-3 pb-3">
          <StabilityHeatmap
            days={heatmapDays}
            loading={loading}
            compact
            onDayClick={(day) => {
              if (!activeProjectId) return;
              goIssues("is:unresolved");
              toast.message(day.date, {
                description:
                  day.count === 0
                    ? "Clean day — no stored errors."
                    : `${formatCompactCount(day.count)} errors that day. Opening unresolved issues.`,
              });
            }}
          />
        </SectionCard>
      </Box>

      {/* Mid: project-style velocity curve + triage DataTable */}
      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1.1fr) minmax(0, 0.9fr)" }}
        gap="l"
        width="100%"
      >
        <SectionCard
          title="Error velocity"
          flush
          headerActions={
            <Tabs
              value={velocityWindow}
              onValueChange={(value) => setVelocityWindow(value as VelocityWindow)}
            >
              <TabsList>
                <TabsTrigger value="24h">24h</TabsTrigger>
                <TabsTrigger value="7d">7d</TabsTrigger>
                <TabsTrigger value="30d">30d</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          {loading || velocityLoading ? (
            <Box height={220} backgroundColor="background-secondary" />
          ) : velocityBuckets.some((bucket) => bucket.count > 0) ? (
            <OccurrenceLineChart
              buckets={velocityBuckets}
              label={`Error velocity · ${formatBucketLabel(velocityBuckets[0]?.start ?? new Date().toISOString(), velocityWindow)}`}
              height={220}
              interactive
              fitExtremes
            />
          ) : (
            <Box
              height={220}
              alignItems="center"
              justifyContent="center"
              backgroundColor="background-secondary"
              borderWidth={1}
              borderStyle="dashed"
              borderColor="border-primary"
            >
              <Text variant="caption" color="muted">
                Quiet · no errors in this window
              </Text>
            </Box>
          )}
        </SectionCard>

        <SectionCard
          title="Needs triage"
          description="Unresolved & regressed"
          headerActions={
            activeProjectId ? (
              <Button variant="ghost" size="xs" onClick={() => goIssues("is:unresolved")}>
                View all
              </Button>
            ) : null
          }
          contentClassName="p-0"
        >
          {!loading && (data?.triage.length ?? 0) === 0 ? (
            <Box padding="l" alignItems="center" justifyContent="center" minHeight={120}>
              <Text variant="caption" color="muted">
                Nothing needs triage right now.
              </Text>
            </Box>
          ) : (
            <DataTable
              className={SOFT_DATA_TABLE_CLASS}
              columns={triageColumns}
              data={data?.triage ?? []}
              isLoading={loading}
              getRowId={(row) => row.id}
              onRowClick={(row) => {
                if (!activeProjectId) return;
                navigate(`${projectPath(activeProjectId, "issues")}?issue=${row.original.id}`);
              }}
            />
          )}
        </SectionCard>
      </Box>

      {/* Bottom: monitors DataTable + releases/alerts */}
      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", lg: "1fr 1fr" }}
        gap="l"
        width="100%"
      >
        <SectionCard
          title="Cron monitors"
          description={
            loading
              ? "Loading…"
              : `${data?.monitors.length ?? 0} monitor${(data?.monitors.length ?? 0) === 1 ? "" : "s"}`
          }
          headerActions={
            activeProjectId ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => navigate(projectPath(activeProjectId, "monitors"))}
              >
                View all
              </Button>
            ) : null
          }
          contentClassName="p-0"
        >
          {!loading && monitorRows.length === 0 ? (
            <Box padding="l" alignItems="center" justifyContent="center" minHeight={120}>
              <Text variant="caption" color="muted">
                No cron monitors yet.
              </Text>
            </Box>
          ) : (
            <DataTable
              className={SOFT_DATA_TABLE_CLASS}
              columns={monitorColumns}
              data={monitorRows}
              isLoading={loading}
              getRowId={(row) => row.id}
              onRowClick={(row) => {
                if (!activeProjectId) return;
                navigate(projectPath(activeProjectId, "monitors"));
                toast.message(row.original.name ?? row.original.slug);
              }}
            />
          )}
        </SectionCard>

        <SectionCard title="Releases & alerts" description="Recent activity and quick setup">
          <OverviewLaunchpad
            loading={loading}
            latestRelease={data?.latestRelease ?? null}
            latestAlert={data?.latestAlert ?? null}
            releasesHref={activeProjectId ? projectPath(activeProjectId, "releases") : "#"}
            alertsHref={activeProjectId ? projectPath(activeProjectId, "alerts") : "#"}
            newAlertHref={
              activeProjectId ? projectAlertRulesPath(activeProjectId) : "#"
            }
            newMonitorHref={activeProjectId ? projectPath(activeProjectId, "monitors") : "#"}
            dsnHref={activeProjectId ? projectSettingsPath(activeProjectId, "dsn") : "#"}
          />
        </SectionCard>
      </Box>
    </Box>
  );

  if (isEmbed) {
    return (
      <div className="min-h-screen bg-canvas p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">{content}</div>
      </div>
    );
  }

  return (
    <PageShell
      title="Dashboard"
      description={
        project ? `Project pulse for ${project.name}` : "Project health, triage, and monitors"
      }
      density="full-bleed"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 overflow-auto px-6 py-5">
        {content}
      </div>
    </PageShell>
  );
}

/** @deprecated Prefer `DashboardPage` — kept for the embed route. */
export const MonitoringPage = DashboardPage;
