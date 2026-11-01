import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Key } from "@/components/ui/icon";
import { toast } from "@/components/ui/sonner";
import {
  fetchAgentTokens,
  revokeAgentToken,
  type AgentTokenRow,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format-time";
import { workspaceSettingsPath } from "@/lib/paths";
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

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this OAuth session? Agents using it will lose access.")) return;
    setBusyId(id);
    try {
      await revokeAgentToken(id);
      await load();
      toast.success("OAuth session revoked");
    } catch {
      toast.error("Revoke failed");
    } finally {
      setBusyId(null);
    }
  }

  if (userLoading || loading) {
    return (
      <SettingsPage>
        <SettingsPageHeader title="Agent tokens" description="Loading…" />
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
          title="Agent tokens"
          description="OAuth sessions for CLI and MCP."
        />
        <div className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-6 text-xs text-fg-muted">
          Member access only. Ask an admin or owner to manage OAuth sessions.
        </div>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage>
      <SettingsPageHeader
        title="Agent tokens"
        description="OAuth sessions created by epure login and MCP. Auth is OAuth only. Nothing to mint by hand."
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
            onClick={() => navigate(workspaceSettingsPath("connected-apps"))}
          >
            Connected apps
          </Button>
        }
      />

      <SettingsPanel
        title="Sessions"
        description="Revoke any OAuth session you no longer trust."
        flush
      >
        {tokens.length === 0 ? (
          <EmptyState
            layout="inset"
            tone="first-run"
            icon={Key}
            title="No OAuth sessions yet"
            description="Authorize with epure login or MCP when you're ready. Sessions appear here so you can revoke them anytime."
            hint="Auth is OAuth only. Nothing to mint by hand."
            actionLabel="Open connected apps"
            onAction={() => navigate(workspaceSettingsPath("connected-apps"))}
            actionVariant="secondary"
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
