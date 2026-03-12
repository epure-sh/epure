import { type FormEvent, useEffect, useState } from "react";
import type { AccountSettingsContext } from "./use-account-settings";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Field } from "../../../ui/field";
import { Input } from "../../../ui/input";

export function GeneralTab({ settings }: { settings: AccountSettingsContext }) {
  const { profile, saveDisplayName } = settings;
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  const dirty =
    displayName.trim() !== (profile?.display_name?.trim() ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await saveDisplayName(displayName);
    } catch {
      setError("Could not save profile. Display name must be 64 characters or fewer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <form
        className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <Field
          label="Display name"
          htmlFor="display-name"
          className="min-w-[12rem] flex-1"
          error={error ?? undefined}
        >
          <Input
            id="display-name"
            type="text"
            autoComplete="name"
            placeholder={profile?.email.split("@")[0] ?? "Your name"}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={64}
            className="h-8"
          />
        </Field>
        <Button type="submit" variant="secondary" size="sm" disabled={busy || !dirty}>
          Save
        </Button>
      </form>

      <dl className="grid gap-px bg-border sm:grid-cols-3">
        <div className="bg-surface px-4 py-3">
          <dt className="text-2xs uppercase tracking-wide text-ink-muted">Email</dt>
          <dd className="mt-1 truncate text-sm text-ink">{profile?.email ?? "…"}</dd>
        </div>
        <div className="bg-surface px-4 py-3">
          <dt className="text-2xs uppercase tracking-wide text-ink-muted">Role</dt>
          <dd className="mt-1">
            <Badge variant="env" size="compact" className="capitalize">
              {profile?.role ?? "member"}
            </Badge>
          </dd>
        </div>
        <div className="bg-surface px-4 py-3">
          <dt className="text-2xs uppercase tracking-wide text-ink-muted">User ID</dt>
          <dd className="mt-1 truncate font-mono text-2xs text-ink-muted">
            {profile?.user_id ?? "…"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
