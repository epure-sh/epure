import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { projectSettingsPath } from "../../lib/paths";
import {
  createDsnKey,
  fetchDsnKeys,
  formatDsn,
  revokeDsnKey,
  rotateDsnKeys,
  type CreatedDsnKey,
  type DsnKeyRow,
} from "../../lib/api";
import { formatRelativeTime } from "../../lib/format-time";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { CopyButton } from "../../ui/copy-button";
import { CopyDsnBlock } from "../../ui/copy-dsn-block";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { SdkSnippetBlock } from "../../ui/sdk-snippet-block";
import { useToast } from "../../ui/toast-provider";
import { InfoCallout, MemberAccessNotice, SettingsTabHeader } from "./shared";

export function DsnKeysSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { user } = useAppContext();
  const [keys, setKeys] = useState<DsnKeyRow[]>([]);
  const [revealed, setRevealed] = useState<CreatedDsnKey | null>(null);
  const [keyLabel, setKeyLabel] = useState("default");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const activeProjectId = paramId ?? null;
  const canManage = user?.role === "owner" || user?.role === "admin";

  const activeKeys = keys.filter((key) => !key.revoked_at);
  const activeKey = activeKeys[0] ?? null;

  const loadKeys = useCallback(async () => {
    if (!activeProjectId || !canManage) {
      setKeys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchDsnKeys(activeProjectId);
      setKeys(rows);
    } catch {
      toast("Failed to load DSN keys");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, canManage, toast]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate() {
    if (!activeProjectId) {
      return;
    }
    setBusy(true);
    try {
      const created = await createDsnKey(activeProjectId, keyLabel.trim() || "default");
      setRevealed(created);
      await loadKeys();
      toast("DSN key created — copy it now");
    } catch {
      toast("Failed to create DSN key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRotate() {
    if (!activeProjectId) {
      return;
    }
    if (
      activeKeys.length > 0 &&
      !window.confirm(
        "Rotate keys? Active keys will be revoked and your SDK must be updated with the new DSN.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const created = await rotateDsnKeys(activeProjectId, keyLabel.trim() || "rotated");
      setRevealed(created);
      await loadKeys();
      toast("Rotated DSN — update your SDK");
    } catch {
      toast("Failed to rotate DSN keys");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this key? SDKs using it will stop sending events.")) {
      return;
    }
    setBusy(true);
    try {
      await revokeDsnKey(id);
      if (revealed?.id === id) {
        setRevealed(null);
      }
      await loadKeys();
      toast("DSN key revoked");
    } catch {
      toast("Failed to revoke DSN key");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return <MemberAccessNotice resource="DSN keys" />;
  }

  if (!activeProjectId) {
    return (
      <div className="space-y-4">
        <SettingsTabHeader title="SDK connection" description="DSN keys for SDK ingest." />
        <InfoCallout variant="warning">Select a project to manage connection strings.</InfoCallout>
      </div>
    );
  }

  const activeDsn = activeKey
    ? formatDsn(activeKey.public_key, activeProjectId)
    : revealed
      ? formatDsn(revealed.public_key, revealed.project_id)
      : null;

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title="SDK connection"
        description="Inbound credentials for your SDK. Submit events only — separate from notification webhooks."
      />

      <InfoCallout>
        <strong className="font-medium text-ink">Inbound only.</strong> DSN keys let the SDK send
        errors to Epure. They cannot read issues, trigger alerts, or call outbound webhooks. To
        notify Slack or Discord, use{" "}
        <Link
          to={projectSettingsPath(activeProjectId, "webhooks")}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Notifications
        </Link>
        .
      </InfoCallout>

      {revealed ? (
        <Card className="border-accent/30 bg-bg-subtle">
          <CardHeader>
            <CardTitle>New key created</CardTitle>
            <CardDescription>
              Copy the DSN and secret now. The secret is shown once at creation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CopyDsnBlock
              dsn={formatDsn(revealed.public_key, revealed.project_id)}
              label="Connection string (DSN)"
              hint="Paste into your SDK init. Safe to embed in client apps."
            />
            <div className="epure-code-well rounded-md border border-border bg-bg-subtle p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-ink-muted">Secret key (server-side only)</p>
                <CopyButton value={revealed.secret_key} label="Copy secret" />
              </div>
              <p className="mt-2 break-all font-mono text-xs text-ink">{revealed.secret_key}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeDsn && !revealed ? (
        <Card>
          <CardHeader>
            <CardTitle>Active connection string</CardTitle>
            <CardDescription>Use this DSN in your SDK if you did not save it during setup.</CardDescription>
          </CardHeader>
          <CardContent>
            <CopyDsnBlock dsn={activeDsn} hint="One string — copy and paste into your SDK configuration." />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Manage keys</CardTitle>
          <CardDescription>Create, rotate, or revoke DSN credentials.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Key label"
            htmlFor="dsn-label"
            hint="Optional label to distinguish keys (e.g. production, ci)."
          >
            <Input
              id="dsn-label"
              value={keyLabel}
              onChange={(event) => setKeyLabel(event.target.value)}
              placeholder="default"
              maxLength={64}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void handleCreate()}>
              Create key
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void handleRotate()}>
              Rotate keys
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Rotating revokes all active keys and issues a new pair. Plan a deploy window before
            rotating production keys.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key inventory</CardTitle>
          <CardDescription>All keys for this project, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          {loading ? (
            <p className="px-4 pb-4 text-sm text-ink-muted">Loading keys…</p>
          ) : keys.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-muted">
              No DSN keys yet. Create one to connect your SDK.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {keys.map((key) => (
                <li
                  key={key.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-mono text-sm text-ink">{key.public_key}</p>
                      <Badge variant={key.revoked_at ? "secondary" : "env"}>
                        {key.revoked_at ? "Revoked" : "Active"}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {key.label ?? "unlabeled"} · created {formatRelativeTime(key.created_at)}
                      {key.revoked_at
                        ? ` · revoked ${formatRelativeTime(key.revoked_at)}`
                        : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!key.revoked_at ? (
                      <>
                        <CopyButton
                          value={formatDsn(key.public_key, activeProjectId)}
                          label="Copy DSN"
                        />
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() => void handleRevoke(key.id)}
                        >
                          Revoke
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {activeDsn ? (
        <Card>
          <CardHeader>
            <CardTitle>SDK setup</CardTitle>
            <CardDescription>Quick start with the official Sentry SDK.</CardDescription>
          </CardHeader>
          <CardContent>
            <SdkSnippetBlock dsn={activeDsn} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
