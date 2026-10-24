import { ArrowRight, Pencil, Plus, Search, Sparkles, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createProject,
  deleteProject,
  fetchBillingStatus,
  fetchHeadlineStats,
  patchSetupProgress,
  type BillingStatus,
  type HeadlineStats,
  type TimelineBucket,
} from "../../lib/api";
import { isCloudDeployment } from "../../lib/deployment";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { PageChrome } from "../../ui/page-chrome";
import { useToast } from "../../ui/toast-provider";
import { SetupWizardDialog } from "../setup/setup-wizard-dialog";
import { emptyListTrendBuckets } from "../issues/issue-feed-utils";
import { fetchProjectActivityBuckets } from "./project-activity";
import { DeleteProjectsDialog } from "./delete-projects-dialog";
import { ProjectList } from "./project-list";

export function OrgHomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, refreshProjects, user, setProjectId } = useAppContext();
  const [newProjectName, setNewProjectName] = useState("");
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
    (billingStatus?.canary_expires_at && new Date(billingStatus.canary_expires_at).getTime() <= Date.now())
  );

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canDeleteProjects = user?.role === "owner";

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.slug && p.slug.toLowerCase().includes(q)),
    );
  }, [projects, searchQuery]);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedIds.has(project.id)),
    [projects, selectedIds],
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
    setSelectedIds(new Set(projects.map((project) => project.id)));
  }, [projects]);
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

  async function handleCreateClick() {
    if (!canManage || busy) {
      return;
    }
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      openWizard({ name: "" });
      return;
    }

    setBusy(true);
    try {
      const created = await createProject(trimmed);
      setNewProjectName("");
      setProjectId(created.id);
      await refreshProjects();
      void patchSetupProgress({
        project_id: created.id,
        project_named: true,
      }).catch(() => undefined);
      openWizard({ name: created.name, projectId: created.id });
      toast(`Created ${created.name}`);
    } catch {
      toast("Failed to create project");
    } finally {
      setBusy(false);
    }
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
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome
        title="Projects"
        description={
          projects.length === 0
            ? "Create a project to connect a DSN — or explore Acme preview data."
            : projects.some((project) => project.is_demo)
              ? "Explore the Acme preview projects, or create your own to connect a DSN."
              : "Choose a project to monitor exceptions, or create a new one."
        }
        actions={
          canManage || canDeleteProjects ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {editMode && canDeleteProjects ? (
                <>
                  <span className="text-xs text-ink-muted">
                    {selectedIds.size} selected
                  </span>
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
                  {canManage ? (
                    <>
                      <Input
                        aria-label="New project name"
                        placeholder="Project name"
                        value={newProjectName}
                        onChange={(event) => setNewProjectName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateClick();
                          }
                        }}
                        className="h-8 w-40 sm:w-52"
                      />
                      <Button
                        type="button"
                        disabled={busy}
                        className="gap-1.5"
                        onClick={() => void handleCreateClick()}
                      >
                        <Plus size={14} />
                        Create project
                      </Button>
                    </>
                  ) : null}
                  {canDeleteProjects && projects.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setEditMode(true)}
                    >
                      <Pencil size={14} />
                      Edit
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-auto bg-bg px-4 py-5 md:px-6">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* Paused Canary Alert Banner */}
          {isPaused && (
            <div className="relative overflow-hidden rounded-xl border border-escalating/50 bg-gradient-to-r from-escalating/15 via-escalating/5 to-transparent p-5 shadow-xs">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="error" className="font-semibold text-2xs uppercase tracking-wide">
                      Project Paused
                    </Badge>
                    <span className="text-xs font-semibold text-fg-primary">
                      7-Day Pilot Trial Ended
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-fg-primary">
                    Production Error Ingestion is Currently Paused
                  </h2>
                  <p className="text-xs text-fg-muted max-w-2xl">
                    Your 7-day trial has expired and incoming production errors are no longer processed. Upgrade to Cloud Pro ($49/mo) or Team Plus to unpause ingestion and restore live tracking immediately.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="danger" size="sm" asChild className="gap-1.5 shadow-xs">
                    <Link to="/billing">
                      <Zap size={13} className="fill-current" />
                      Upgrade to Unpause
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Canary Welcome Pilot Banner */}
          {searchParams.get("welcome") === "canary" && (
            <div className="relative overflow-hidden rounded-xl border border-accent/40 bg-gradient-to-r from-accent/15 via-accent/5 to-transparent p-5 shadow-xs">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete("welcome");
                  setSearchParams(next, { replace: true });
                }}
                className="absolute top-3.5 right-3.5 text-fg-muted hover:text-fg-primary"
                aria-label="Dismiss banner"
              >
                <X size={14} />
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pr-8">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="env" className="border-accent/40 text-accent font-semibold">
                      <Sparkles size={11} className="mr-1 inline-block" />
                      Canary Pilot Workspace
                    </Badge>
                    <span className="text-xs font-semibold text-healthy">
                      7-Day Trial Active · 0 Credentials Required
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-fg-primary">
                    Welcome to your pre-provisioned Epure Cloud sandbox!
                  </h2>
                  <p className="text-xs text-fg-muted max-w-2xl">
                    Your environment is pre-loaded with sample exceptions, a dedicated DSN, and active Spike Valve crash-loop protection. Connect Claude Code or Cursor via <code className="rounded bg-surface-2 px-1.5 py-0.5 text-fg-primary font-mono text-2xs">epure-mcp</code> to auto-fix issues in seconds, or upgrade to keep your data beyond 7 days.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="signal" size="sm" asChild>
                    <Link to="/billing">
                      View Plans & Upgrade
                      <ArrowRight size={14} className="ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {projects.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1 select-none">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-fg-primary">Active Projects</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted border border-border-subtle">
                  {filteredProjects.length}
                  {filteredProjects.length !== projects.length ? ` of ${projects.length}` : ""}
                </span>
              </div>

              {projects.length >= 2 ? (
                <div className="w-56 sm:w-64">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by name or slug…"
                    leadingIcon={<Search className="h-3.5 w-3.5 text-fg-muted" />}
                    className="h-8 text-xs"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <ProjectList
            projects={filteredProjects}
            statsByProject={statsByProject}
            activityByProject={activityByProject}
            loading={statsLoading}
            viewerRole={user?.role}
            editMode={editMode && canDeleteProjects}
            selectedIds={selectedIds}
            onToggleSelect={toggleProjectSelect}
          />

          {!canManage && projects.length === 0 ? (
            <p className="text-sm text-fg-muted">Ask an admin to create a project.</p>
          ) : null}
        </div>
      </div>

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
    </div>
  );
}
