import { Link } from "react-router-dom";
import { projectSettingsPath } from "../../lib/paths";
import { ActionButton } from "../../ui/action-button";
import { Button } from "../../ui/button";
import { ALERT_RULES } from "./alert-utils";

export interface AlertsRulesPanelProps {
  projectId: string;
  webhookCount?: number | null;
  canManageWebhooks?: boolean;
}

export function AlertsRulesPanel({
  projectId,
  webhookCount,
  canManageWebhooks = true,
}: AlertsRulesPanelProps) {
  const safeProjectId = projectId || "";
  const webhooksPath = safeProjectId ? projectSettingsPath(safeProjectId, "webhooks") : "/settings";
  const rulesPath = safeProjectId ? projectSettingsPath(safeProjectId, "alerts") : "/settings";
  const builtInRulesCount = (ALERT_RULES ?? []).filter((rule) => rule && rule.id !== "custom").length;
  const webhookHint =
    webhookCount === null
      ? "Checking notification endpoints…"
      : webhookCount === 0
        ? "No Slack or Discord endpoints yet."
        : `${webhookCount} endpoint${webhookCount === 1 ? "" : "s"} forwarding subscribed events.`;

  return (
    <footer className="shrink-0 border-t border-border-subtle px-4 py-2 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-fg-muted">
        <p className="min-w-0 truncate">
          {builtInRulesCount} built-in · {webhookHint}
        </p>
        {canManageWebhooks ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to={webhooksPath}>Webhooks</Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to={rulesPath}>Rules</Link>
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <ActionButton
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              disabled
              tooltip="Admin or owner required to manage alert rules"
            >
              Configure Rules
            </ActionButton>
            <ActionButton
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              disabled
              tooltip="Admin or owner required to manage notifications"
            >
              Notifications
            </ActionButton>
          </div>
        )}
      </div>
    </footer>
  );
}
