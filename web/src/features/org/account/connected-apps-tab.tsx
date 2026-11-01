import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Icon, Laptop, Robot, Terminal } from "@/components/ui/icon";
import { toast } from "@/components/ui/sonner";
import {
  fetchConnectedApps,
  revokeConnectedApp,
  type ConnectedAppRow,
} from "@/lib/api";
import { copyText } from "@/lib/copy-text";
import { isCloudDeployment } from "@/lib/deployment";
import { formatRelativeTime } from "@/lib/format-time";
import {
  SettingsPage,
  SettingsPageHeader,
  SettingsPanel,
  SettingsSkeletonRows,
  StatusBadge,
} from "./settings-chrome";

function clientIcon(clientId: string) {
  const id = clientId.toLowerCase();
  if (id.includes("cli")) return Terminal;
  if (
    id.includes("mcp") ||
    id.includes("agent") ||
    id.includes("cursor") ||
    id.includes("claude")
  ) {
    return Robot;
  }
  return Laptop;
}

export function ConnectedAppsTab() {
  const [apps, setApps] = useState<ConnectedAppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const mcpUrl = `${window.location.origin}/mcp`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [appList, authConfig] = await Promise.all([
        fetchConnectedApps(),
        fetch("/api/v1/auth/config", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setApps(appList);
      if (authConfig && typeof authConfig.mcp_enabled === "boolean") {
        setMcpEnabled(authConfig.mcp_enabled);
      }
    } catch {
      toast.error("Failed to load connected apps");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRevoke(id: string, name: string) {
    setRevokingId(id);
    try {
      await revokeConnectedApp(id);
      setApps((prev) => prev.filter((app) => app.id !== id));
      toast.success(`Revoked ${name}`);
    } catch {
      toast.error("Revoke failed");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopyMcp() {
    const ok = await copyText(mcpUrl);
    if (ok) toast.success("MCP URL copied");
    else toast.error("Could not copy");
  }

  const mcpActive = mcpEnabled || isCloudDeployment();

  return (
    <SettingsPage>
      <SettingsPageHeader
        title="Connected apps"
        description="MCP endpoint and OAuth sessions from CLI and editors."
        badge={
          !loading ? (
            <Badge variant="neutral" size="compact">
              {apps.length} session{apps.length === 1 ? "" : "s"}
            </Badge>
          ) : null
        }
      />

      <SettingsPanel
        title="MCP"
        description="Cursor / Claude Code endpoint for this instance."
        actions={<StatusBadge on={mcpActive} />}
      >
        {mcpActive ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border-subtle bg-surface-2/50 px-2.5 py-1.5 font-mono text-2xs text-fg-primary">
              {mcpUrl}
            </code>
            <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopyMcp()}>
              <Icon icon={Copy} size={14} />
              Copy
            </Button>
          </div>
        ) : (
          <p className="text-xs text-fg-muted">
            Set <span className="font-mono text-fg-primary">EPURE_MCP_ENABLED=true</span> on the
            host to enable.
          </p>
        )}
      </SettingsPanel>

      <SettingsPanel
        title="Sessions"
        description="Authorized CLI and app connections."
        flush
      >
        {loading ? (
          <SettingsSkeletonRows count={2} />
        ) : apps.length === 0 ? (
          <EmptyState
            layout="inset"
            tone="first-run"
            icon={Laptop}
            title="No connected apps yet"
            description="When you run epure login or connect an editor, the OAuth session shows up here."
            hint="You can revoke any session the moment you stop trusting it."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {apps.map((app) => {
              const glyph = clientIcon(app.client_id);
              return (
                <li
                  key={app.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-muted">
                      <Icon icon={glyph} size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs font-medium text-fg-primary">
                          {app.client_name || app.client_id}
                        </p>
                        {app.scopes.slice(0, 2).map((scope) => (
                          <Badge key={scope} variant="neutral" size="compact">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-0.5 truncate text-2xs text-fg-muted">
                        {formatRelativeTime(app.created_at)}
                        {app.last_used_at
                          ? ` · active ${formatRelativeTime(app.last_used_at)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    disabled={revokingId === app.id}
                    onClick={() => void handleRevoke(app.id, app.client_name || app.client_id)}
                  >
                    {revokingId === app.id ? "…" : "Revoke"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsPanel>
    </SettingsPage>
  );
}
