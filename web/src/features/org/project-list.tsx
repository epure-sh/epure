import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Box } from "@polar-sh/orbit/Box";
import { Grid } from "@polar-sh/orbit/Grid";
import { Text } from "@polar-sh/orbit/Text";
import type { HeadlineStats, ProjectRow, TimelineBucket } from "../../lib/api";
import { formatCompactCount } from "../../lib/format-count";
import { projectPath } from "../../lib/paths";
import { EmptyState } from "@/components/kit/empty-state";
import {
  PolarCard,
  PolarCardDescription,
  PolarCardFooter,
  PolarCardHeader,
  PolarCardOpenHint,
  PolarCardTitle,
} from "@/components/kit/polar-card";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";
import { OccurrenceLineChart } from "../../ui/occurrence-line-chart";

export interface ProjectListProps {
  projects: ProjectRow[];
  statsByProject: Map<string, HeadlineStats>;
  activityByProject: Map<string, TimelineBucket[]>;
  loading?: boolean;
  projectsLoading?: boolean;
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
  editMode,
  selected,
  onToggleSelect,
}: {
  project: ProjectRow;
  stats?: HeadlineStats;
  activity?: TimelineBucket[];
  statsLoading?: boolean;
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (projectId: string) => void;
}) {
  const unresolved = stats?.unresolved ?? 0;
  const buckets = activity ?? [];
  const hasActivity = buckets.some((bucket) => bucket.count > 0);

  /** Graph fills remaining card height (header stays compact). */
  const graphHeight = 120;

  return (
    <Box
      flexDirection="column"
      justifyContent="between"
      rowGap="l"
      width="100%"
      height="100%"
      minHeight={260}>
      <PolarCardHeader>
        <Box alignItems="start" columnGap="m" minWidth={0} flex={1}>
          {editMode ? (
            <Box paddingTop="xs" flexShrink={0}>
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect?.(project.id)}
                aria-label={`Select ${project.name}`}
                onClick={(event) => event.stopPropagation()}
              />
            </Box>
          ) : null}

          <Box flexDirection="column" rowGap="xs" minWidth={0} flex={1}>
            <PolarCardTitle as="h2">{project.name}</PolarCardTitle>
            <PolarCardDescription>{project.slug ?? project.id}</PolarCardDescription>
          </Box>
        </Box>

        <Badge variant={unresolved > 0 ? "escalating" : "healthy"} size="sm">
          {statsLoading ? "…" : formatCompactCount(unresolved)} unresolved
        </Badge>
      </PolarCardHeader>

      <PolarCardFooter orientation="column" grow rowGap="s">
        <Text variant="label" color="muted">
          7-day activity
        </Text>

        <Box width="100%" flex={1} minHeight={graphHeight} alignItems="stretch">
          {statsLoading ? (
            <Text loading placeholderText="Loading chart…" variant="caption" />
          ) : hasActivity ? (
            <OccurrenceLineChart
              buckets={buckets}
              label={`${project.name} errors over time`}
              height={graphHeight}
              interactive={false}
            />
          ) : (
            <Box
              width="100%"
              height="100%"
              minHeight={graphHeight}
              alignItems="center"
              justifyContent="center"
              borderRadius="m"
              backgroundColor="background-secondary"
              borderWidth={1}
              borderStyle="dashed"
              borderColor="border-primary">
              <Text variant="caption" color="muted">
                Quiet · no errors
              </Text>
            </Box>
          )}
        </Box>

        {!editMode ? (
          <PolarCardOpenHint>
            <Text variant="label">Open</Text>
            <ArrowRight size={12} aria-hidden />
          </PolarCardOpenHint>
        ) : null}
      </PolarCardFooter>
    </Box>
  );
}

function ProjectCardSkeleton() {
  return (
    <PolarCard>
      <Box flexDirection="column" rowGap="l" minHeight={260} height="100%">
        <Box alignItems="start" justifyContent="between" columnGap="m" width="100%" flexShrink={0}>
          <Box flexDirection="column" rowGap="s" flex={1}>
            <Text loading placeholderText="Project name" variant="heading-xxs" />
            <Text loading placeholderText="slug" variant="caption" />
          </Box>
          <Text loading placeholderText="0 unresolved" variant="caption" />
        </Box>
        <Box flex={1} minHeight={120} width="100%">
          <Text loading placeholderNumberOfLines={4} />
        </Box>
      </Box>
    </PolarCard>
  );
}

/** Keep project header search aligned with the first card column. */
export const PROJECT_GALLERY_GRID_COLUMNS = {
  base: "1fr",
  sm: "repeat(2, 1fr)",
  lg: "repeat(3, 1fr)",
} as const;

function ProjectGallery({ children }: { children: ReactNode }) {
  return (
    <Grid templateColumns={PROJECT_GALLERY_GRID_COLUMNS} gap="l" width="100%">
      {children}
    </Grid>
  );
}

export function ProjectList({
  projects,
  statsByProject,
  activityByProject,
  loading = false,
  projectsLoading = false,
  editMode = false,
  selectedIds,
  onToggleSelect,
}: ProjectListProps) {
  if (projectsLoading && projects.length === 0) {
    return (
      <ProjectGallery>
        {[1, 2, 3].map((n) => (
          <ProjectCardSkeleton key={n} />
        ))}
      </ProjectGallery>
    );
  }

  if (loading && projects.length > 0 && statsByProject.size === 0) {
    return (
      <ProjectGallery>
        {projects.map((project) => (
          <ProjectCardSkeleton key={project.id} />
        ))}
      </ProjectGallery>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects found"
        description="Create a project to connect your SDK and start monitoring exceptions."
      />
    );
  }

  return (
    <ProjectGallery>
      {projects.map((project) => {
        const selected = selectedIds?.has(project.id) ?? false;
        const body = (
          <ProjectCardBody
            project={project}
            stats={statsByProject.get(project.id)}
            activity={activityByProject.get(project.id)}
            statsLoading={loading && !statsByProject.has(project.id)}
            editMode={editMode}
            selected={selected}
            onToggleSelect={onToggleSelect}
          />
        );

        if (editMode) {
          return (
            <PolarCard
              key={project.id}
              selected={selected}
              interactive
              role="button"
              tabIndex={0}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button,input")) {
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
              {body}
            </PolarCard>
          );
        }

        return (
          <PolarCard key={project.id} to={projectPath(project.id, "issues")}>
            {body}
          </PolarCard>
        );
      })}
    </ProjectGallery>
  );
}
