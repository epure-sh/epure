import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Key } from "@/components/ui/icon";
import { toast } from "@/components/ui/sonner";
import {
  createAgentToken,
  fetchAgentTokens,
  revokeAgentToken,
  type AgentTokenRow,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format-time";
import { userSettingsPath } from "@/lib/paths";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { Input } from "@/components/ui/input";
import { copyText } from "@/lib/copy-text";
import { useAppContext } from "@/shell/app-context";
import {
  SettingsPage,
  SettingsPageHeader,
  SettingsPanel,
  SettingsSkeletonRows,
} from "./settings-chrome";

export function AgentTokensTab() {
  const navigate = useNavigate();
  const { user, userLoading } = useAppContext();
  const [tokens, setTokens] = useState<AgentTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  const canManage = user?.role === "owner" || user?.role === "admin";
  const activeCount = tokens.filter((row) => !row.revoked_at).length;

  const load = useCallback(async () => {
    if (userLoading) return;
    if (!canManage) {
      setTokens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTokens(await fetchAgentTokens());
    } catch {
      toast.error("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, [userLoading, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!label.trim() || creating) return;
    setCreating(true);
    try {
      const token = await createAgentToken({ label: label.trim(), scopes: ["write:sourcemaps"] });
      setNewToken(token.token);
      setLabel("");
      await load();
    } catch {
      toast.error("Could not create a workspace token.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this workspace token? Jobs using it will lose access.")) return;
    setBusyId(id);
    try {
      await revokeAgentToken(id);
      await load();
      toast.success("Workspace token revoked");
    } catch {
      toast.error("Revoke failed");
    } finally {
      setBusyId(null);
    }
  }

  if (userLoading || loading) {
    return (
      <SettingsPage>
        <SettingsPageHeader title="Workspace tokens" description="Loading…" />
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
          <SettingsSkeletonRows count={3} />
        </div>
      </SettingsPage>
    );
  }

  if (!canManage) {
    return (
      <SettingsPage>
        <SettingsPageHeader
          title="Workspace tokens"
          description="Credentials for workspace automation and source map uploads."
        />
        <div className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-6 text-xs text-fg-muted">
          Workspace admins and owners can manage these tokens.
        </div>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage>
      <SettingsPageHeader
        title="Workspace tokens"
        description="Use a workspace token for automation such as Sentry CLI source map uploads. Manage personal MCP connections in your account."
        badge={
          !loading ? (
            <Badge variant="neutral" size="compact">
              {activeCount} active
            </Badge>
          ) : null
        }
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(userSettingsPath("connected-apps"))}
          >
            Connected apps
          </Button>
        }
      />

      <SettingsPanel title="Create an automation token"
        description="This token can upload source maps to this workspace. Store it as a secret and use it as SENTRY_AUTH_TOKEN for Sentry CLI uploads.">
        <Box as="form" flexDirection="column" gap="s" onSubmit={(event) => void handleCreate(event)}>
          <Input aria-label="Token name" placeholder="Source map uploads" value={label} maxLength={64}
            onChange={(event) => setLabel(event.target.value)} />
          <Box>
            <Button type="submit" disabled={creating || !label.trim() || newToken !== null}>Create token</Button>
          </Box>
        </Box>
        {newToken ? (
          <Box flexDirection="column" gap="s" paddingTop="m">
            <Text variant="body">Copy this token now. Epure only shows it once.</Text>
            <Input aria-label="New workspace token" value={newToken} readOnly />
            <Box gap="s">
              <Button onClick={() => void copyText(newToken).then((copied) => {
                if (copied) toast.success("Token copied");
              })}>Copy token</Button>
              <Button variant="ghost" onClick={() => setNewToken(null)}>Done</Button>
            </Box>
          </Box>
        ) : null}
      </SettingsPanel>

      <SettingsPanel
        title="Tokens"
        description="Revoke any workspace token you no longer use."
        flush
      >
        {tokens.length === 0 ? (
          <EmptyState
            layout="inset"
            tone="first-run"
            icon={Key}
            title="No workspace tokens"
            description="Create a token above when you need to authenticate an automation job."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {tokens.map((row) => {
              const active = !row.revoked_at;
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-medium text-fg-primary">{row.label}</p>
                      <Badge variant={active ? "healthy" : "neutral"} size="compact">
                        {active ? "Active" : "Revoked"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-2xs text-fg-muted">
                      {row.token_prefix}…
                      {row.scopes.length > 0 ? ` · ${row.scopes.join(", ")}` : ""}
                      {row.last_used_at ? ` · ${formatRelativeTime(row.last_used_at)}` : ""}
                    </p>
                  </div>
                  {active ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      disabled={busyId === row.id}
                      onClick={() => void handleRevoke(row.id)}
                    >
                      {busyId === row.id ? "…" : "Revoke"}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsPanel>
    </SettingsPage>
  );
}
