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
  const webhooksPath = projectSettingsPath(projectId, "webhooks");
  const rulesPath = projectSettingsPath(projectId, "alerts");
  const webhookHint =
    webhookCount === null
      ? "Checking notification endpoints…"
      : webhookCount === 0
        ? "No Slack or Discord endpoints yet."
        : `${webhookCount} endpoint${webhookCount === 1 ? "" : "s"} forwarding subscribed events.`;

  return (
    <footer className="shrink-0 border-t border-border bg-bg-subtle/20 px-4 py-2.5 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <p className="min-w-0 leading-relaxed">
          <span className="font-medium text-ink">
            {ALERT_RULES.filter((rule) => rule.id !== "custom").length} built-in rules.
          </span>{" "}
          Add project rules under Alert rules. Ignore an alert to stop that rule for the issue.
          <span className="mx-1.5 text-ink-muted/40" aria-hidden>·</span>
          {webhookHint}
        </p>
        {canManageWebhooks ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to={rulesPath}>Alert rules</Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to={webhooksPath}>Notifications</Link>
            </Button>
          </div>
        ) : (
          <ActionButton
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            disabled
            tooltip="Admin or owner required to manage notifications"
          >
            Notifications
          </ActionButton>
        )}
      </div>
    </footer>
  );
}
