import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { deleteProject, updateProject } from "../../lib/api";
import { workspacePath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
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
import { SectionCard } from "@/components/kit/section-card";
import {
  DangerZone,
  DeleteProjectDialog,
  InfoCallout,
  MemberAccessNotice,
  SettingsSkeleton,
  SettingsStack,
} from "./shared";

const retentionOptions = [14, 30, 90] as const;

export function ProjectGeneralSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { projects, refreshProjects, user, userLoading, projectsLoading } = useAppContext();
  const safeProjects = Array.isArray(projects) ? projects : [];
  const project = safeProjects.find((row) => row && (row.id === paramId || row.slug === paramId)) ?? null;

  const [name, setName] = useState("");
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { toast } = useToast();

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canDelete = user?.role === "owner";

  const dirty = useMemo(() => {
    if (!project) return false;
    return name.trim() !== project.name || retentionDays !== project.retention_days;
  }, [name, project, retentionDays]);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setRetentionDays(project.retention_days);
      setNameError(undefined);
    }
  }, [project]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !canManage) return;

    if (!name.trim()) {
      setNameError("Required");
      return;
    }
    setNameError(undefined);

    setBusy(true);
    try {
      await updateProject(project.id, {
        name: name.trim(),
        retention_days: retentionDays,
      });
      await refreshProjects();
      toast("Saved");
    } catch {
      toast("Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!project || !canDelete) return;
    setBusy(true);
    try {
      await deleteProject(project.id);
      await refreshProjects();
      window.location.href = workspacePath();
    } catch {
      toast("Failed to delete project");
    } finally {
      setBusy(false);
    }
  }

  if (projectsLoading || userLoading) {
    return (
      <SettingsStack>
        <SettingsSkeleton />
      </SettingsStack>
    );
  }

  if (!project) {
    return (
      <SettingsStack>
        <InfoCallout variant="warning">Project not found.</InfoCallout>
      </SettingsStack>
    );
  }

  if (!canManage) {
    return (
      <SettingsStack>
        <MemberAccessNotice resource="project settings" />
      </SettingsStack>
    );
  }

  return (
    <SettingsStack>
      <form onSubmit={(event) => void handleSave(event)}>
        <SectionCard
          title="Project"
          description="Name and event retention."
          footer={
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-2xs text-fg-muted">
                {dirty ? "Unsaved changes" : "Up to date"}
              </span>
              <Button type="submit" variant="secondary" size="sm" disabled={busy || !dirty}>
                Save
              </Button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="project-name" error={nameError} className="gap-1.5">
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={128}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Retention" className="gap-1.5">
              <Select
                value={String(retentionDays)}
                onValueChange={(value) => setRetentionDays(Number(value))}
              >
                <SelectTrigger aria-label="Retention days" className="h-8 w-full text-xs">
                  <SelectValue>{retentionDays} days</SelectValue>
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
          </div>
        </SectionCard>
      </form>

      {canDelete ? (
        <DangerZone title="Delete project" description="Removes all data for this project.">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-fg-muted">
              Irreversible. Issues, events, and keys for{" "}
              <span className="font-medium text-fg-primary">{project.name}</span> go away.
            </p>
            <Button
              variant="danger"
              size="sm"
              className="shrink-0"
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
          <DeleteProjectDialog
            projectName={project.name}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onConfirm={handleDelete}
            busy={busy}
          />
        </DangerZone>
      ) : null}
    </SettingsStack>
  );
}
