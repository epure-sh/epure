import {
  fetchHeadlineStats,
  fetchProjectActivity,
  type BillingStatus,
  type HeadlineStats,
  type ProjectRow,
  type TimelineBucket,
} from "../../lib/api";
import type { TelemetryPoint } from "@/components/kit/telemetry-chart";
import { normalizePlanId, PLANS, type PlanDefinition } from "./billing-data";

export interface ProjectEventUsage {
  project: ProjectRow;
  isDemo: boolean;
  stats: HeadlineStats | null;
  /** Events in the requested window; 0 when stats could not be loaded. */
  events: number;
  buckets: TimelineBucket[];
}

export function isDemoProject(project: Pick<ProjectRow, "id" | "is_demo">): boolean {
  return Boolean(
    project.is_demo || project.id.startsWith("acme") || project.id.startsWith("prj_seed"),
  );
}

/** Real per-project event volume (`/stats`) and 30-day daily histogram (`/projects/:id/activity`). */
export async function loadProjectEventUsage(
  projects: ProjectRow[],
  window: "24h" | "7d" | "30d" | "90d",
  options: { environment?: string; withActivity?: boolean } = {},
): Promise<ProjectEventUsage[]> {
  return Promise.all(
    projects.map(async (project) => {
      const [stats, buckets] = await Promise.all([
        fetchHeadlineStats(project.id, options.environment, window).catch(() => null),
        options.withActivity === false
          ? Promise.resolve<TimelineBucket[]>([])
          : fetchProjectActivity(project.id).catch(() => [] as TimelineBucket[]),
      ]);
      return {
        project,
        isDemo: isDemoProject(project),
        stats,
        events: stats?.events_7d ?? 0,
        buckets,
      };
    }),
  );
}

export function bucketsToTelemetry(
  buckets: TimelineBucket[],
  format: (date: Date) => string = (date) =>
    date.toLocaleDateString([], { month: "short", day: "numeric" }),
): TelemetryPoint[] {
  return buckets.map((bucket) => ({ time: format(new Date(bucket.start)), value: bucket.count }));
}

export function planForBillingStatus(status: BillingStatus | null): PlanDefinition | null {
  if (!status) return null;
  const id = normalizePlanId(status.plan_tier);
  return PLANS.find((plan) => plan.id === id) ?? null;
}

export function monthlyEventLimit(
  status: BillingStatus | null,
  plan: PlanDefinition | null,
): number | null {
  if (status && status.monthly_events_included > 0) {
    return status.monthly_events_included;
  }
  return plan?.limits.eventsPerMonth ?? null;
}
