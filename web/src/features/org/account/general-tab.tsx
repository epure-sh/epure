import { type FormEvent, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/shell/app-context";
import type { AccountSettingsContext } from "./use-account-settings";
import {
  SettingsPage,
  SettingsPageHeader,
  SettingsPanel,
  SettingsSkeletonRows,
} from "./settings-chrome";

export function GeneralTab({ settings }: { settings: AccountSettingsContext }) {
  const { currentOrg } = useAppContext();
  const { profile, saveDisplayName } = settings;
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orgName = currentOrg?.name ?? profile?.org_name ?? "Workspace";

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  const dirty = displayName.trim() !== (profile?.display_name?.trim() ?? "");
  const previewName = displayName.trim() || profile?.email?.split("@")[0] || "You";

  if (settings.loading) {
    return (
      <SettingsPage>
        <SettingsPageHeader title="Profile" description="Loading…" />
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
          <SettingsSkeletonRows count={2} />
        </div>
      </SettingsPage>
    );
  }

  if (!profile) {
    return (
      <SettingsPage>
        <SettingsPageHeader title="Profile" description="Could not load your profile." />
        <Button type="button" variant="secondary" size="sm" onClick={() => void settings.load()}>
          Retry
        </Button>
      </SettingsPage>
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
    <SettingsPage>
      <SettingsPageHeader
        title="Profile"
        description={
          <>
            How you appear in <span className="font-medium text-fg-primary">{orgName}</span>.
          </>
        }
        badge={
          <Badge variant="neutral" size="compact" className="capitalize">
            {profile.role ?? "member"}
          </Badge>
        }
      />

      <form onSubmit={(event) => void handleSubmit(event)}>
        <SettingsPanel
          title="Your account"
          description="Display name is visible to teammates. Email and role are fixed here."
          footer={
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-2xs text-fg-muted">
                {error ? (
                  <span className="text-semantic-danger">{error}</span>
                ) : dirty ? (
                  "Unsaved changes"
                ) : (
                  "Up to date"
                )}
              </span>
              <Button type="submit" variant="primary" size="sm" disabled={busy || !dirty}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Avatar name={previewName} className="size-12 shrink-0 text-sm" />
            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="display-name" className="text-2xs font-medium text-fg-muted">
                  Display name
                </label>
                <Input
                  id="display-name"
                  type="text"
                  autoComplete="name"
                  placeholder={profile.email.split("@")[0] ?? "Your name"}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={64}
                  className="h-8 max-w-md text-xs"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border-subtle px-3 py-2.5">
                  <p className="text-2xs text-fg-muted">Email</p>
                  <p className="mt-0.5 truncate text-xs text-fg-primary">{profile.email}</p>
                </div>
                <div className="rounded-md border border-border-subtle px-3 py-2.5">
                  <p className="text-2xs text-fg-muted">Role in {orgName}</p>
                  <div className="mt-1">
                    <Badge variant="neutral" size="compact" className="capitalize">
                      {profile.role ?? "member"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SettingsPanel>
      </form>
    </SettingsPage>
  );
}
