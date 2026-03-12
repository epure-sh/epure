import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { HeadlineStats, ProjectRow } from "../../lib/api";
import { formatCompactCount } from "../../lib/format-count";
import { projectPath } from "../../lib/paths";
import { Empty } from "../../ui/empty";
import { Skeleton } from "../../ui/skeleton";
import { isSharedProjectRole, SharedProjectBadge } from "../../ui/shared-project-badge";

export interface ProjectListProps {
  projects: ProjectRow[];
  statsByProject: Map<string, HeadlineStats>;
  loading?: boolean;
  viewerRole?: string | null;
}

function ProjectCard({
  project,
  stats,
  statsLoading,
  viewerRole,
}: {
  project: ProjectRow;
  stats?: HeadlineStats;
  statsLoading?: boolean;
  viewerRole?: string | null;
}) {
  const unresolved = stats?.unresolved ?? 0;
  const events7d = stats?.events_7d ?? 0;
  const regressions = stats?.regressions ?? 0;

  return (
    <Link
      to={projectPath(project.id, "issues")}
      className="epure-card group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-state-hover focus-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-medium tracking-ui text-ink transition-colors group-hover:text-accent">
            <span className="truncate">{project.name}</span>
            {isSharedProjectRole(project.role ?? viewerRole) ? <SharedProjectBadge /> : null}
          </h2>
          <p className="mt-1 truncate font-mono text-xs text-ink-muted">
            {project.slug ?? project.id.slice(0, 8)}
          </p>
        </div>
        <ArrowRight
          size={14}
          className="mt-0.5 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>

      {statsLoading || stats ? (
        <p className="mt-3 text-xs text-ink-muted">
          <span className="font-mono tabular-nums text-ink">
            {statsLoading ? "—" : formatCompactCount(unresolved)}
          </span>{" "}
          unresolved
          <span className="px-1.5 text-ink-muted/40" aria-hidden>·</span>
          <span className="font-mono tabular-nums text-ink">
            {statsLoading ? "—" : formatCompactCount(events7d)}
          </span>{" "}
          events (7d)
          {regressions > 0 ? (
            <>
              <span className="px-1.5 text-ink-muted/40" aria-hidden>·</span>
              <span className="font-mono tabular-nums text-semantic-warning">
                {statsLoading ? "—" : formatCompactCount(regressions)}
              </span>{" "}
              <span className="text-semantic-warning">regressions</span>
            </>
          ) : null}
        </p>
      ) : null}
    </Link>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-2 h-3 w-20" />
      <Skeleton className="mt-3 h-3 w-40" />
    </div>
  );
}

export function ProjectList({
  projects,
  statsByProject,
  loading = false,
  viewerRole,
}: ProjectListProps) {
  if (loading && projects.length > 0 && statsByProject.size === 0) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
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
    <div className="grid gap-3 sm:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          stats={statsByProject.get(project.id)}
          statsLoading={loading && !statsByProject.has(project.id)}
          viewerRole={viewerRole}
        />
      ))}
    </div>
  );
}
