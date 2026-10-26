import { useEffect, useMemo, useState } from "react";
import {
  fetchBillingStatus,
  fetchHeadlineStats,
  fetchIssues,
  type BillingStatus,
  type HeadlineStats,
  type IssueSummary,
  type ProjectRow,
} from "../../../lib/api";
import type { TimelineBucket } from "../../../lib/api";
import { deploymentLabel, isCloudDeployment } from "../../../lib/deployment";
import { formatCompactCount } from "../../../lib/format-count";
import { useAppContext } from "../../../shell/app-context";
import { Badge } from "../../../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { OccurrenceLineChart } from "../../../ui/occurrence-line-chart";
import { Skeleton } from "../../../ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { monthlyEventLimit, planForBillingStatus } from "../project-usage";
import {
  buildActivityBuckets,
  buildUsageSummaryText,
  buildUsageTotals,
  estimateStorageBytes,
  formatStorage,
  ingestUtilization,
  quotaTone,
  sumUniqueUsers,
  type ProjectUsageRow,
  type UsageTimeWindow,
  usageWindowDays,
} from "./usage-utils";
import { isDemoProject } from "../../../lib/demo-utils";

interface OrgUsageSettingsProps {
  window: UsageTimeWindow;
  onSummaryChange?: (summary: string) => void;
}

interface ProjectUsage extends HeadlineStats {
  project: ProjectRow;
  issues: IssueSummary[];
  uniqueUsers: number;
  storageBytes: number;
  ingestUtilization: number;
  trendBuckets: TimelineBucket[];
}

