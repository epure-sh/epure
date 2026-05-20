import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createProject,
  fetchHeadlineStats,
  patchSetupProgress,
  type HeadlineStats,
  type TimelineBucket,
} from "../../lib/api";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { PageChrome } from "../../ui/page-chrome";
import { useToast } from "../../ui/toast-provider";
import { SetupWizardDialog } from "../setup/setup-wizard-dialog";
import { emptyListTrendBuckets } from "../issues/issue-feed-utils";
import { fetchProjectActivityBuckets } from "./project-activity";
import { ProjectList } from "./project-list";

export function OrgHomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, refreshProjects, user, setProjectId } = useAppContext();
  const [newProjectName, setNewProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [statsByProject, setStatsByProject] = useState<Map<string, HeadlineStats>>(new Map());
  const [activityByProject, setActivityByProject] = useState<Map<string, TimelineBucket[]>>(
    new Map(),
  );
  const [statsLoading, setStatsLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardName, setWizardName] = useState("");
  const [wizardProjectId, setWizardProjectId] = useState<string | null>(null);
  const { toast } = useToast();

  const canManage = user?.role === "owner" || user?.role === "admin";
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
          canManage ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
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
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-auto bg-bg px-4 py-4">
        <div className="space-y-4">
          <ProjectList
            projects={projects}
            statsByProject={statsByProject}
            activityByProject={activityByProject}
            loading={statsLoading}
            viewerRole={user?.role}
          />

          {!canManage && projects.length === 0 ? (
            <p className="text-sm text-ink-muted">Ask an admin to create a project.</p>
          ) : null}
        </div>
      </div>

      <SetupWizardDialog
        open={wizardOpen}
        onOpenChange={handleWizardOpenChange}
        initialName={wizardName}
        projectId={wizardProjectId}
      />
    </div>
  );
}
