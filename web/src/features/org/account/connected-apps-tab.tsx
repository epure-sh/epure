import { useCallback, useEffect, useState } from "react";
import {
  fetchConnectedApps,
  revokeConnectedApp,
  type ConnectedAppRow,
} from "../../../lib/api";
import { formatRelativeTime } from "../../../lib/format-time";
import { isCloudDeployment } from "../../../lib/deployment";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { useToast } from "../../../ui/toast-provider";
import { Bot, Laptop, Terminal } from "lucide-react";
import { SectionCard } from "@/components/kit/section-card";
import { SettingsSkeleton, SettingsStack } from "../../settings/shared";

function getClientIcon(clientId: string) {
  const id = clientId.toLowerCase();
  if (id.includes("cli")) return Terminal;
  if (id.includes("mcp") || id.includes("agent") || id.includes("cursor") || id.includes("claude")) {
    return Bot;
  }
  return Laptop;
}

export function ConnectedAppsTab() {
  const { toast } = useToast();
  const [apps, setApps] = useState<ConnectedAppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [mcpEnabled, setMcpEnabled] = useState(false);

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
      toast("Failed to load connected apps");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRevoke(id: string, name: string) {
    setRevokingId(id);
    try {
      await revokeConnectedApp(id);
      setApps((prev) => prev.filter((a) => a.id !== id));
      toast(`Revoked ${name}`);
    } catch {
      toast("Revoke failed");
    } finally {
      setRevokingId(null);
    }
  }

  const mcpActive = mcpEnabled || isCloudDeployment();

  return (
    <SettingsStack>
      <SectionCard
        title="MCP"
        description="Cursor / Claude Code endpoint."
        headerActions={
          <Badge variant={mcpActive ? "env" : "secondary"} size="compact">
            {mcpActive ? "On" : "Off"}
          </Badge>
        }
      >
        {mcpActive ? (
          <code className="block w-full truncate rounded-md border border-border-subtle bg-surface-2/50 px-2.5 py-1.5 font-mono text-2xs text-fg-primary">
            {window.location.origin}/mcp
          </code>
        ) : (
          <p className="text-xs text-fg-muted">
            Set <span className="font-mono text-fg-primary">EPURE_MCP_ENABLED=true</span> to enable.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Sessions" description="OAuth CLI and app authorizations." flush>
        {loading ? (
          <SettingsSkeleton />
        ) : apps.length === 0 ? (
          <p className="px-3 py-3 text-xs text-fg-muted">
            None yet. Run <span className="font-mono">epure login</span> in a terminal.
          </p>
        ) : (
          <ul className="w-full divide-y divide-border-subtle">
            {apps.map((app) => {
              const Icon = getClientIcon(app.client_id);
              return (
                <li
                  key={app.id}
                  className="flex w-full min-h-10 items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Icon size={13} className="shrink-0 text-fg-muted" strokeWidth={1.8} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-fg-primary">
                          {app.client_name || app.client_id}
                        </span>
                        {app.scopes.slice(0, 2).map((scope) => (
                          <Badge key={scope} variant="secondary" size="compact">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      <p className="truncate text-2xs text-fg-muted">
                        {formatRelativeTime(app.created_at)}
                        {app.last_used_at ? ` · active ${formatRelativeTime(app.last_used_at)}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-2xs text-semantic-danger"
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
      </SectionCard>
    </SettingsStack>
  );
}
