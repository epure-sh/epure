import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAgentTokens,
  revokeAgentToken,
  type AgentTokenRow,
} from "../../../lib/api";
import { formatRelativeTime } from "../../../lib/format-time";
import { workspaceSettingsPath } from "../../../lib/paths";
import { useAppContext } from "../../../shell/app-context";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { useToast } from "../../../ui/toast-provider";
import { MemberAccessNotice } from "../../settings/shared";

export function AgentTokensTab() {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<AgentTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canManage = user?.role === "owner" || user?.role === "admin";

  const load = useCallback(async () => {
    if (!canManage) {
      setTokens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTokens(await fetchAgentTokens());
    } catch {
      toast("Failed to load agent tokens");
    } finally {
      setLoading(false);
    }
  }, [canManage, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this token? MCP and CLI using it will stop working.")) {
      return;
    }
    setBusy(true);
    try {
      await revokeAgentToken(id);
      await load();
      toast("Agent token revoked");
    } catch {
      toast("Failed to revoke token");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <MemberAccessNotice resource="agent tokens (MCP and epure-cli)" />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>OAuth-Only Authentication</CardTitle>
              <CardDescription className="mt-1">
                Manual API token generation has been removed. Epure now enforces 100% OAuth 2.0 Device Flow &amp; PKCE consent.
              </CardDescription>
            </div>
            <Badge variant="healthy" size="sm" dot>
              100% OAuth-Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-ink-muted leading-relaxed">
            AI assistants (Cursor MCP, Claude Code) and the Epure CLI connect via instant cryptographic PKCE authorization.
            Static API keys are no longer issued to guarantee zero credential leakage and automatic token rotation.
          </p>
          <div className="pt-1 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(workspaceSettingsPath("connected-apps"))}
            >
              View Connected OAuth Apps
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-ink-muted">No agent tokens yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tokens.map((row) => {
                const active = !row.revoked_at;
                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{row.label}</span>
                        <Badge variant={active ? "default" : "secondary"}>
                          {active ? "active" : "revoked"}
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-muted">
                        {row.token_prefix}… · {row.scopes.join(", ")}
                        {row.last_used_at
                          ? ` · last used ${formatRelativeTime(row.last_used_at)}`
                          : ""}
                      </p>
                    </div>
                    {active ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleRevoke(row.id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
