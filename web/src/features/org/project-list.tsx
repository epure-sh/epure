import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Box } from "@polar-sh/orbit/Box";
import { Grid } from "@polar-sh/orbit/Grid";
import { Text } from "@polar-sh/orbit/Text";
import {
  deleteProject,
  updateProject,
  type HeadlineStats,
  type ProjectRow,
  type TimelineBucket,
} from "../../lib/api";
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
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Input } from "../../ui/input";
import { OccurrenceLineChart } from "../../ui/occurrence-line-chart";
import { useAppContext } from "../../shell/app-context";
import { useToast } from "../../ui/toast-provider";
import { DeleteProjectsDialog } from "./delete-projects-dialog";
import { loadHiddenProjectIds, toggleHiddenProjectId } from "./hidden-projects";

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
  hidden,
  canRename,
  canDelete,
  onToggleSelect,
  onRename,
  onToggleHide,
  onDelete,
}: {
  project: ProjectRow;
  stats?: HeadlineStats;
  activity?: TimelineBucket[];
  statsLoading?: boolean;
  editMode?: boolean;
  selected?: boolean;
  hidden?: boolean;
  canRename?: boolean;
  canDelete?: boolean;
  onToggleSelect?: (projectId: string) => void;
  onRename?: (project: ProjectRow) => void;
  onToggleHide?: (project: ProjectRow) => void;
  onDelete?: (project: ProjectRow) => void;
}) {
  const unresolved = stats?.unresolved ?? 0;
  const buckets = activity ?? [];
  const hasActivity = buckets.some((bucket) => bucket.count > 0);
  const graphHeight = 120;
  const showActions = !editMode && (canRename || canDelete || Boolean(onToggleHide));

  return (
    <Box
      flexDirection="column"
      justifyContent="between"
      rowGap="l"
      width="100%"
      height="100%"
      minHeight={260}
    >
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

        <Box alignItems="start" columnGap="s" flexShrink={0}>
          <Badge variant={unresolved > 0 ? "escalating" : "healthy"} size="sm">
            {statsLoading ? "…" : formatCompactCount(unresolved)} unresolved
          </Badge>
          {showActions ? (
            <Box
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Actions for ${project.name}`}
                  >
                    <MoreHorizontal size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {canRename ? (
                    <DropdownMenuItem onSelect={() => onRename?.(project)}>
                      <Pencil size={12} />
                      Rename
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onSelect={() => onToggleHide?.(project)}>
                    {hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                    {hidden ? "Show" : "Hide"}
                  </DropdownMenuItem>
                  {canDelete ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => onDelete?.(project)}>
                        <Trash2 size={12} />
                        <Text as="span" color="danger">
                          Delete
                        </Text>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </Box>
          ) : null}
        </Box>
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
              borderColor="border-primary"
            >
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
  viewerRole,
  editMode = false,
  selectedIds,
  onToggleSelect,
}: ProjectListProps) {
  const navigate = useNavigate();
  const { refreshProjects } = useAppContext();
  const { toast } = useToast();
  const canRename = viewerRole === "owner" || viewerRole === "admin";
  const canDelete = viewerRole === "owner";

  const [hiddenIds, setHiddenIds] = useState(() => loadHiddenProjectIds());
  const [renameTarget, setRenameTarget] = useState<ProjectRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const orderedProjects = useMemo(() => {
    const visible: ProjectRow[] = [];
    const hidden: ProjectRow[] = [];
    for (const project of projects) {
      if (hiddenIds.has(project.id)) hidden.push(project);
      else visible.push(project);
    }
    return [...visible, ...hidden];
  }, [projects, hiddenIds]);

  const handleToggleHide = useCallback((project: ProjectRow) => {
    setHiddenIds(toggleHiddenProjectId(project.id));
  }, []);

  const openRename = useCallback((project: ProjectRow) => {
    setRenameTarget(project);
    setRenameValue(project.name);
  }, []);

  const handleRename = useCallback(async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setRenameBusy(true);
    try {
      await updateProject(renameTarget.id, { name });
      await refreshProjects();
      toast("Project renamed");
      setRenameTarget(null);
    } catch {
      toast("Could not rename project");
    } finally {
      setRenameBusy(false);
    }
  }, [renameTarget, renameValue, refreshProjects, toast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteProject(deleteTarget.id);
      await refreshProjects();
      toast("Project deleted");
      setDeleteTarget(null);
    } catch {
      toast("Could not delete project");
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteTarget, refreshProjects, toast]);

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
    <>
      <ProjectGallery>
        {orderedProjects.map((project) => {
          const selected = selectedIds?.has(project.id) ?? false;
          const hidden = hiddenIds.has(project.id);
          const body = (
            <ProjectCardBody
              project={project}
              stats={statsByProject.get(project.id)}
              activity={activityByProject.get(project.id)}
              statsLoading={loading && !statsByProject.has(project.id)}
              editMode={editMode}
              selected={selected}
              hidden={hidden}
              canRename={canRename}
              canDelete={canDelete}
              onToggleSelect={onToggleSelect}
              onRename={openRename}
              onToggleHide={handleToggleHide}
              onDelete={setDeleteTarget}
            />
          );

          if (editMode) {
            return (
              <Box
                key={project.id}
                opacity={hidden ? 0.38 : 1}
                transitionProperty="opacity"
                transitionDuration="fast"
              >
                <PolarCard
                  selected={selected}
                  interactive
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("button,input,[data-slot=dropdown-menu-content]")) {
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
              </Box>
            );
          }

          return (
            <Box
              key={project.id}
              opacity={hidden ? 0.38 : 1}
              transitionProperty="opacity"
              transitionDuration="fast"
            >
              <PolarCard
                interactive
                role="link"
                tabIndex={0}
                onClick={(event) => {
                  if (
                    (event.target as HTMLElement).closest(
                      "button,a,[role=menuitem],[data-slot=dropdown-menu-content]",
                    )
                  ) {
                    return;
                  }
                  navigate(projectPath(project.id, "dashboard"));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(projectPath(project.id, "dashboard"));
                  }
                }}
              >
                {body}
              </PolarCard>
            </Box>
          );
        })}
      </ProjectGallery>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              Updates the display name. The slug stays the same.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
            }}
            placeholder="Project name"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={renameBusy}
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={renameBusy || !renameValue.trim()}
              onClick={() => void handleRename()}
            >
              {renameBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteProjectsDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        projectNames={deleteTarget ? [deleteTarget.name] : []}
        onConfirm={handleDelete}
        busy={deleteBusy}
      />
    </>
  );
}
