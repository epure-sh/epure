import { useCallback, useEffect, useState } from "react";
import {
  fetchConnectedApps,
  revokeConnectedApp,
  type ConnectedAppRow,
} from "../../../lib/api";
import { formatRelativeTime } from "../../../lib/format-time";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { useToast } from "../../../ui/toast-provider";
import { Bot, Laptop, Terminal, Trash2 } from "lucide-react";

function getClientIcon(clientId: string) {
  const id = clientId.toLowerCase();
  if (id.includes("cli")) {
    return Terminal;
  }
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setApps(await fetchConnectedApps());
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
      toast(`Revoked session for "${name}"`);
    } catch {
      toast("Failed to revoke session");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connected Apps & CLI</CardTitle>
          <CardDescription>
            Applications and terminal sessions authorized via OAuth loopback or device flow.
            You can revoke access to immediately invalidate their credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-ink-muted">Loading connected apps…</p>
          ) : apps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 p-8 text-center">
              <Laptop className="mx-auto h-8 w-8 text-ink-muted/60" />
              <p className="mt-2 text-sm font-medium text-ink">No connected applications</p>
              <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto">
                Authenticate the Epure CLI or MCP server by running <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11px]">epure login</code> in your terminal.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {apps.map((app) => {
                const Icon = getClientIcon(app.client_id);
                return (
                  <div
                    key={app.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted/50 text-ink">
                        <Icon size={18} className="stroke-[1.8]" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-ink truncate">
                            {app.client_name || app.client_id}
                          </span>
                          <span className="font-mono text-[11px] text-ink-muted">
                            ({app.client_id})
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {app.scopes.map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {s}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-muted">
                          <span>Authorized {new Date(app.created_at).toLocaleDateString()}</span>
                          {app.last_used_at && (
                            <span>• Active {formatRelativeTime(app.last_used_at)}</span>
                          )}
                          {app.ip_address && <span>• IP: {app.ip_address}</span>}
                          {app.user_agent && (
                            <span className="truncate max-w-[200px]" title={app.user_agent}>
                              • {app.user_agent}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center shrink-0 self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revokingId === app.id}
                        onClick={() => handleRevoke(app.id, app.client_name || app.client_id)}
                        className="text-state-error hover:bg-state-error/10 hover:border-state-error/40"
                      >
                        <Trash2 size={13} className="mr-1.5" />
                        {revokingId === app.id ? "Revoking…" : "Revoke"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
