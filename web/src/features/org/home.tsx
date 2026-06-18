import { Plus } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createProject,
  fetchHeadlineStats,
  patchSetupProgress,
  type HeadlineStats,
} from "../../lib/api";
import { projectPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { PageChrome } from "../../ui/page-chrome";
import { useToast } from "../../ui/toast-provider";
import { ProjectList } from "./project-list";

export function OrgHomePage() {
  const navigate = useNavigate();
  const { projects, refreshProjects, user } = useAppContext();
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statsByProject, setStatsByProject] = useState<Map<string, HeadlineStats>>(new Map());
  const [statsLoading, setStatsLoading] = useState(false);
  const { toast } = useToast();

  const canManage = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    if (projects.length === 0) {
      setStatsByProject(new Map());
      setStatsLoading(false);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);

    void Promise.all(
      projects.map(async (project) => {
        try {
          const stats = await fetchHeadlineStats(project.id);
          return [project.id, stats] as const;
        } catch {
          return [project.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      const next = new Map<string, HeadlineStats>();
      for (const [id, stats] of entries) {
        if (stats) {
          next.set(id, stats);
        }
      }
      setStatsByProject(next);
      setStatsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [projects]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      setNewProjectError("Project name is required.");
      return;
    }
    setNewProjectError(null);
    setBusy(true);
    try {
      const created = await createProject(trimmed);
      setNewProjectName("");
      await refreshProjects();
      await patchSetupProgress({
        project_id: created.id,
        project_named: true,
      });
      navigate(projectPath(created.id, "setup"));
      toast(`Created ${created.name} — finish setup`);
    } catch {
      toast("Failed to create project");
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
            ? "Create your first project — setup takes about two minutes."
            : "Choose a project to monitor exceptions, or create a new one."
        }
      />

      <div className="flex-1 overflow-auto bg-bg p-4">
        <div className="mx-auto max-w-org space-y-4">
          <ProjectList
            projects={projects}
            statsByProject={statsByProject}
            loading={statsLoading}
          />

          {!canManage && projects.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Ask an admin to create a project.
            </p>
          ) : null}

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>New project</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="flex flex-wrap gap-2" onSubmit={(event) => void handleCreate(event)}>
                  <Input
                    aria-label="New project name"
                    aria-invalid={newProjectError ? true : undefined}
                    placeholder="Acme Web"
                    value={newProjectName}
                    onChange={(event) => {
                      setNewProjectName(event.target.value);
                      if (newProjectError) {
                        setNewProjectError(null);
                      }
                    }}
                    className="max-w-xs"
                  />
                  <Button type="submit" disabled={busy} className="gap-1.5">
                    <Plus size={14} />
                    Create project
                  </Button>
                </form>
                {newProjectError ? (
                  <p className="mt-2 text-sm text-semantic-danger">{newProjectError}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