function QuotaMeter({
  label,
  used,
  limit,
  formatValue,
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  formatValue: (value: number) => string;
  hint?: string;
}) {
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const tone = quotaTone(percent);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-fg-primary">{label}</p>
          {hint ? <p className="text-xs text-fg-muted">{hint}</p> : null}
        </div>
        <p className="font-mono text-xs tabular-nums text-fg-muted">
          {formatValue(used)} / {formatValue(limit)}
        </p>
      </div>
      <Progress
        value={percent}
        className="h-1.5"
        indicatorClassName={
          tone === "danger"
            ? "bg-semantic-danger"
            : tone === "warn"
              ? "bg-semantic-warning"
              : "bg-accent"
        }
      />
      <div className="flex items-center justify-between text-2xs text-fg-muted">
        <span>{percent.toFixed(1)}% of limit</span>
        {tone !== "ok" ? (
          <Badge variant={tone === "danger" ? "error" : "warning"} size="compact">
            {tone === "danger" ? "Near limit" : "Elevated"}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function UsageMetricSkeleton() {
  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-1 p-4">
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

function UsageMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <p className="font-mono text-2xl font-semibold tabular-nums text-fg-primary">{value}</p>
      <p className="mt-1 text-sm text-fg-muted">{label}</p>
      {hint ? <p className="mt-1 text-2xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}

export function OrgUsageSettings({ window, onSummaryChange }: OrgUsageSettingsProps) {
  const { projects } = useAppContext();
  const realProjects = useMemo(
    () => (Array.isArray(projects) ? projects : []).filter((p) => p && !isDemoProject(p)),
    [projects],
  );
  const [rows, setRows] = useState<ProjectUsage[]>([]);
  const [activityBuckets, setActivityBuckets] = useState<
    ReturnType<typeof buildActivityBuckets>
  >([]);
  const [loading, setLoading] = useState(true);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const cloud = isCloudDeployment();

  useEffect(() => {
    if (!cloud) return;
    let cancelled = false;
    void fetchBillingStatus().then((status) => {
      if (!cancelled) setBillingStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [cloud]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const usage = await Promise.all(
          realProjects.map(async (project) => {
            try {
              const [statsRes, issuesRes] = await Promise.allSettled([
                fetchHeadlineStats(project.id, undefined, window),
                fetchIssues("", project.id, window),
              ]);
              const stats: HeadlineStats =
                statsRes.status === "fulfilled"
                  ? statsRes.value
                  : {
                      project_id: project.id,
                      environment: null,
                      unresolved: 0,
                      events_7d: 0,
                      regressions: 0,
                      snoozed: 0,
                    };
              const issues: IssueSummary[] =
                issuesRes.status === "fulfilled" && Array.isArray(issuesRes.value)
                  ? issuesRes.value
                  : [];
              const projectBuckets = buildActivityBuckets(issues, usageWindowDays(window));
              return {
                project,
                issues,
                ...stats,
                uniqueUsers: sumUniqueUsers(issues),
                storageBytes: estimateStorageBytes(stats.events_7d),
                ingestUtilization: ingestUtilization(
                  stats.events_7d,
                  project.ingest_cap_per_hour,
                  window,
                ),
                trendBuckets: projectBuckets,
              };
            } catch {
              const emptyStats: HeadlineStats = {
                project_id: project.id,
                environment: null,
                unresolved: 0,
                events_7d: 0,
                regressions: 0,
                snoozed: 0,
              };
              return {
                project,
                issues: [],
                ...emptyStats,
                uniqueUsers: 0,
                storageBytes: 0,
                ingestUtilization: 0,
                trendBuckets: [],
              };
            }
          }),
        );

        if (!cancelled) {
          setRows(usage);
          setActivityBuckets(
            buildActivityBuckets(
              usage.flatMap((row) => row.issues),
              usageWindowDays(window),
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setActivityBuckets([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [realProjects, window]);

  const tableRows: ProjectUsageRow[] = useMemo(
    () =>
      rows.map((row) => ({
        project: row.project,
        events: row.events_7d,
        uniqueUsers: row.uniqueUsers,
        unresolved: row.unresolved,
        regressions: row.regressions,
        storageBytes: row.storageBytes,
        ingestUtilization: row.ingestUtilization,
        trendBuckets: row.trendBuckets,
      })),
    [rows],
  );

  const totals = useMemo(() => buildUsageTotals(tableRows, window), [tableRows, window]);

  const windowLabel = useMemo(() => {
    switch (window) {
      case "30d":
        return "Last 30 days";
      case "90d":
        return "Last 90 days";
      default:
        return "Last 7 days";
    }
  }, [window]);

  useEffect(() => {
    if (!onSummaryChange) {
      return;
    }
    if (loading) {
      onSummaryChange("");
      return;
    }
    onSummaryChange(
      buildUsageSummaryText({
        deployment: deploymentLabel(),
        window,
        windowLabel,
        totals,
        rows: tableRows,
      }),
    );
  }, [loading, onSummaryChange, tableRows, totals, window, windowLabel]);

  const cloudPlan = planForBillingStatus(billingStatus);
  const eventLimit = monthlyEventLimit(billingStatus, cloudPlan);
  const projectedEvents = totals.monthlyEventProjection;

  return (
    <div className="space-y-6">
      <section aria-label="Usage overview">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <UsageMetricSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UsageMetricCard
              label={`Events ingested (${window})`}
              value={formatCompactCount(totals.events)}
              hint={
                cloud
                  ? `${totals.monthlyEventProjection.toLocaleString()} projected / month`
                  : `${windowLabel} total`
              }
            />
            <UsageMetricCard
              label="Unique users"
              value={formatCompactCount(totals.uniqueUsers)}
              hint="Summed per issue"
            />
            <UsageMetricCard
              label="Estimated storage"
              value={formatStorage(totals.storageBytes)}
              hint="~4 KB per event"
            />
            <UsageMetricCard
              label="Retention"
              value={`${totals.avgRetentionDays}d avg`}
              hint={`${totals.maxRetentionDays}d max across projects`}
            />
          </div>
        )}
      </section>

      <section aria-label="Event volume trend">
        <Card>
          <CardHeader>
            <CardTitle>Event volume</CardTitle>
            <CardDescription>
              Daily activity proxy from issue event counts in {windowLabel.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full rounded-md" />
            ) : activityBuckets.some((bucket) => bucket.count > 0) ? (
              <div className="epure-inset-well p-2">
                <OccurrenceLineChart
                  buckets={activityBuckets}
                  label={`Event activity over ${window}`}
                  height={140}
                  interactive
                />
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No event activity in this period.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {cloud && eventLimit ? (
        <section aria-label="Quota and limits">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Quota &amp; limits</CardTitle>
                <Badge variant="env">Cloud</Badge>
              </div>
              <CardDescription>
                Plan limits apply on Epure Cloud. Contact your owner to change plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuotaMeter
                label="Events (projected monthly)"
                used={projectedEvents}
                limit={eventLimit}
                formatValue={(value) => formatCompactCount(value)}
                hint={`Based on ${window} ingest rate${cloudPlan ? ` · ${cloudPlan.name} plan` : ""}`}
              />
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section aria-label="Usage by project">
        <Card>
          <CardHeader>
            <CardTitle>Usage by project</CardTitle>
            <CardDescription>
              Per-project breakdown for {windowLabel.toLowerCase()}. Trend lines show relative
              activity within each project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-fg-muted">No projects yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[44rem] text-sm">
                  <TableHeader className="text-xs text-fg-muted">
                    <TableRow>
                      <TableHead className="font-medium">Project</TableHead>
                      <TableHead className="font-medium">Events</TableHead>
                      <TableHead className="font-medium">Trend</TableHead>
                      <TableHead className="font-medium">Users</TableHead>
                      <TableHead className="font-medium">Storage</TableHead>
                      <TableHead className="font-medium">Unresolved</TableHead>
                      <TableHead className="font-medium">Cap / hr</TableHead>
                      <TableHead className="font-medium">Retention</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.project.id}>
                        <TableCell>
                          <p className="font-medium text-fg-primary">{row.project.name}</p>
                          <p className="mt-0.5 font-mono text-2xs text-fg-muted">
                            {row.project.slug ?? row.project.id.slice(0, 8)}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {formatCompactCount(row.events_7d)}
                        </TableCell>
                        <TableCell>
                          {row.trendBuckets.some((bucket) => bucket.count > 0) ? (
                            <OccurrenceLineChart
                              buckets={row.trendBuckets}
                              label={`${row.project.name} activity`}
                              height={24}
                              interactive={false}
                              className="w-20"
                            />
                          ) : (
                            <span className="text-2xs text-fg-muted">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {formatCompactCount(row.uniqueUsers)}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {formatStorage(row.storageBytes)}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {row.unresolved}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {row.project.ingest_cap_per_hour.toLocaleString()}
                          {cloud ? (
                            <p className="mt-0.5 font-sans text-2xs text-fg-muted">
                              {Math.round(row.ingestUtilization * 100)}% utilized
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {row.project.retention_days}d
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="What counts toward usage">
        <Card>
          <CardHeader>
            <CardTitle>What counts toward usage</CardTitle>
            <CardDescription>
              How Epure measures volume on {deploymentLabel().toLowerCase()} deployments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-fg-muted">
            <ul className="space-y-2">
              <li>
                <span className="font-medium text-fg-primary">Events ingested</span> — every accepted error
                envelope written to Postgres, including duplicates across issues.
              </li>
              <li>
                <span className="font-medium text-fg-primary">Unique users</span> — distinct user keys per
                issue; org totals sum issue-level counts and may overcount the same user across
                issues.
              </li>
              <li>
                <span className="font-medium text-fg-primary">Storage</span> — estimated from stored event
                payloads and metadata until exact byte metering ships.
              </li>
              <li>
                <span className="font-medium text-fg-primary">Retention</span> — per-project TTL in days;
                older monthly partitions are dropped automatically.
              </li>
              <li>
                <span className="font-medium text-fg-primary">Ingest cap</span> — hourly spike valve per
                project; events above the cap are rejected with 429.
              </li>
            </ul>
            {!cloud ? (
              <p className="text-xs text-fg-muted">
                Self-hosted instances have no metered billing limits. Epure Cloud plans add managed hosting,
                multi-region failover, and automated continuous backups.
              </p>
            ) : (
              <p className="text-xs text-fg-muted">
                Epure Cloud includes zero-overage Spike Valve protection. If event velocity spikes, full
                diagnostic samples are captured while exact occurrence counters stay 100% accurate.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
