import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { exportAccount } from "../../../lib/api";
import type { AccountSettingsContext } from "./use-account-settings";
import { isCloudDeployment, isGoogleSignInVisible } from "../../../lib/deployment";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../ui/dialog";
import { Field } from "../../../ui/field";
import { Input } from "../../../ui/input";
import { cn } from "../../../lib/cn";
import { SectionCard } from "@/components/kit/section-card";
import {
  InfoCallout,
  SettingsSkeleton,
  SettingsStack,
} from "../../settings/shared";

function SettingsRow({
  title,
  description,
  badge,
  action,
  danger = false,
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
  action: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-h-10 flex-wrap items-center justify-between gap-3 px-3 py-2",
        danger && "bg-semantic-danger/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={cn(
              "text-xs font-medium",
              danger ? "text-semantic-danger" : "text-fg-primary",
            )}
          >
            {title}
          </p>
          {badge}
        </div>
        <p className="mt-0.5 text-2xs text-fg-muted">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function SecurityTab({ settings }: { settings: AccountSettingsContext }) {
  const { profile, authConfig, logout, savePassword, removeAccount } = settings;
  const passwordAuthEnabled = authConfig?.password_enabled !== false;
  const googleEnabled = isGoogleSignInVisible(authConfig?.google_enabled);
  const githubEnabled = isGoogleSignInVisible(authConfig?.github_enabled);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        <InfoCallout variant="warning">Could not load account.</InfoCallout>
        <Button variant="secondary" size="sm" onClick={() => void settings.load()}>
          Retry
        </Button>
      </SettingsStack>
    );
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordBusy(true);
    try {
      await savePassword({
        hasPassword: profile?.has_password ?? false,
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteError(null);
    if (!profile) return;

    setDeleteBusy(true);
    try {
      await removeAccount({
        email: profile.email,
        hasPassword: profile.has_password,
        confirmEmail: deleteEmail,
        password: deletePassword,
      });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete account.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <SettingsStack>
      <SectionCard title="Security" description="Sign-in, session, and account data." flush>
        <div className="w-full divide-y divide-border-subtle">
          {passwordAuthEnabled ? (
            <SettingsRow
              title="Password"
              description={
                profile.has_password
                  ? "Email and password sign-in enabled."
                  : "No password set."
              }
              badge={
                <Badge variant="env" size="compact">
                  {profile.has_password ? "On" : "Off"}
                </Badge>
              }
              action={
                <Button variant="secondary" size="sm" className="h-7" onClick={() => setPasswordOpen(true)}>
                  {profile.has_password ? "Change" : "Set"}
                </Button>
              }
            />
          ) : null}

          {googleEnabled ? (
            <SettingsRow
              title="Google"
              description={profile.google_linked ? "Linked." : "Not connected."}
              badge={
                <Badge variant="env" size="compact">
                  {profile.google_linked ? "On" : "Off"}
                </Badge>
              }
              action={
                profile.google_linked ? (
                  <span className="text-2xs text-fg-muted">—</span>
                ) : (
                  <Button variant="secondary" size="sm" className="h-7" asChild>
                    <a href="/api/v1/auth/google">Connect</a>
                  </Button>
                )
              }
            />
          ) : null}

          {githubEnabled ? (
            <SettingsRow
              title="GitHub"
              description={profile.github_linked ? "Linked." : "Not connected."}
              badge={
                <Badge variant="env" size="compact">
                  {profile.github_linked ? "On" : "Off"}
                </Badge>
              }
              action={
                profile.github_linked ? (
                  <span className="text-2xs text-fg-muted">—</span>
                ) : (
                  <Button variant="secondary" size="sm" className="h-7" asChild>
                    <a href="/api/v1/auth/github">Connect</a>
                  </Button>
                )
              }
            />
          ) : null}

          <SettingsRow
            title="Session"
            description="Signed in on this browser."
            action={
              <Button variant="secondary" size="sm" className="h-7" onClick={() => void logout()}>
                Log out
              </Button>
            }
          />

          <SettingsRow
            title="Export data"
            description={exportError ?? "Profile and memberships. No secrets."}
            action={
              <Button
                variant="secondary"
                size="sm"
                className="h-7"
                onClick={() => {
                  setExportError(null);
                  void exportAccount()
                    .then((data) => {
                      const blob = new Blob([JSON.stringify(data, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const anchor = document.createElement("a");
                      anchor.href = url;
                      anchor.download = "epure-account.json";
                      anchor.click();
                      URL.revokeObjectURL(url);
                    })
                    .catch(() => setExportError("Export failed."));
                }}
              >
                Export
              </Button>
            }
          />

          <SettingsRow
            title="Privacy"
            description="What this instance stores."
            action={
              <Button variant="secondary" size="sm" className="h-7" asChild>
                <Link to="/privacy">Open</Link>
              </Button>
            }
          />

          <SettingsRow
            title="Delete account"
            description="Permanent. Transfer ownership first if you're the only owner."
            danger
            action={
              <Button variant="danger" size="sm" className="h-7" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            }
          />
        </div>
      </SectionCard>

      <p className="text-2xs text-fg-muted">
        {isCloudDeployment() ? (
          <>
            Need help with SSO? Contact{" "}
            <a href="mailto:support@epure.sh" className="underline underline-offset-2">
              support@epure.sh
            </a>
            .
          </>
        ) : (
          <>
            Self-hosted instances do not send password-reset email. Ask a workspace owner.{" "}
            <Link to="/login" className="underline underline-offset-2">
              Sign in
            </Link>
          </>
        )}
      </p>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{profile.has_password ? "Change password" : "Set password"}</DialogTitle>
            <DialogDescription>
              {profile.has_password
                ? "Enter your current password and choose a new one."
                : "Choose a password for email sign-in."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void handlePasswordSubmit(event)}>
            {profile.has_password ? (
              <Field label="Current password" htmlFor="current-password" className="gap-1.5">
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="h-8 text-xs"
                />
              </Field>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="New password" htmlFor="new-password" className="gap-1.5">
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="Confirm" htmlFor="confirm-password" className="gap-1.5">
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-8 text-xs"
                />
              </Field>
            </div>
            {passwordError ? <p className="text-xs text-semantic-danger">{passwordError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPasswordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="secondary" size="sm" disabled={passwordBusy}>
                {profile.has_password ? "Update" : "Set"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>Type your email to confirm. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void handleDeleteAccount(event)}>
            <Field label="Confirm email" htmlFor="delete-email" className="gap-1.5">
              <Input
                id="delete-email"
                type="email"
                autoComplete="email"
                placeholder={profile.email}
                value={deleteEmail}
                onChange={(event) => setDeleteEmail(event.target.value)}
                className="h-8 text-xs"
              />
            </Field>
            {profile.has_password ? (
              <Field label="Password" htmlFor="delete-password" className="gap-1.5">
                <Input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  className="h-8 text-xs"
                />
              </Field>
            ) : null}
            {deleteError ? <p className="text-xs text-semantic-danger">{deleteError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" disabled={deleteBusy}>
                Delete
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsStack>
  );
}
