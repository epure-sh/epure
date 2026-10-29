import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  createDsnKey,
  fetchDsnKeys,
  dsnPathSegment,
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
import { CopyButton } from "../../ui/copy-button";
import { CopyDsnBlock } from "../../ui/copy-dsn-block";
import { Input } from "../../ui/input";
import { useToast } from "../../ui/toast-provider";
import { SectionCard } from "@/components/kit/section-card";
import {
  InfoCallout,
  MemberAccessNotice,
  SettingsSkeleton,
  SettingsStack,
} from "./shared";

export function DsnKeysSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { projects, projectsLoading, user, userLoading } = useAppContext();
  const [keys, setKeys] = useState<DsnKeyRow[]>([]);
  const [revealed, setRevealed] = useState<CreatedDsnKey | null>(null);
  const [keyLabel, setKeyLabel] = useState("default");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const safeProjects = Array.isArray(projects) ? projects : [];
  const project = safeProjects.find((p) => p && (p.id === paramId || p.slug === paramId)) ?? null;
  const activeProjectId = project?.id ?? paramId ?? null;
  const canManage = user?.role === "owner" || user?.role === "admin";

  const activeKeys = keys.filter((key) => !key.revoked_at);
  const activeKey = activeKeys[0] ?? null;

  const loadKeys = useCallback(async () => {
    if (projectsLoading || userLoading) return;
    if (!activeProjectId || !canManage) {
      setKeys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setKeys(await fetchDsnKeys(activeProjectId));
    } catch {
      toast("Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, [projectsLoading, userLoading, activeProjectId, canManage, toast]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate() {
    if (!activeProjectId) return;
    setBusy(true);
    try {
      const created = await createDsnKey(activeProjectId, keyLabel.trim() || "default");
      setRevealed(created);
      await loadKeys();
      toast("Key created — copy now");
    } catch {
      toast("Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRotate() {
    if (!activeProjectId) return;
    if (
      activeKeys.length > 0 &&
      !window.confirm("Rotate? Active keys are revoked; update your SDK DSN.")
    ) {
      return;
    }
    setBusy(true);
    try {
      const created = await rotateDsnKeys(activeProjectId, keyLabel.trim() || "rotated");
      setRevealed(created);
      await loadKeys();
      toast("Rotated — update SDK");
    } catch {
      toast("Rotate failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this key?")) return;
    setBusy(true);
    try {
      await revokeDsnKey(id);
      if (revealed?.id === id) setRevealed(null);
      await loadKeys();
      toast("Revoked");
    } catch {
      toast("Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  if (projectsLoading || userLoading) {
    return (
      <SettingsStack>
        <SettingsSkeleton />
      </SettingsStack>
    );
  }

  if (!activeProjectId) {
    return (
      <SettingsStack>
        <InfoCallout variant="warning">Select a project.</InfoCallout>
      </SettingsStack>
    );
  }

  if (!canManage) {
    return (
      <SettingsStack>
        <MemberAccessNotice resource="client keys" />
      </SettingsStack>
    );
  }

  const dsnSegment = project ? dsnPathSegment(project) : null;
  const activeDsn =
    activeKey && dsnSegment
      ? formatDsn(activeKey.public_key, dsnSegment)
      : revealed && dsnSegment
        ? formatDsn(revealed.public_key, dsnSegment)
        : null;

  return (
    <SettingsStack>
      <SectionCard
        title="Client keys"
        description="DSN for SDK ingest. Inbound only."
        headerActions={
          <div className="flex items-center gap-1.5">
            <Input
              value={keyLabel}
              onChange={(event) => setKeyLabel(event.target.value)}
              placeholder="label"
              maxLength={64}
              className="h-7 w-24 text-2xs"
              aria-label="Key label"
            />
            <Button size="sm" disabled={busy} onClick={() => void handleCreate()}>
              Create
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleRotate()}>
              Rotate
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {revealed && dsnSegment ? (
            <div className="space-y-2 rounded-md border border-border-subtle bg-surface-2/50 p-2.5">
              <p className="text-2xs font-medium text-fg-primary">
                New key — secret shown once
              </p>
              <CopyDsnBlock
                compact
                dsn={formatDsn(revealed.public_key, dsnSegment)}
                label="DSN"
                hint={null}
              />
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={revealed.secret_key}
                  className="h-8 min-w-0 flex-1 font-mono text-2xs"
                  aria-label="Secret key"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <CopyButton value={revealed.secret_key} label="Secret" />
              </div>
            </div>
          ) : activeDsn ? (
            <CopyDsnBlock compact dsn={activeDsn} label="Active DSN" hint={null} />
          ) : (
            <p className="text-xs text-fg-muted">No active key. Create one to connect an SDK.</p>
          )}

          <div className="w-full overflow-hidden rounded-md border border-border-subtle">
            {loading ? (
              <p className="px-3 py-2 text-2xs text-fg-muted">Loading…</p>
            ) : keys.length === 0 ? (
              <p className="px-3 py-2 text-2xs text-fg-muted">No keys yet.</p>
            ) : (
              <ul className="w-full divide-y divide-border-subtle">
                {keys.map((key) => (
                  <li
                    key={key.id}
                    className="flex w-full min-h-9 items-center justify-between gap-2 px-2.5 py-1.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate font-mono text-2xs text-fg-primary">
                        {key.public_key.slice(0, 12)}…
                      </span>
                      <Badge
                        variant={key.revoked_at ? "secondary" : "env"}
                        size="compact"
                        className="shrink-0"
                      >
                        {key.revoked_at ? "Revoked" : "Active"}
                      </Badge>
                      <span className="truncate text-2xs text-fg-muted">
                        {key.label ?? "—"} · {formatRelativeTime(key.created_at)}
                      </span>
                    </div>
                    {!key.revoked_at ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <CopyButton
                          value={dsnSegment ? formatDsn(key.public_key, dsnSegment) : ""}
                          label="DSN"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-2xs text-semantic-danger"
                          disabled={busy}
                          onClick={() => void handleRevoke(key.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>
    </SettingsStack>
  );
}
