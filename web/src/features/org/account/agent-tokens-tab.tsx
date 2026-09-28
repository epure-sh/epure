import { useCallback, useEffect, useState } from "react";
import {
  createAgentToken,
  fetchAgentTokens,
  revokeAgentToken,
  type AgentTokenRow,
  type CreatedAgentToken,
} from "../../../lib/api";
import { formatRelativeTime } from "../../../lib/format-time";
import { useAppContext } from "../../../shell/app-context";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { CopyButton } from "../../../ui/copy-button";
import { Field } from "../../../ui/field";
import { Input } from "../../../ui/input";
import { useToast } from "../../../ui/toast-provider";
import { MemberAccessNotice } from "../../settings/shared";

export function AgentTokensTab() {
  const { user } = useAppContext();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<AgentTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("cursor");
  const [writeTriage, setWriteTriage] = useState(false);
  const [writeAdmin, setWriteAdmin] = useState(false);
  const [revealed, setRevealed] = useState<CreatedAgentToken | null>(null);

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

  async function handleCreate() {
    setBusy(true);
    try {
      const scopes = ["read:agent"];
      if (writeTriage) {
        scopes.push("write:triage");
      }
      if (writeAdmin) {
        scopes.push("write:admin");
      }
      const created = await createAgentToken({
        label: label.trim() || "agent",
        scopes,
      });
      setRevealed(created);
      await load();
      toast("Agent token created. Copy it now.");
    } catch {
      toast("Failed to create agent token");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this token? MCP and CLI using it will stop working.")) {
      return;
    }
    setBusy(true);
    try {
      await revokeAgentToken(id);
      if (revealed?.id === id) {
        setRevealed(null);
      }
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
          <CardTitle>Agent tokens</CardTitle>
          <CardDescription>
            Personal access tokens for Cursor MCP and <code className="text-xs">epure-cli</code>.
            Scopes: read (all GET APIs), write:triage (issues/alerts/snooze), write:admin (projects, DSN, webhooks, team).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Label" className="min-w-[12rem] flex-1">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={writeTriage}
                onChange={(e) => setWriteTriage(e.target.checked)}
                disabled={busy}
              />
              write:triage
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={writeAdmin}
                onChange={(e) => setWriteAdmin(e.target.checked)}
                disabled={busy}
              />
              write:admin (full settings)
            </label>
            <Button type="button" disabled={busy} onClick={() => void handleCreate()}>
              Create token
            </Button>
          </div>

          {revealed ? (
            <div className="rounded-sm border border-border bg-bg-subtle/40 p-3 text-sm">
              <p className="font-medium text-ink">Copy this token now. It will not be shown again.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="break-all text-xs">{revealed.token}</code>
                <CopyButton value={revealed.token} label="Copy token" />
              </div>
            </div>
          ) : null}
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
