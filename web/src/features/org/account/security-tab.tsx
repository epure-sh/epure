import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { exportAccount } from "@/lib/api";
import { isCloudDeployment, isGoogleSignInVisible } from "@/lib/deployment";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AccountSettingsContext } from "./use-account-settings";
import {
  SettingsPage,
  SettingsPageHeader,
  SettingsPanel,
  SettingsRow,
  SettingsSkeletonRows,
  StatusBadge,
} from "./settings-chrome";

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
      <SettingsPage>
        <SettingsPageHeader title="Security" description="Loading…" />
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
          <SettingsSkeletonRows count={4} />
        </div>
      </SettingsPage>
    );
  }

  if (!profile) {
    return (
      <SettingsPage>
        <SettingsPageHeader title="Security" description="Could not load account." />
        <Button type="button" variant="secondary" size="sm" onClick={() => void settings.load()}>
          Retry
        </Button>
      </SettingsPage>
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
    <SettingsPage>
      <SettingsPageHeader
        title="Security"
        description="Sign-in methods, this browser session, and account data."
      />

      <SettingsPanel flush>
        <div className="divide-y divide-border-subtle">
          {passwordAuthEnabled ? (
            <SettingsRow
              title="Password"
              description={
                profile.has_password
                  ? "Email and password sign-in enabled."
                  : "No password set for email sign-in."
              }
              badge={<StatusBadge on={profile.has_password} />}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPasswordOpen(true)}
                >
                  {profile.has_password ? "Change" : "Set"}
                </Button>
              }
            />
          ) : null}

          {googleEnabled ? (
            <SettingsRow
              title="Google"
              description={profile.google_linked ? "Linked to this account." : "Not connected."}
              badge={<StatusBadge on={Boolean(profile.google_linked)} />}
              action={
                profile.google_linked ? (
                  <span className="text-2xs text-fg-muted">-</span>
                ) : (
                  <Button type="button" variant="secondary" size="sm" asChild>
                    <a href="/api/v1/auth/google">Connect</a>
                  </Button>
                )
              }
            />
          ) : null}

          {githubEnabled ? (
            <SettingsRow
              title="GitHub"
              description={profile.github_linked ? "Linked to this account." : "Not connected."}
              badge={<StatusBadge on={Boolean(profile.github_linked)} />}
              action={
                profile.github_linked ? (
                  <span className="text-2xs text-fg-muted">-</span>
                ) : (
                  <Button type="button" variant="secondary" size="sm" asChild>
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
              <Button type="button" variant="secondary" size="sm" onClick={() => void logout()}>
                Log out
              </Button>
            }
          />

          <SettingsRow
            title="Export data"
            description={exportError ?? "Download profile and memberships as JSON. No secrets."}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
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
            description="What this instance stores about you and your events."
            action={
              <Button type="button" variant="secondary" size="sm" asChild>
                <Link to="/privacy">Open</Link>
              </Button>
            }
          />
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Danger zone"
        description="Permanent. Transfer ownership first if you are the only owner."
        danger
        flush
      >
        <SettingsRow
          title="Delete account"
          description="Removes your user and memberships. Cannot be undone."
          danger
          action={
            <Button type="button" variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          }
        />
      </SettingsPanel>

      <p className="text-2xs text-fg-muted">
        {isCloudDeployment() ? (
          <>
            Need SSO help?{" "}
            <a href="mailto:support@epure.sh" className="underline underline-offset-2">
              support@epure.sh
            </a>
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
                ? "Enter your current password and choose a new one (12+ characters)."
                : "Choose a password for email sign-in (12+ characters)."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void handlePasswordSubmit(event)}>
            {profile.has_password ? (
              <div className="space-y-1.5">
                <label htmlFor="current-password" className="text-2xs font-medium text-fg-muted">
                  Current password
                </label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="new-password" className="text-2xs font-medium text-fg-muted">
                  New password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="text-2xs font-medium text-fg-muted">
                  Confirm
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            {passwordError ? <p className="text-xs text-semantic-danger">{passwordError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPasswordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={passwordBusy}>
                {profile.has_password ? "Update" : "Set"}
              </Button>
            </DialogFooter>
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
            <div className="space-y-1.5">
              <label htmlFor="delete-email" className="text-2xs font-medium text-fg-muted">
                Confirm email
              </label>
              <Input
                id="delete-email"
                type="email"
                autoComplete="email"
                placeholder={profile.email}
                value={deleteEmail}
                onChange={(event) => setDeleteEmail(event.target.value)}
                className="h-8 text-xs"
              />
            </div>
            {profile.has_password ? (
              <div className="space-y-1.5">
                <label htmlFor="delete-password" className="text-2xs font-medium text-fg-muted">
                  Password
                </label>
                <Input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            ) : null}
            {deleteError ? <p className="text-xs text-semantic-danger">{deleteError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" disabled={deleteBusy}>
                Delete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
