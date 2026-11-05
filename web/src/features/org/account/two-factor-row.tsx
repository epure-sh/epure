import { type FormEvent, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  beginTwoFactorSetup,
  disableTwoFactor,
  enableTwoFactor,
  fetchTwoFactorStatus,
  type TwoFactorStatus,
} from "@/lib/api";
import { isApiError } from "@/lib/api-error";
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
import { SettingsRow, StatusBadge } from "./settings-chrome";

type SetupStage =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "scan"; secret: string; uri: string; qr: string | null }
  | { kind: "codes"; codes: string[] };

/** Security tab row: TOTP two-factor status, enrollment and removal. */
export function TwoFactorRow({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [stage, setStage] = useState<SetupStage>({ kind: "closed" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadStatus() {
    try {
      setStatus(await fetchTwoFactorStatus());
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function startSetup() {
    setError(null);
    setCode("");
    setStage({ kind: "loading" });
    try {
      const setup = await beginTwoFactorSetup();
      const qr = await QRCode.toDataURL(setup.uri, { margin: 1, width: 176 }).catch(() => null);
      setStage({ kind: "scan", secret: setup.secret, uri: setup.uri, qr });
    } catch (err) {
      setStage({ kind: "closed" });
      setError(
        isApiError(err, 409)
          ? "Two-factor is already on. Turn it off first to enroll a new device."
          : "Could not start setup. Try again.",
      );
    }
  }

  async function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await enableTwoFactor(code.trim());
      setStage({ kind: "codes", codes: result.recovery_codes });
      setCode("");
      // Refresh only this row now: reloading the account settings would remount
      // the tab and drop the recovery codes before the user saved them.
      await loadStatus();
    } catch (err) {
      setError(
        isApiError(err, 400)
          ? "That code does not match. Check the time on your phone and enter the current code."
          : "Could not turn on two-factor. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await disableTwoFactor(code.trim());
      setDisableOpen(false);
      setCode("");
      await loadStatus();
      onChanged();
    } catch (err) {
      setError(
        isApiError(err, 400)
          ? "That code is not valid. Enter a current code or a recovery code."
          : "Could not turn off two-factor. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function closeSetup() {
    const finishedEnrollment = stage.kind === "codes";
    setStage({ kind: "closed" });
    setError(null);
    if (finishedEnrollment) onChanged();
  }

  async function copyCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const enabled = status?.enabled === true;
  const description = statusError
    ? "Could not load two-factor status."
    : enabled
      ? `Authenticator app required at sign-in · ${status?.recovery_codes_left ?? 0} recovery codes left.`
      : "Require a code from an authenticator app at sign-in.";

  return (
    <>
      <SettingsRow
        title="Two-factor authentication"
        description={error && stage.kind === "closed" && !disableOpen ? error : description}
        badge={<StatusBadge on={enabled} />}
        action={
          enabled ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                setCode("");
                setDisableOpen(true);
              }}
            >
              Turn off
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={status === null && !statusError}
              loading={stage.kind === "loading"}
              onClick={() => void startSetup()}
            >
              Set up
            </Button>
          )
        }
      />

      <Dialog
        open={stage.kind === "scan" || stage.kind === "codes"}
        onOpenChange={(open) => {
          if (!open) closeSetup();
        }}
      >
        <DialogContent>
          {stage.kind === "scan" ? (
            <>
              <DialogHeader>
                <DialogTitle>Set up two-factor authentication</DialogTitle>
                <DialogDescription>
                  Scan the code with an authenticator app (1Password, Google Authenticator, Authy), then
                  enter the 6-digit code it shows.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-3" onSubmit={(event) => void handleEnable(event)}>
                <div className="flex flex-wrap items-start gap-4">
                  {stage.qr ? (
                    <img
                      src={stage.qr}
                      alt="QR code for your authenticator app"
                      width={176}
                      height={176}
                      className="rounded-md border border-border-subtle"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-2xs font-medium text-fg-muted">Or enter this key manually</p>
                    <p className="break-all rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5 font-mono text-xs tabular-nums text-fg-primary select-all">
                      {stage.secret.replace(/(.{4})/g, "$1 ").trim()}
                    </p>
                    <Button type="button" variant="link" size="xs" asChild>
                      <a href={stage.uri}>Open in authenticator app</a>
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="two-factor-code" className="text-2xs font-medium text-fg-muted">
                    Code from your app
                  </label>
                  <Input
                    id="two-factor-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className="h-8 font-mono text-xs tabular-nums tracking-widest"
                  />
                </div>
                {error ? <p className="text-xs text-semantic-danger">{error}</p> : null}
                <DialogFooter>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setStage({ kind: "closed" })}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" disabled={busy || code.trim().length < 6} loading={busy}>
                    Turn on
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : stage.kind === "codes" ? (
            <>
              <DialogHeader>
                <DialogTitle>Save your recovery codes</DialogTitle>
                <DialogDescription>
                  Each code signs you in once if you lose your device. They are shown only now.
                </DialogDescription>
              </DialogHeader>
              <ul className="grid grid-cols-2 gap-1.5 rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs tabular-nums text-fg-primary">
                {stage.codes.map((recovery) => (
                  <li key={recovery}>{recovery}</li>
                ))}
              </ul>
              <DialogFooter>
                <Button type="button" variant="secondary" size="sm" onClick={() => void copyCodes(stage.codes)}>
                  {copied ? "Copied" : "Copy codes"}
                </Button>
                <Button type="button" variant="primary" size="sm" onClick={closeSetup}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn off two-factor authentication</DialogTitle>
            <DialogDescription>
              Enter a current code from your app, or a recovery code. Sign-in will need only your password.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void handleDisable(event)}>
            <div className="space-y-1.5">
              <label htmlFor="two-factor-disable-code" className="text-2xs font-medium text-fg-muted">
                Code
              </label>
              <Input
                id="two-factor-disable-code"
                autoComplete="one-time-code"
                maxLength={20}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="h-8 font-mono text-xs tabular-nums tracking-widest"
              />
            </div>
            {error ? <p className="text-xs text-semantic-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDisableOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" disabled={busy || !code.trim()} loading={busy}>
                Turn off
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
