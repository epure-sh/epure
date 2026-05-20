import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createProject,
  deleteProject,
  patchSetupProgress,
  updateProject,
  type ProjectRow,
} from "../../lib/api";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { useToast } from "../../ui/toast-provider";
import {
  DangerZone,
  DeleteProjectDialog,
  EnvironmentReference,
  InfoCallout,
  ReadOnlyDetail,
  SettingsTabHeader,
} from "./shared";

const retentionOptions = [14, 30, 90] as const;

function validateForm(name: string, ingestCap: number): { name?: string; ingestCap?: string } {
  const errors: { name?: string; ingestCap?: string } = {};
  if (!name.trim()) {
    errors.name = "Project name is required.";
  }
  if (!Number.isFinite(ingestCap) || ingestCap < 1) {
    errors.ingestCap = "Ingest cap must be at least 1 event per hour.";
  }
  return errors;
}

export function ProjectsSettings() {
  const navigate = useNavigate();
  const { projects, refreshProjects, user, projectId, setProjectId } = useAppContext();
  const [selectedId, setSelectedId] = useState(projectId);
  const [name, setName] = useState("");
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [ingestCap, setIngestCap] = useState<number>(5000);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; ingestCap?: string }>({});
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { toast } = useToast();

  const selected = projects.find((project) => project.id === selectedId) ?? projects[0];

  const dirty = useMemo(() => {
    if (!selected) {
      return false;
    }
    return (
      name.trim() !== selected.name ||
      retentionDays !== selected.retention_days ||
      ingestCap !== selected.ingest_cap_per_hour
    );
  }, [ingestCap, name, selected, retentionDays]);

  useEffect(() => {
    if (selected) {
      setSelectedId(selected.id);
      setName(selected.name);
      setRetentionDays(selected.retention_days);
      setIngestCap(selected.ingest_cap_per_hour);
      setErrors({});
    }
  }, [selected]);

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canDelete = user?.role === "owner";

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canManage) {
      return;
    }

    const nextErrors = validateForm(name, ingestCap);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setBusy(true);
    try {
      await updateProject(selected.id, {
        name: name.trim(),
        retention_days: retentionDays,
        ingest_cap_per_hour: ingestCap,
      });
      await refreshProjects();
      toast("Project settings saved");
    } catch {
      toast("Failed to save project");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
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
      setProjectId(created.id);
      try {
        await patchSetupProgress({
          project_id: created.id,
          project_named: true,
        });
      } catch {
        /* open wizard anyway */
      }
      navigate(`/?setup=${encodeURIComponent(created.id)}`);
      toast(`Created ${created.name} — finish setup`);
    } catch {
      toast("Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!selected || !canDelete) {
      return;
    }
    setBusy(true);
    try {
      await deleteProject(selected.id);
      await refreshProjects();
      toast("Project deleted");
    } catch {
      toast("Failed to delete project");
    } finally {
      setBusy(false);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <SettingsTabHeader title="Projects" description="Create and manage workspace projects." />
        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Create your first project</CardTitle>
              <CardDescription>Each project has its own DSN, issues, and settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-wrap gap-2" onSubmit={(event) => void handleCreate(event)}>
                <Field label="Project name" htmlFor="new-project-name" error={newProjectError ?? undefined}>
                  <Input
                    id="new-project-name"
                    placeholder="Backend API"
                    value={newProjectName}
                    onChange={(event) => {
                      setNewProjectName(event.target.value);
                      if (newProjectError) {
                        setNewProjectError(null);
                      }
                    }}
                  />
                </Field>
                <Button type="submit" disabled={busy}>Create project</Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <InfoCallout>No projects yet. Ask an admin to create one.</InfoCallout>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title="Projects"
        description="Switch between projects and edit retention or ingest limits."
      />

      <Field label="Active project">
        <Select
          value={selected?.id ?? ""}
          onValueChange={(value) => setSelectedId(value)}
        >
          <SelectTrigger aria-label="Project">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project: ProjectRow) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {canManage && selected ? (
        <form className="space-y-4" onSubmit={(event) => void handleSave(event)}>
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>Project name and identifiers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Display name" htmlFor="project-name" error={errors.name}>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={128}
                />
              </Field>
              <ReadOnlyDetail label="Slug" value={selected.slug ?? "—"} mono />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data & limits</CardTitle>
              <CardDescription>Retention and spike valve settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Retention period">
                <Select
                  value={String(retentionDays)}
                  onValueChange={(value) => setRetentionDays(Number(value))}
                >
                  <SelectTrigger aria-label="Retention days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {retentionOptions.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {days} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Hourly ingest cap" htmlFor="ingest-cap" error={errors.ingestCap}>
                <Input
                  id="ingest-cap"
                  type="number"
                  min={1}
                  value={ingestCap}
                  onChange={(event) => setIngestCap(Number(event.target.value))}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Environments</CardTitle>
              <CardDescription>SDK environment tags for filtering.</CardDescription>
            </CardHeader>
            <CardContent>
              <EnvironmentReference />
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={busy || !dirty}>
              Save changes
            </Button>
          </div>

          {canDelete ? (
            <DangerZone
              title="Delete project"
              description="Permanently remove this project and all of its data."
            >
              <p className="text-sm text-ink-muted">
                Deletes <span className="font-medium text-ink">{selected.name}</span> and all related
                data.
              </p>
              <Button
                variant="danger"
                className="mt-3"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                Delete project
              </Button>
              <DeleteProjectDialog
                projectName={selected.name}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onConfirm={handleDelete}
                busy={busy}
              />
            </DangerZone>
          ) : null}
        </form>
      ) : (
        <InfoCallout>
          You have member access. Project settings require admin or owner.
        </InfoCallout>
      )}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>New project</CardTitle>
            <CardDescription>Add another app or service to this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-wrap gap-2" onSubmit={(event) => void handleCreate(event)}>
              <Field label="Project name" htmlFor="create-project-name" error={newProjectError ?? undefined}>
                <Input
                  id="create-project-name"
                  placeholder="Backend API"
                  value={newProjectName}
                  onChange={(event) => {
                    setNewProjectName(event.target.value);
                    if (newProjectError) {
                      setNewProjectError(null);
                    }
                  }}
                />
              </Field>
              <Button type="submit" disabled={busy}>Create</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
