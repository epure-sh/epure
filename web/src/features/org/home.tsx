import { Pencil, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box } from "@polar-sh/orbit/Box";
import { Grid, GridItem } from "@polar-sh/orbit";
import { Text } from "@polar-sh/orbit/Text";
import { Alert } from "@polar-sh/orbit/Alert";
import {
  deleteProject,
  fetchBillingStatus,
  fetchHeadlineStats,
  type BillingStatus,
  type HeadlineStats,
  type TimelineBucket,
} from "../../lib/api";
import { isCloudDeployment } from "../../lib/deployment";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { useToast } from "../../ui/toast-provider";
import { PageShell } from "@/components/kit/page-shell";
import { SetupWizardDialog } from "../setup/setup-wizard-dialog";
import { emptyListTrendBuckets } from "../issues/issue-feed-utils";
import { fetchProjectActivityBuckets } from "./project-activity";
import { DeleteProjectsDialog } from "./delete-projects-dialog";
import { PROJECT_GALLERY_GRID_COLUMNS, ProjectList } from "./project-list";

export function OrgHomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, refreshProjects, user, projectsLoading } = useAppContext();
  const safeProjects = useMemo(() => (Array.isArray(projects) ? projects : []), [projects]);
  const [searchQuery, setSearchQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [statsByProject, setStatsByProject] = useState<Map<string, HeadlineStats>>(new Map());
  const [activityByProject, setActivityByProject] = useState<Map<string, TimelineBucket[]>>(
    new Map(),
  );
  const [statsLoading, setStatsLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardName, setWizardName] = useState("");
  const [wizardProjectId, setWizardProjectId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isCloudDeployment()) {
      fetchBillingStatus().then(setBillingStatus).catch(() => {});
    }
  }, []);

  const isPaused = Boolean(
    billingStatus?.subscription_status === "paused" ||
      (billingStatus?.canary_expires_at &&
        new Date(billingStatus.canary_expires_at).getTime() <= Date.now()),
  );

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canDeleteProjects = user?.role === "owner";

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return safeProjects;
    const q = searchQuery.toLowerCase().trim();
    return safeProjects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.slug && p.slug.toLowerCase().includes(q)),
    );
  }, [safeProjects, searchQuery]);

  const selectedProjects = useMemo(
    () => safeProjects.filter((project) => selectedIds.has(project.id)),
    [safeProjects, selectedIds],
  );

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleProjectSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllProjects = useCallback(() => {
    setSelectedIds(new Set(safeProjects.map((project) => project.id)));
  }, [safeProjects]);
  const setupParam = searchParams.get("setup");

  useEffect(() => {
    if (!setupParam) {
      return;
    }
    if (!projects.some((project) => project.id === setupParam)) {
      return;
    }
    setWizardProjectId(setupParam);
    setWizardName(projects.find((project) => project.id === setupParam)?.name ?? "");
    setWizardOpen(true);
  }, [projects, setupParam]);

  useEffect(() => {
    if (projects.length === 0) {
      setStatsByProject(new Map());
      setActivityByProject(new Map());
      setStatsLoading(false);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);

    void Promise.all(
      projects.map(async (project) => {
        try {
          const [stats, activity] = await Promise.all([
            fetchHeadlineStats(project.id),
            fetchProjectActivityBuckets(project.id),
          ]);
          return [project.id, stats, activity] as const;
        } catch {
          return [project.id, null, emptyListTrendBuckets()] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      const nextStats = new Map<string, HeadlineStats>();
      const nextActivity = new Map<string, TimelineBucket[]>();
      for (const [id, stats, activity] of entries) {
        if (stats) {
          nextStats.set(id, stats);
        }
        nextActivity.set(id, activity);
      }
      setStatsByProject(nextStats);
      setActivityByProject(nextActivity);
      setStatsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [projects]);

  function openWizard(opts: { name?: string; projectId?: string | null }) {
    setWizardName(opts.name?.trim() ?? "");
    setWizardProjectId(opts.projectId ?? null);
    setWizardOpen(true);
  }

  function handleCreateClick() {
    if (!canManage || busy) {
      return;
    }
    openWizard({ name: "" });
  }

  function handleWizardOpenChange(open: boolean) {
    setWizardOpen(open);
    if (!open && setupParam) {
      const next = new URLSearchParams(searchParams);
      next.delete("setup");
      setSearchParams(next, { replace: true });
    }
  }

  async function handleBulkDelete() {
    if (!canDeleteProjects || selectedProjects.length === 0) {
      return;
    }
    setBusy(true);
    const ids = selectedProjects.map((project) => project.id);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteProject(id)));
      const failed = results.filter((result) => result.status === "rejected").length;
      const deleted = ids.length - failed;
      await refreshProjects();
      exitEditMode();
      setDeleteOpen(false);
      if (failed > 0) {
        toast(
          deleted > 0
            ? `Deleted ${deleted} project${deleted === 1 ? "" : "s"} — ${failed} failed`
            : "Failed to delete projects",
        );
      } else {
        toast(`Deleted ${deleted} project${deleted === 1 ? "" : "s"}`);
      }
    } catch {
      toast("Failed to delete projects");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageShell density="standard">
        <Box flexDirection="column" rowGap="l" width="100%">
          {isPaused ? (
            <Alert
              variant="danger"
              title="7-day pilot ended"
              description="Production ingestion is paused. Upgrade to restore live tracking."
              actions={[
                {
                  text: "Upgrade to unpause",
                  onClick: () => navigate("/billing"),
                },
              ]}
            />
          ) : null}

          {searchParams.get("welcome") === "canary" ? (
            <Alert
              variant="info"
              title="Welcome to your Epure Cloud sandbox"
              description="Sample exceptions, a dedicated DSN, and Spike Valve protection are ready. Connect Claude Code or Cursor via epure-mcp, or upgrade to keep data beyond 7 days."
              onDismiss={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("welcome");
                setSearchParams(next, { replace: true });
              }}
              actions={[
                {
                  text: "View plans",
                  onClick: () => navigate("/billing"),
                },
              ]}
            />
          ) : null}

          <Grid
            templateColumns={PROJECT_GALLERY_GRID_COLUMNS}
            gap="l"
            width="100%"
            alignItems="center"
          >
            <Box alignItems="center" columnGap="s" minWidth={0} width="100%">
              <Text as="h2" variant="heading-xs" flexShrink={0}>
                Projects
              </Text>
              {projects.length > 0 ? (
                <Badge variant="neutral" size="compact">
                  {filteredProjects.length}
                  {filteredProjects.length !== projects.length ? ` of ${projects.length}` : ""}
                </Badge>
              ) : null}
              {!editMode && projects.length >= 2 ? (
                <Box flex={1} minWidth={0}>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by name or slug…"
                    leadingIcon={<Search size={14} />}
                  />
                </Box>
              ) : null}
            </Box>

            <GridItem
              colStart={{ base: 1, sm: 2 }}
              colEnd={{ base: -1, sm: -1 }}
              justifyContent="end"
              alignItems="center"
              columnGap="s"
              display="flex"
              flexWrap="wrap"
              rowGap="s"
            >
              {editMode && canDeleteProjects ? (
                <>
                  <Text variant="caption" color="muted">
                    {selectedIds.size} selected
                  </Text>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={projects.length === 0}
                    onClick={selectAllProjects}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={busy || selectedIds.size === 0}
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={exitEditMode}>
                    Done
                  </Button>
                </>
              ) : (
                <>
                  {canDeleteProjects && projects.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditMode(true)}
                    >
                      <Pencil size={14} />
                      Edit
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      onClick={handleCreateClick}
                    >
                      <Plus size={14} />
                      Create project
                    </Button>
                  ) : null}
                </>
              )}
            </GridItem>
          </Grid>

          <ProjectList
            projects={filteredProjects}
            statsByProject={statsByProject}
            activityByProject={activityByProject}
            loading={statsLoading}
            projectsLoading={projectsLoading}
            viewerRole={user?.role}
            editMode={editMode && canDeleteProjects}
            selectedIds={selectedIds}
            onToggleSelect={toggleProjectSelect}
          />

          {!canManage && !projectsLoading && safeProjects.length === 0 ? (
            <Text variant="body" color="muted">
              Ask an admin to create a project.
            </Text>
          ) : null}
        </Box>
      </PageShell>

      <SetupWizardDialog
        open={wizardOpen}
        onOpenChange={handleWizardOpenChange}
        initialName={wizardName}
        projectId={wizardProjectId}
      />

      <DeleteProjectsDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectNames={selectedProjects.map((project) => project.name)}
        onConfirm={handleBulkDelete}
        busy={busy}
      />
    </>
  );
}
