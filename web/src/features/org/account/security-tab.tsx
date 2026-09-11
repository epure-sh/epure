import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import type { AccountSettingsContext } from "./use-account-settings";
import { isGoogleSignInVisible } from "../../../lib/deployment";
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
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
        danger && "border-t border-semantic-danger/20 bg-semantic-danger/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm font-medium", danger ? "text-semantic-danger" : "text-ink")}>
            {title}
          </p>
          {badge}
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function SecurityTab({ settings }: { settings: AccountSettingsContext }) {
  const { profile, authConfig, logout, savePassword, removeAccount } = settings;
  const googleEnabled = isGoogleSignInVisible(authConfig?.google_enabled);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      setPasswordError(
        error instanceof Error ? error.message : "Could not update password.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteError(null);
    if (!profile) {
      return;
    }

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
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-surface divide-y divide-border">
        <SettingsRow
          title="Password"
          description={
            profile?.has_password
              ? "Email and password sign-in is enabled."
              : googleEnabled
                ? "No password set — use Google or set one."
                : "No password set — set one to sign in with email."
          }
          badge={
            <Badge variant="env" size="compact">
              {profile?.has_password ? "Active" : "Not set"}
            </Badge>
          }
          action={
            <Button variant="secondary" size="sm" onClick={() => setPasswordOpen(true)}>
              {profile?.has_password ? "Change" : "Set password"}
            </Button>
          }
        />

        {googleEnabled ? (
          <SettingsRow
            title="Google"
            description={
              profile?.google_linked
                ? "Linked for one-click sign-in."
                : "Connect Google for faster sign-in."
            }
            badge={
              <Badge variant="env" size="compact">
                {profile?.google_linked ? "Connected" : "Not connected"}
              </Badge>
            }
            action={
              profile?.google_linked ? (
                <span className="text-xs text-ink-muted">—</span>
              ) : (
                <Button variant="secondary" size="sm" asChild>
                  <a href="/api/v1/auth/google">Connect</a>
                </Button>
              )
            }
          />
        ) : null}

        <SettingsRow
          title="Session"
          description="Signed in on this browser."
          action={
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              Log out
            </Button>
          }
        />

        <SettingsRow
          title="Delete account"
          description="Permanently remove your account. Transfer ownership first if you're the only owner."
          danger
          action={
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          }
        />
      </div>

      <p className="px-1 text-xs text-ink-muted">
        Self-hosted instances do not send password-reset emails. Ask your workspace owner for help.{" "}
        <Link to="/login" className="text-ink underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {profile?.has_password ? "Change password" : "Set password"}
            </DialogTitle>
            <DialogDescription>
              {profile?.has_password
                ? "Enter your current password and choose a new one."
                : "Choose a password for email sign-in."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void handlePasswordSubmit(event)}>
            {profile?.has_password ? (
              <Field label="Current password" htmlFor="current-password">
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </Field>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New password" htmlFor="new-password">
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>
              <Field label="Confirm" htmlFor="confirm-password">
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
            </div>
            {passwordError ? (
              <p className="text-xs text-semantic-danger">{passwordError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPasswordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="secondary" disabled={passwordBusy}>
                {profile?.has_password ? "Update" : "Set password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Type your email to confirm. This permanently deletes your account.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void handleDeleteAccount(event)}>
            <Field label="Confirm email" htmlFor="delete-email">
              <Input
                id="delete-email"
                type="email"
                autoComplete="email"
                placeholder={profile?.email ?? "you@example.com"}
                value={deleteEmail}
                onChange={(event) => setDeleteEmail(event.target.value)}
              />
            </Field>
            {profile?.has_password ? (
              <Field label="Password" htmlFor="delete-password">
                <Input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                />
              </Field>
            ) : null}
            {deleteError ? <p className="text-xs text-semantic-danger">{deleteError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={deleteBusy}>
                Delete permanently
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
