import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { deleteProject, updateProject } from "../../lib/api";
import { projectSettingsPath, workspacePath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { Button } from "@/ui/primitives";
import { CopyButton, Field, useToast } from "@/ui/components";
import { Input } from "@/ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives";
import { SectionCard } from "@/components/kit/section-card";
import {
  DangerZone,
  DeleteProjectDialog,
  InfoCallout,
  MemberAccessNotice,
  ReadOnlyDetail,
  SettingsSkeleton,
  SettingsStack,
} from "./shared";

const retentionOptions = [14, 30, 90] as const;
const ENV_EXAMPLES = ["production", "staging", "development"] as const;

function validateForm(name: string, ingestCap: number): { name?: string; ingestCap?: string } {
  const errors: { name?: string; ingestCap?: string } = {};
  if (!name.trim()) {
    errors.name = "Required";
  }
  if (!Number.isFinite(ingestCap) || ingestCap < 1) {
    errors.ingestCap = "At least 1 event per hour";
  }
  return errors;
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ProjectGeneralSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { projects, refreshProjects, user, userLoading, projectsLoading } = useAppContext();
  const safeProjects = Array.isArray(projects) ? projects : [];
  const project = safeProjects.find((row) => row && (row.id === paramId || row.slug === paramId)) ?? null;

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
    if (!project) return false;
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
    if (!project || !canManage) return;

    const nextErrors = validateForm(name, ingestCap);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      await updateProject(project.id, {
        name: name.trim(),
        retention_days: retentionDays,
        ingest_cap_per_hour: ingestCap,
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

  const slug = project.slug?.trim() || "-";

  return (
    <SettingsStack>
      <form onSubmit={(event) => void handleSave(event)}>
        <SectionCard
          title="Project"
          description="Identity, retention, and ingest limits."
          contentClassName="w-full min-w-0 space-y-5"
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
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="project-name" error={errors.name} className="gap-1.5">
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={128}
                className="h-8 w-full text-xs"
              />
            </Field>
            <Field label="Slug" className="gap-1.5">
              <div className="flex h-8 w-full items-center gap-1 rounded-md border border-border-subtle bg-surface-1 px-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted">{slug}</span>
                {project.slug ? (
                  <CopyButton
                    value={project.slug}
                    variant="icon-only"
                    size="icon"
                    label="Copy slug"
                    className="size-6 shrink-0"
                  />
                ) : null}
              </div>
            </Field>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2">
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
              <p className="text-2xs text-fg-muted">Raw events older than this are pruned.</p>
            </Field>
            <Field
              label="Hourly ingest cap"
              htmlFor="ingest-cap"
              error={errors.ingestCap}
              className="gap-1.5"
            >
              <Input
                id="ingest-cap"
                type="number"
                min={1}
                value={ingestCap}
                onChange={(event) => setIngestCap(Number(event.target.value))}
                className="h-8 w-full text-xs"
              />
              <p className="text-2xs text-fg-muted">Spike valve. Excess events are dropped.</p>
            </Field>
          </div>

          <div className="grid w-full gap-3 border-t border-border-subtle pt-4 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-2xs text-fg-muted">Project ID</p>
              <div className="mt-0.5 flex min-w-0 items-center gap-1">
                <p className="min-w-0 truncate font-mono text-xs text-fg-muted">{project.id}</p>
                <CopyButton
                  value={project.id}
                  variant="icon-only"
                  size="icon"
                  label="Copy project ID"
                  className="size-6 shrink-0"
                />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-2xs text-fg-muted">DSN project id</p>
              <div className="mt-0.5 flex min-w-0 items-center gap-1">
                <p className="font-mono text-xs text-fg-muted">{project.dsn_project_id}</p>
                <CopyButton
                  value={String(project.dsn_project_id)}
                  variant="icon-only"
                  size="icon"
                  label="Copy DSN project id"
                  className="size-6 shrink-0"
                />
              </div>
            </div>
            <ReadOnlyDetail label="Created" value={formatCreatedAt(project.created_at)} />
          </div>
        </SectionCard>
      </form>

      <SectionCard
        title="Environments"
        description="Filter issues by the environment tag from your SDK."
        contentClassName="w-full min-w-0 space-y-3"
      >
        <p className="text-xs text-fg-muted">
          Set <span className="font-mono text-fg-primary">environment</span> in SDK init. Common
          values:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ENV_EXAMPLES.map((env) => (
            <span
              key={env}
              className="rounded-md border border-border-subtle bg-surface-1 px-2 py-0.5 font-mono text-2xs text-fg-primary"
            >
              {env}
            </span>
          ))}
        </div>
        <p className="text-2xs text-fg-muted">
          Client keys live under{" "}
          <Link
            to={projectSettingsPath(project.id, "dsn")}
            className="text-fg-primary underline-offset-2 hover:underline"
          >
            Client Keys
          </Link>
          .
        </p>
      </SectionCard>

      {canDelete ? (
        <DangerZone title="Delete project" description="Removes all data for this project.">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-fg-muted">
              Irreversible. Issues, events, and keys for{" "}
              <span className="font-medium text-fg-primary">{project.name}</span> go away.
            </p>
            <Button
              type="button"
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
