import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { deleteProject, updateProject } from "../../lib/api";
import { workspacePath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
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
  MemberAccessNotice,
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

export function ProjectGeneralSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { projects, refreshProjects, user } = useAppContext();
  const project = projects.find((row) => row.id === paramId) ?? null;

  const [name, setName] = useState("");
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [ingestCap, setIngestCap] = useState<number>(5000);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; ingestCap?: string }>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { toast } = useToast();

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canDelete = user?.role === "owner";

  const dirty = useMemo(() => {
    if (!project) {
      return false;
    }
    return (
      name.trim() !== project.name ||
      retentionDays !== project.retention_days ||
      ingestCap !== project.ingest_cap_per_hour
    );
  }, [ingestCap, name, project, retentionDays]);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setRetentionDays(project.retention_days);
      setIngestCap(project.ingest_cap_per_hour);
      setErrors({});
    }
  }, [project]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !canManage) {
      return;
    }

    const nextErrors = validateForm(name, ingestCap);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setBusy(true);
    try {
      await updateProject(project.id, {
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

  async function handleDelete() {
    if (!project || !canDelete) {
      return;
    }
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

  if (!project) {
    return (
      <div className="space-y-4">
        <SettingsTabHeader title="General" description="Project identity and data policies." />
        <InfoCallout variant="warning">Project not found. It may have been deleted.</InfoCallout>
      </div>
    );
  }

  if (!canManage) {
    return <MemberAccessNotice resource="project settings" />;
  }

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title="General"
        description="Identity, retention, ingest limits, and environment conventions for this project."
      />

      <form className="space-y-4" onSubmit={(event) => void handleSave(event)}>
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>How this project appears in epure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Display name"
              htmlFor="project-name"
              hint="Shown in the project switcher and settings."
              error={errors.name}
            >
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={128}
              />
            </Field>

            <ReadOnlyDetail
              label="Slug"
              value={project.slug ?? "—"}
              mono
            />
            <p className="text-xs text-ink-muted">
              Slugs are generated at creation and used in URLs. They cannot be changed.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyDetail label="Project ID" value={project.id} mono />
              <ReadOnlyDetail
                label="Created"
                value={new Date(project.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data retention</CardTitle>
            <CardDescription>How long raw events are kept before TTL cleanup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Retention period"
              hint="Older event partitions are dropped automatically. Issues remain until you resolve or delete them."
            >
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
            <InfoCallout>
              Retention applies to stored events and breadcrumbs. Grouped issues and alert history
              follow separate lifecycle rules.
            </InfoCallout>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingest limits</CardTitle>
            <CardDescription>Protect this project from runaway error volume.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Hourly ingest cap"
              htmlFor="ingest-cap"
              hint="When exceeded, the spike valve drops new events until the next hour."
              error={errors.ingestCap}
            >
              <Input
                id="ingest-cap"
                type="number"
                min={1}
                step={1}
                value={ingestCap}
                onChange={(event) => setIngestCap(Number(event.target.value))}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <span>Current cap:</span>
              <Badge variant="env" className="font-mono">
                {project.ingest_cap_per_hour.toLocaleString()} events / hour
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environments</CardTitle>
            <CardDescription>Filter issues by deploy target in the SDK.</CardDescription>
          </CardHeader>
          <CardContent>
            <EnvironmentReference />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" disabled={busy || !dirty}>
            Save changes
          </Button>
          {dirty ? (
            <p className="self-center text-xs text-ink-muted">You have unsaved changes.</p>
          ) : null}
        </div>
      </form>

      {canDelete ? (
        <DangerZone
          title="Delete project"
          description="Permanently remove this project and all of its data."
        >
          <p className="text-sm text-ink-muted">
            Deleting removes issues, events, DSN keys, webhooks, and releases for{" "}
            <span className="font-medium text-ink">{project.name}</span>. This cannot be undone.
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
            projectName={project.name}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onConfirm={handleDelete}
            busy={busy}
          />
        </DangerZone>
      ) : null}
    </div>
  );
}
