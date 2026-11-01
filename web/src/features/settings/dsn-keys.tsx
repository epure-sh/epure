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
import { Badge } from "@/ui/primitives";
import { Button } from "@/ui/primitives";
import { ApiKeyField, useToast } from "@/ui/components";
import { Input } from "@/ui/primitives";
import { EmptyState } from "@/components/kit/empty-state";
import { SectionCard } from "@/components/kit/section-card";
import { Key } from "@/components/ui/icon";
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
  const [revokingId, setRevokingId] = useState<string | null>(null);
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
      toast("Key created. Copy it now");
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
      toast("Rotated. Update your SDK");
    } catch {
      toast("Rotate failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this key? SDKs using it will stop ingesting.")) return;
    setBusy(true);
    setRevokingId(id);
    try {
      await revokeDsnKey(id);
      const revokedAt = new Date().toISOString();
      setKeys((prev) =>
        prev.map((row) => (row.id === id ? { ...row, revoked_at: row.revoked_at ?? revokedAt } : row)),
      );
      if (revealed?.id === id) setRevealed(null);
      await loadKeys();
      toast("Revoked");
    } catch {
      toast("Revoke failed");
    } finally {
      setBusy(false);
      setRevokingId(null);
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
        description="Paste the DSN into your SDK. Rotate if a key leaks."
        contentClassName="w-full min-w-0"
        headerActions={
          <div className="flex items-center gap-1.5">
            <Input
              value={keyLabel}
              onChange={(event) => setKeyLabel(event.target.value)}
              placeholder="label"
              maxLength={64}
              className="h-7 w-28 text-2xs"
              aria-label="Key label"
            />
            <Button
              type="button"
              size="sm"
              className="h-7"
              disabled={busy}
              onClick={() => void handleCreate()}
            >
              Create
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7"
              disabled={busy}
              onClick={() => void handleRotate()}
            >
              Rotate
            </Button>
          </div>
        }
      >
        <div className="flex w-full min-w-0 flex-col gap-5">
          {revealed && dsnSegment ? (
            <div className="w-full min-w-0 space-y-3 rounded-md border border-warning/40 bg-warning/5 p-3">
              <p className="text-xs font-medium text-fg-primary">
                New key. Copy it now. The secret is shown once.
              </p>
              <ApiKeyField
                value={formatDsn(revealed.public_key, dsnSegment)}
                label="DSN"
                hint={null}
                masked={false}
                revealAllowed
              />
              <ApiKeyField
                value={revealed.secret_key}
                label="Secret"
                hint={null}
                masked={false}
                revealAllowed
              />
            </div>
          ) : activeDsn ? (
            <ApiKeyField value={activeDsn} label="DSN" hint={null} masked revealAllowed />
          ) : (
            <p className="text-xs text-fg-muted">No active key. Create one to connect an SDK.</p>
          )}

          <div className="w-full min-w-0 overflow-hidden rounded-md border border-border-subtle">
            <div className="border-b border-border-subtle bg-surface-1 px-3 py-2">
              <p className="text-xs font-medium text-fg-primary">Keys</p>
            </div>
            {loading ? (
              <p className="px-3 py-2.5 text-2xs text-fg-muted">Loading…</p>
            ) : keys.length === 0 ? (
              <EmptyState
                layout="inset"
                tone="first-run"
                icon={Key}
                title="No client keys yet"
                description="Create a key when you're ready to connect an SDK. The DSN appears once. Store it somewhere safe."
                hint="You can rotate or revoke keys anytime without losing issues."
              />
            ) : (
              <ul className="w-full divide-y divide-border-subtle">
                {keys.map((key) => {
                  const active = !key.revoked_at;
                  return (
                    <li
                      key={key.id}
                      className="flex w-full min-h-9 min-w-0 items-center justify-between gap-2 px-3 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={
                              active
                                ? "truncate text-xs font-medium text-fg-primary"
                                : "truncate text-xs font-medium text-fg-muted"
                            }
                          >
                            {key.label ?? "Untitled"}
                          </span>
                          <Badge variant={active ? "env" : "secondary"} size="compact">
                            {active ? "Active" : "Revoked"}
                          </Badge>
                        </div>
                        <p className="truncate text-2xs text-fg-muted">
                          {key.public_key.slice(0, 12)}… · {formatRelativeTime(key.created_at)}
                        </p>
                      </div>
                      {active ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 text-2xs text-semantic-danger"
                          disabled={busy}
                          onClick={() => void handleRevoke(key.id)}
                        >
                          {revokingId === key.id ? "…" : "Revoke"}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>
    </SettingsStack>
  );
}
