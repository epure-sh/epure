import {
  ChevronDown,
  ExternalLink,
  Gauge,
  Sparkles,
  TrendingUp,
  Undo2,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { projectSettingsPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { Badge } from "../../ui/badge";
import { ActionButton } from "../../ui/action-button";
import { Button } from "../../ui/button";
import { ALERT_RULES, type AlertRuleDefinition } from "./alert-utils";

function RuleIcon({ rule }: { rule: AlertRuleDefinition }) {
  switch (rule.id) {
    case "regression":
      return <Undo2 size={14} strokeWidth={1.75} className="text-semantic-danger" aria-hidden />;
    case "new_issue":
      return <Sparkles size={14} strokeWidth={1.75} className="text-accent" aria-hidden />;
    case "users_affected":
      return <Users size={14} strokeWidth={1.75} className="text-semantic-warning" aria-hidden />;
    case "ingest_cap_hit":
      return <Gauge size={14} strokeWidth={1.75} className="text-semantic-danger" aria-hidden />;
    default:
      return <TrendingUp size={14} strokeWidth={1.75} className="text-semantic-warning" aria-hidden />;
  }
}

export interface AlertsRulesPanelProps {
  projectId: string;
  webhookCount?: number | null;
  canManageWebhooks?: boolean;
  defaultOpen?: boolean;
}

export function AlertsRulesPanel({
  projectId,
  webhookCount,
  canManageWebhooks = true,
  defaultOpen = false,
}: AlertsRulesPanelProps) {
  const webhooksPath = projectSettingsPath(projectId, "webhooks");
  const webhookHint =
    webhookCount === null
      ? "Checking notification endpoints…"
      : webhookCount === 0
        ? "No endpoints yet — forward New issue and Came back alerts to Slack or Discord."
        : `${webhookCount} signed endpoint${webhookCount === 1 ? "" : "s"} forwarding alerts.`;

  return (
    <details
      className="group border-t border-border bg-bg-subtle/20"
      open={defaultOpen}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 md:px-6",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
          How alerts work
          <span className="text-xs font-normal text-ink-muted">
            {ALERT_RULES.length} built-in rules
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-ink-muted transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="space-y-3 border-t border-border px-4 pb-4 pt-3 md:px-6">
        <ul className="space-y-2">
          {ALERT_RULES.map((rule) => (
            <li
              key={rule.id}
              className="rounded-md border border-border bg-surface px-3 py-2.5"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-bg-subtle">
                  <RuleIcon rule={rule} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{rule.name}</p>
                    <Badge
                      variant={rule.severity === "danger" ? "error" : "warning"}
                      size="compact"
                    >
                      {rule.severity === "danger" ? "High" : "Medium"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{rule.description}</p>
                  <p className="mt-1.5 text-xs text-ink-muted">
                    <span className="font-medium text-ink">Threshold:</span> {rule.threshold}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">{rule.pauseHint}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
          <p className="min-w-0 text-xs text-ink-muted">
            <span className="font-medium text-ink">Notifications:</span> {webhookHint}
          </p>
          {canManageWebhooks ? (
            <Button variant="secondary" size="sm" className="shrink-0" asChild>
              <Link to={webhooksPath}>
                Manage notifications
                <ExternalLink size={14} strokeWidth={1.75} className="ml-1.5" aria-hidden />
              </Link>
            </Button>
          ) : (
            <ActionButton
              variant="secondary"
              size="sm"
              className="shrink-0"
              disabled
              tooltip="Admin or owner required to manage notifications"
            >
              Manage webhooks
            </ActionButton>
          )}
        </div>
      </div>
    </details>
  );
}
