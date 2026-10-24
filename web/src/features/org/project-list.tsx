import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { HeadlineStats, ProjectRow, TimelineBucket } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatCompactCount } from "../../lib/format-count";
import { projectPath } from "../../lib/paths";
import { Empty } from "../../ui/empty";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";
import { OccurrenceLineChart } from "../../ui/occurrence-line-chart";
import { Skeleton } from "../../ui/skeleton";
import { isSharedProjectRole, SharedProjectBadge } from "../../ui/shared-project-badge";

export interface ProjectListProps {
  projects: ProjectRow[];
  statsByProject: Map<string, HeadlineStats>;
  activityByProject: Map<string, TimelineBucket[]>;
  loading?: boolean;
  viewerRole?: string | null;
  editMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (projectId: string) => void;
}

function ProjectCardBody({
  project,
  stats,
  activity,
  statsLoading,
  viewerRole,
  editMode,
  selected,
  onToggleSelect,
}: {
  project: ProjectRow;
  stats?: HeadlineStats;
  activity?: TimelineBucket[];
  statsLoading?: boolean;
  viewerRole?: string | null;
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (projectId: string) => void;
}) {
  const unresolved = stats?.unresolved ?? 0;
  const events7d = stats?.events_7d ?? 0;
  const regressions = stats?.regressions ?? 0;
  const buckets = activity ?? [];
  const hasActivity = buckets.some((bucket) => bucket.count > 0);

  // Platform inference from slug or name
  const platform = project.slug?.includes("web") || project.name.toLowerCase().includes("web")
    ? "React"
    : project.slug?.includes("api") || project.name.toLowerCase().includes("api")
      ? "Node.js"
      : project.slug?.includes("setup")
        ? "Go"
        : "TypeScript";

  return (
    <div className="flex flex-col justify-between h-full min-h-[12rem] space-y-4">
      {/* 1. Header Zone: Semantic Health Dot, Full-width Uncropped Title, Platform Pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {editMode ? (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect?.(project.id)}
              aria-label={`Select ${project.name}`}
              className="mt-1 shrink-0"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <span
              className={cn(
                "mt-2 size-1.5 rounded-full shrink-0",
                unresolved > 0
                  ? regressions > 0
                    ? "bg-regression ring-2 ring-regression/20"
                    : "bg-escalating ring-2 ring-escalating/20 animate-pulse"
                  : "bg-healthy ring-2 ring-healthy/20",
              )}
              title={unresolved > 0 ? `${unresolved} unresolved issues` : "All systems nominal"}
            />
          )}

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Project name is NEVER cropped with ... — wraps naturally with full width */}
              <h2
                className={cn(
                  "text-base font-semibold tracking-tight text-fg-primary break-words leading-snug",
                  !editMode && "transition-colors group-hover:text-primary",
                )}
              >
                {project.name}
              </h2>

              {project.is_demo ? (
                <Badge variant="neutral" size="compact" className="shrink-0 tracking-ui font-mono text-[10px]">
                  Demo
                </Badge>
              ) : null}
              {isSharedProjectRole(project.role ?? viewerRole) ? <SharedProjectBadge /> : null}
            </div>

            <p className="font-mono text-xs text-fg-muted break-all">
              {project.slug ?? project.id}
            </p>
          </div>
        </div>

        {/* Platform Pill */}
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="rounded-control bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted border border-border-subtle">
            {platform}
          </span>
        </div>
      </div>

      {/* 2. Middle Zone: High-Density Telemetry Chips */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={cn(
            "font-mono font-medium tabular-nums px-2.5 py-1 rounded-control border flex items-center gap-1.5 shadow-tactile",
            unresolved > 0
              ? "bg-escalating/10 text-escalating border-escalating/25 font-semibold"
              : "bg-healthy/10 text-healthy border-healthy/20",
          )}
        >
          <span className={cn("size-1.5 rounded-full shrink-0", unresolved > 0 ? "bg-escalating" : "bg-healthy")} />
          <span>{statsLoading ? "…" : formatCompactCount(unresolved)} unresolved</span>
        </span>

        <span className="font-mono tabular-nums px-2.5 py-1 rounded-control bg-surface-2 text-fg-muted border border-border-subtle shadow-tactile">
          {statsLoading ? "…" : formatCompactCount(events7d)} events (7d)
        </span>

        {regressions > 0 ? (
          <span className="font-mono tabular-nums px-2.5 py-1 rounded-control bg-regression/10 text-regression border border-regression/20 shadow-tactile">
            ⚡ {formatCompactCount(regressions)} came back
          </span>
        ) : null}
      </div>

      {/* 3. Bottom Zone: Full-Width 7-Day Activity Sparkline & Action Link */}
      <div className="pt-3 border-t border-border/60 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-ink-subtle select-none">
          <span className="font-mono text-2xs">7-day error velocity</span>
          {!editMode ? (
            <span className="inline-flex items-center gap-1 font-medium text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <span>View issues</span>
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          ) : null}
        </div>

        <div className="h-10 w-full">
          {statsLoading ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : hasActivity ? (
            <OccurrenceLineChart
              buckets={buckets}
              label={`${project.name} errors over time`}
              height={40}
              interactive={false}
              className="w-full"
            />
          ) : (
            <div className="flex h-10 items-center justify-center rounded-md border border-dashed border-border/60 bg-bg-subtle/30">
              <span className="text-[11px] font-mono text-ink-subtle">Zero errors in last 7 days · Calm</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard(props: {
  project: ProjectRow;
  stats?: HeadlineStats;
  activity?: TimelineBucket[];
  statsLoading?: boolean;
  viewerRole?: string | null;
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (projectId: string) => void;
}) {
  const { editMode, selected, onToggleSelect, project } = props;
  const shellClass = cn(
    "epure-card relative flex flex-col justify-between rounded-panel border border-border-subtle bg-surface-1 p-5 transition-all duration-100 shadow-tactile",
    editMode
      ? cn(
          "cursor-pointer focus-ring",
          selected
            ? "border-primary bg-surface-2 ring-1 ring-primary"
            : "hover:border-border-strong hover:bg-surface-2/60",
        )
      : "group hover:border-border-strong hover:bg-surface-2/60 hover:shadow-float focus-ring",
  );

  if (editMode) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={shellClass}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button")) {
            return;
          }
          onToggleSelect?.(project.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleSelect?.(project.id);
          }
        }}
      >
        <ProjectCardBody {...props} />
      </div>
    );
  }

  return (
    <Link to={projectPath(project.id, "issues")} className={shellClass}>
      <ProjectCardBody {...props} />
    </Link>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col justify-between h-48 rounded-panel border border-border-subtle bg-surface-1 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-1.5 w-1.5 rounded-full mt-2" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-control" />
        <Skeleton className="h-6 w-24 rounded-control" />
      </div>
      <Skeleton className="h-10 w-full rounded-control" />
    </div>
  );
}

export function ProjectList({
  projects,
  statsByProject,
  activityByProject,
  loading = false,
  viewerRole,
  editMode = false,
  selectedIds,
  onToggleSelect,
}: ProjectListProps) {
  if (loading && projects.length > 0 && statsByProject.size === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        title="No projects found"
        description="Create a project to connect your SDK and start monitoring exceptions."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          stats={statsByProject.get(project.id)}
          activity={activityByProject.get(project.id)}
          statsLoading={loading && !statsByProject.has(project.id)}
          viewerRole={viewerRole}
          editMode={editMode}
          selected={selectedIds?.has(project.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
