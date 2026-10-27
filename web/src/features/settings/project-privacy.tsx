import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  eraseDataSubject,
  exportDataSubject,
  stripStoredIdentifiers,
  updateProject,
} from "../../lib/api";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { useToast } from "../../ui/toast-provider";
import { DangerZone, InfoCallout, MemberAccessNotice, SettingsTabHeader } from "./shared";

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
      <div className="space-y-4">
        <SettingsTabHeader
          title="Privacy"
          description="End-user data stored with errors from this project."
        />
        <div className="h-32 rounded-lg border border-border-subtle bg-surface-1 animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <SettingsTabHeader
          title="Privacy"
          description="End-user data stored with errors from this project."
        />
        <InfoCallout variant="warning">Project not found. It may have been deleted.</InfoCallout>
      </div>
    );
  }

  if (!canManage) {
    return <MemberAccessNotice resource="privacy settings" />;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) {
      return;
    }
    setSaving(true);
    try {
      await updateProject(project.id, { store_end_user_identifiers: draft });
      await refreshProjects();
      setStoreIdentifiers(null);
      toast(draft ? "End-user identifiers will be stored" : "End-user identifiers will be dropped");
    } catch {
      toast("Failed to save privacy settings");
    } finally {
      setSaving(false);
    }
  }

  function subjectBody(): { user_id?: string; email?: string } | null {
    const user_id = subjectId.trim();
    const email = subjectEmail.trim();
    if (!user_id && !email) {
      return null;
    }
    return {
      user_id: user_id || undefined,
      email: email || undefined,
    };
  }

  async function handleExport() {
    if (!project) {
      return;
    }
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
      toast(
        result.truncated
          ? `Exported ${result.events.length.toLocaleString()} of ${result.total.toLocaleString()} events`
          : `Exported ${result.total.toLocaleString()} events`,
      );
    } catch {
      toast("Could not export this person's events");
    } finally {
      setBusy(false);
    }
  }

  async function handleErase() {
    if (!project) {
      return;
    }
    const body = subjectBody();
    if (!body) {
      toast("Enter a user id or email");
      return;
    }
    const label = body.email ?? body.user_id;
    if (!window.confirm(`Delete stored events for ${label}? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      const result = await eraseDataSubject(project.id, body);
      toast(`Deleted ${result.events_deleted.toLocaleString()} events`);
    } catch {
      toast("Could not erase this person's events");
    } finally {
      setBusy(false);
    }
  }

  async function handleStrip() {
    if (!project) {
      return;
    }
    if (
      !window.confirm(
        "Remove stored emails, usernames, and precise location from events already in this project?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await stripStoredIdentifiers(project.id);
      toast(`Updated ${result.events_updated.toLocaleString()} stored events`);
    } catch {
      toast("Could not remove stored identifiers");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title="Privacy"
        description="What Epure keeps about the people who hit errors in your app."
      />

      <form className="space-y-4" onSubmit={(event) => void handleSave(event)}>
        <Card>
          <CardHeader>
            <CardTitle>End-user identifiers</CardTitle>
            <CardDescription>
              Off by default. Opaque user ids stay so you can count affected people. Email addresses,
              usernames, IP addresses, and city-level location are dropped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <label htmlFor="store-identifiers" className="text-sm font-medium text-fg-primary">
                  Store emails and usernames
                </label>
                <p className="mt-1 text-xs text-fg-muted">
                  Turn this on only when you have a reason to keep contact details inside error
                  reports. IP addresses stay off either way. SDK option{" "}
                  <span className="font-mono">sendDefaultPii</span> should stay false.
                </p>
              </div>
              <Switch
                id="store-identifiers"
                checked={draft}
                onCheckedChange={(checked) => setStoreIdentifiers(checked)}
                aria-label="Store emails and usernames"
              />
            </div>
            <InfoCallout>
              New events follow this setting. Events already stored keep what they had until you
              erase a person or remove stored identifiers below.{" "}
              <Link to="/privacy" className="text-fg-primary underline underline-offset-2">
                Privacy notice
              </Link>
            </InfoCallout>
            <Button type="submit" variant="secondary" disabled={saving || draft === stored}>
              Save privacy setting
            </Button>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Access and erasure</CardTitle>
          <CardDescription>
            Find events for one person and export or delete them. Matches the id, the email, and the
            pseudonym Epure uses when an id looks like an email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="User id" htmlFor="subject-id" hint="SDK user.id, or an email used as the id.">
              <Input
                id="subject-id"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Email" htmlFor="subject-email" hint="Address previously stored on an event.">
              <Input
                id="subject-email"
                type="email"
                value={subjectEmail}
                onChange={(event) => setSubjectEmail(event.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleExport()}>
              Export JSON
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => void handleErase()}>
              Delete events
            </Button>
          </div>
        </CardContent>
      </Card>

      <DangerZone
        title="Remove stored identifiers"
        description="Clear contact details already saved on this project's events."
      >
        <p className="text-sm text-fg-muted">
          This blanks email, username, name, IP, and city fields, and clears feedback names. Text
          inside exception messages is left in place until retention deletes the event. Use erasure
          above when a person asks for their events to be deleted.
        </p>
        <Button
          type="button"
          variant="danger"
          className="mt-3"
          disabled={busy}
          onClick={() => void handleStrip()}
        >
          Remove stored identifiers
        </Button>
      </DangerZone>
    </div>
  );
}
