import { type FormEvent, useEffect, useState } from "react";
import type { AccountSettingsContext } from "./use-account-settings";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Field } from "../../../ui/field";
import { Input } from "../../../ui/input";
import { SectionCard } from "@/components/kit/section-card";
import {
  InfoCallout,
  SettingsSkeleton,
  SettingsStack,
} from "../../settings/shared";

export function GeneralTab({ settings }: { settings: AccountSettingsContext }) {
  const { profile, saveDisplayName } = settings;
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  const dirty = displayName.trim() !== (profile?.display_name?.trim() ?? "");

  if (settings.loading) {
    return (
      <SettingsStack>
        <SettingsSkeleton />
      </SettingsStack>
    );
  }

  if (!profile) {
    return (
      <SettingsStack>
        <InfoCallout variant="warning">Could not load profile.</InfoCallout>
        <Button variant="secondary" size="sm" onClick={() => void settings.load()}>
          Retry
        </Button>
      </SettingsStack>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await saveDisplayName(displayName);
    } catch {
      setError("Could not save. Keep the name under 64 characters.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsStack>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <SectionCard
          title="Profile"
          description="How you appear in this workspace."
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
          <div className="space-y-3">
            <Field
              label="Display name"
              htmlFor="display-name"
              error={error ?? undefined}
              className="gap-1.5"
            >
              <Input
                id="display-name"
                type="text"
                autoComplete="name"
                placeholder={profile.email.split("@")[0] ?? "Your name"}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={64}
                className="h-8 text-xs"
              />
            </Field>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border-subtle px-2.5 py-2">
                <p className="text-2xs text-fg-muted">Email</p>
                <p className="mt-0.5 truncate text-xs text-fg-primary">{profile.email}</p>
              </div>
              <div className="rounded-md border border-border-subtle px-2.5 py-2">
                <p className="text-2xs text-fg-muted">Role</p>
                <div className="mt-0.5">
                  <Badge variant="env" size="compact" className="capitalize">
                    {profile.role ?? "member"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </form>
    </SettingsStack>
  );
}
