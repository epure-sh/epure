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
import { useToast } from "../../../ui/toast-provider";
import { SectionCard } from "@/components/kit/section-card";
import {
  MemberAccessNotice,
  SettingsSkeleton,
  SettingsStack,
} from "../../settings/shared";

export function AgentTokensTab() {
  const navigate = useNavigate();
  const { user, userLoading } = useAppContext();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<AgentTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canManage = user?.role === "owner" || user?.role === "admin";

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
      toast("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, [userLoading, canManage, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this token?")) return;
    setBusy(true);
    try {
      await revokeAgentToken(id);
      await load();
      toast("Revoked");
    } catch {
      toast("Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  if (userLoading) {
    return (
      <SettingsStack>
        <SettingsSkeleton />
      </SettingsStack>
    );
  }

  if (!canManage) {
    return (
      <SettingsStack>
        <MemberAccessNotice resource="agent tokens" />
      </SettingsStack>
    );
  }

  return (
    <SettingsStack>
      <SectionCard
        title="Agent tokens"
        description="OAuth device / PKCE sessions. New static keys are not issued."
        headerActions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7"
            onClick={() => navigate(workspaceSettingsPath("connected-apps"))}
          >
            Connected apps
          </Button>
        }
        flush
      >
        {loading ? (
          <p className="px-3 py-2 text-2xs text-fg-muted">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="px-3 py-2 text-xs text-fg-muted">
            No tokens yet. Connect via <span className="font-mono">epure login</span> or MCP.
          </p>
        ) : (
          <ul className="w-full divide-y divide-border-subtle">
            {tokens.map((row) => {
              const active = !row.revoked_at;
              return (
                <li
                  key={row.id}
                  className="flex w-full min-h-9 items-center justify-between gap-2 px-3 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-fg-primary">
                        {row.label}
                      </span>
                      <Badge variant={active ? "env" : "secondary"} size="compact">
                        {active ? "Active" : "Revoked"}
                      </Badge>
                    </div>
                    <p className="truncate text-2xs text-fg-muted">
                      {row.token_prefix}… · {row.scopes.join(", ")}
                      {row.last_used_at
                        ? ` · ${formatRelativeTime(row.last_used_at)}`
                        : ""}
                    </p>
                  </div>
                  {active ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 text-2xs text-semantic-danger"
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
      </SectionCard>
    </SettingsStack>
  );
}
