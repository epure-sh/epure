import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { HeadlineStats, ProjectRow, TimelineBucket } from "../../lib/api";
import { formatCompactCount } from "../../lib/format-count";
import { projectPath } from "../../lib/paths";
import { Empty } from "../../ui/empty";
import { Badge } from "../../ui/badge";
import { OccurrenceLineChart } from "../../ui/occurrence-line-chart";
import { Skeleton } from "../../ui/skeleton";
import { isSharedProjectRole, SharedProjectBadge } from "../../ui/shared-project-badge";

export interface ProjectListProps {
  projects: ProjectRow[];
  statsByProject: Map<string, HeadlineStats>;
  activityByProject: Map<string, TimelineBucket[]>;
  loading?: boolean;
  viewerRole?: string | null;
}

function ProjectCard({
  project,
  stats,
  activity,
  statsLoading,
  viewerRole,
}: {
  project: ProjectRow;
  stats?: HeadlineStats;
  activity?: TimelineBucket[];
  statsLoading?: boolean;
  viewerRole?: string | null;
}) {
  const unresolved = stats?.unresolved ?? 0;
  const events7d = stats?.events_7d ?? 0;
  const regressions = stats?.regressions ?? 0;
  const buckets = activity ?? [];
  const hasActivity = buckets.some((bucket) => bucket.count > 0);

  return (
    <Link
      to={projectPath(project.id, "issues")}
      className="epure-card group flex min-h-[6.5rem] items-stretch gap-3 rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-border-strong hover:bg-state-hover focus-ring"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-w-0">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-medium tracking-ui text-ink transition-colors group-hover:text-accent">
            <span className="truncate">{project.name}</span>
            {project.is_demo ? (
              <Badge variant="secondary" size="compact" className="shrink-0 tracking-ui">
                Preview
              </Badge>
            ) : null}
            {isSharedProjectRole(project.role ?? viewerRole) ? <SharedProjectBadge /> : null}
          </h2>
          <p className="mt-1 truncate font-mono text-xs text-ink-muted">
            {project.slug ?? project.id.slice(0, 8)}
          </p>
        </div>

        {statsLoading || stats ? (
          <p className="mt-auto pt-2 text-xs text-ink-muted">
            <span className="font-mono tabular-nums text-ink">
              {statsLoading ? "—" : formatCompactCount(unresolved)}
            </span>{" "}
            unresolved
            <span className="px-1.5 text-ink-muted/40" aria-hidden>
              ·
            </span>
            <span className="font-mono tabular-nums text-ink">
              {statsLoading ? "—" : formatCompactCount(events7d)}
            </span>{" "}
            events (7d)
            {regressions > 0 ? (
              <>
                <span className="px-1.5 text-ink-muted/40" aria-hidden>
                  ·
                </span>
                <span className="font-mono tabular-nums text-semantic-warning">
                  {statsLoading ? "—" : formatCompactCount(regressions)}
                </span>{" "}
                <span className="text-semantic-warning">regressions</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="flex w-36 shrink-0 flex-col justify-end sm:w-44">
        {statsLoading ? (
          <Skeleton className="h-14 w-full rounded-md" />
        ) : hasActivity ? (
          <OccurrenceLineChart
            buckets={buckets}
            label={`${project.name} errors over time`}
            height={56}
            interactive={false}
            className="w-full"
          />
        ) : (
          <div className="flex h-14 items-end border-b border-border/40">
            <span className="pb-1 text-2xs text-ink-muted">No recent errors</span>
          </div>
        )}
      </div>

      <span
        className="flex shrink-0 items-center self-center text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      >
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="flex min-h-[6.5rem] items-stretch gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-3 w-20" />
        <Skeleton className="mt-auto h-3 w-40" />
      </div>
      <Skeleton className="h-14 w-36 shrink-0 rounded-md sm:w-44" />
      <Skeleton className="h-3.5 w-3.5 shrink-0 self-center rounded-sm" />
    </div>
  );
}

export function ProjectList({
  projects,
  statsByProject,
  activityByProject,
  loading = false,
  viewerRole,
}: ProjectListProps) {
  if (loading && projects.length > 0 && statsByProject.size === 0) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCardSkeleton key={project.id} />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Empty
        variant="inset"
        title="No projects yet"
        description="Create a project to get a DSN and start ingesting errors."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          stats={statsByProject.get(project.id)}
          activity={activityByProject.get(project.id)}
          statsLoading={loading && !statsByProject.has(project.id)}
          viewerRole={viewerRole}
        />
      ))}
    </div>
  );
}
