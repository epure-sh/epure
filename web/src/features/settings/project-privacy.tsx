import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import {
  eraseDataSubject,
  exportDataSubject,
  stripStoredIdentifiers,
  updateProject,
} from "../../lib/api";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { useToast } from "../../ui/toast-provider";
import { SectionCard } from "@/components/kit/section-card";
import {
  DangerZone,
  InfoCallout,
  MemberAccessNotice,
  SettingsSkeleton,
  SettingsStack,
} from "./shared";

export function ProjectPrivacySettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { projects, refreshProjects, user, userLoading, projectsLoading } = useAppContext();
  const safeProjects = Array.isArray(projects) ? projects : [];
  const project =
    safeProjects.find((row) => row && (row.id === paramId || row.slug === paramId)) ?? null;
  const { toast } = useToast();

  const [storeIdentifiers, setStoreIdentifiers] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [subjectEmail, setSubjectEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage = user?.role === "owner" || user?.role === "admin";
  const stored = project?.store_end_user_identifiers === true;
  const draft = storeIdentifiers ?? stored;

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
        <MemberAccessNotice resource="privacy settings" />
      </SettingsStack>
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    setSaving(true);
    try {
      await updateProject(project.id, { store_end_user_identifiers: draft });
      await refreshProjects();
      setStoreIdentifiers(null);
      toast(draft ? "Identifiers on" : "Identifiers off");
    } catch {
      toast("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function subjectBody(): { user_id?: string; email?: string } | null {
    const user_id = subjectId.trim();
    const email = subjectEmail.trim();
    if (!user_id && !email) return null;
    return {
      user_id: user_id || undefined,
      email: email || undefined,
    };
  }

  async function handleExport() {
    if (!project) return;
    const body = subjectBody();
    if (!body) {
      toast("Enter a user id or email");
      return;
    }
    setBusy(true);
    try {
      const result = await exportDataSubject(project.id, body);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `epure-subject-${project.slug ?? project.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast(`Exported ${result.total.toLocaleString()} events`);
    } catch {
      toast("Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleErase() {
    if (!project) return;
    const body = subjectBody();
    if (!body) {
      toast("Enter a user id or email");
      return;
    }
    const label = body.email ?? body.user_id;
    if (!window.confirm(`Delete events for ${label}?`)) return;
    setBusy(true);
    try {
      const result = await eraseDataSubject(project.id, body);
      toast(`Deleted ${result.events_deleted.toLocaleString()} events`);
    } catch {
      toast("Erase failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleStrip() {
    if (!project) return;
    if (!window.confirm("Strip stored emails, usernames, and location from existing events?")) {
      return;
    }
    setBusy(true);
    try {
      const result = await stripStoredIdentifiers(project.id);
      toast(`Updated ${result.events_updated.toLocaleString()} events`);
    } catch {
      toast("Strip failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsStack>
      <form onSubmit={(event) => void handleSave(event)}>
        <SectionCard
          title="Identifiers"
          description="Emails and usernames. Off by default."
          footer={
            <div className="flex w-full justify-end">
              <Button type="submit" variant="secondary" size="sm" disabled={saving || draft === stored}>
                Save
              </Button>
            </div>
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg-primary">Store emails & usernames</p>
              <p className="mt-0.5 text-2xs text-fg-muted">
                Opaque user ids stay. IPs never stored.
              </p>
            </div>
            <Switch
              id="store-identifiers"
              checked={draft}
              onCheckedChange={(checked) => setStoreIdentifiers(checked)}
              aria-label="Store emails and usernames"
            />
          </div>
        </SectionCard>
      </form>

      <SectionCard title="Subject tools" description="Export or erase one person.">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="User id" htmlFor="subject-id" className="gap-1.5">
              <Input
                id="subject-id"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                autoComplete="off"
                className="h-8 text-xs"
                placeholder="user.id"
              />
            </Field>
            <Field label="Email" htmlFor="subject-email" className="gap-1.5">
              <Input
                id="subject-email"
                type="email"
                value={subjectEmail}
                onChange={(event) => setSubjectEmail(event.target.value)}
                autoComplete="off"
                className="h-8 text-xs"
                placeholder="name@company.com"
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void handleExport()}>
              Export
            </Button>
            <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => void handleErase()}>
              Erase
            </Button>
          </div>
        </div>
      </SectionCard>

      <DangerZone title="Strip identifiers" description="Clear contact fields on stored events.">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-fg-muted">Blanks email, username, IP, and city on existing events.</p>
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="shrink-0"
            disabled={busy}
            onClick={() => void handleStrip()}
          >
            Strip
          </Button>
        </div>
      </DangerZone>
    </SettingsStack>
  );
}
