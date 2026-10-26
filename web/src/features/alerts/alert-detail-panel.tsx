import { Link } from "react-router-dom";
import type { AlertRow } from "../../lib/api";
import { projectIssuePath, projectSettingsPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { AlertStateBadge } from "./alert-state-badge";
import {
  formatAlertDetailTime,
  getAlertCorrelatedIssueIds,
  getAlertDetail,
  getAlertImpactMetrics,
  getAlertLifecycle,
  getAlertOutputChannels,
  getAlertPriorityLabel,
  getAlertRuleDisplayName,
  getAlertSeverityForAlert,
  getAlertTitle,
  getIssueLink,
} from "./alert-utils";

function shortIssueId(id: string): string {
  return id.slice(0, 8);
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-2.5 py-1.5 sm:px-3">
      <p className="text-[9px] font-medium uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-fg-primary">{value}</p>
    </div>
  );
}

export interface AlertDetailPanelProps {
  alert: AlertRow | null;
  projectId: string;
  webhookCount?: number | null;
  busy?: boolean;
  onAcknowledge: () => void;
  onReopen: () => void;
  onMute: () => void;
  onUnmute: () => void;
  className?: string;
}

export function AlertDetailPanel({
  alert,
  projectId,
  webhookCount = null,
  busy,
  onAcknowledge,
  onReopen,
  onMute,
  onUnmute,
  className,
}: AlertDetailPanelProps) {
  if (!alert) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center",
          className,
        )}
      >
        <p className="text-sm text-fg-muted">Select an alert to review signal, impact, and actions.</p>
      </div>
    );
  }

  const lifecycle = getAlertLifecycle(alert);
  const severity = getAlertSeverityForAlert(alert);
  const priority = getAlertPriorityLabel(severity);
  const ruleName = getAlertRuleDisplayName(alert);
  const issueTitle = getAlertTitle(alert);
  const detail = getAlertDetail(alert);
  const firedAt = formatAlertDetailTime(alert.fired_at);
  const { events, users } = getAlertImpactMetrics(alert);
  const issueIds = getAlertCorrelatedIssueIds(alert);
  const channels = getAlertOutputChannels(alert, webhookCount);
  const issueHref = getIssueLink(alert, alert.project_id || projectId);
  const pid = alert.project_id || projectId;
  const webhooksPath = pid ? projectSettingsPath(pid, "webhooks") : "/settings";

  const showRuleSubtitle = issueTitle.trim() !== ruleName.trim();

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-auto bg-surface-1", className)}>
      <header className="shrink-0 border-b border-border-subtle px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <AlertStateBadge alert={alert} />
          <Badge variant={severity === "danger" ? "error" : "warning"} size="compact">
            {priority}
          </Badge>
          <span className="ml-auto font-mono text-2xs tabular-nums text-fg-muted">{firedAt}</span>
        </div>

        <h2 className="mt-3 text-base font-semibold leading-snug tracking-tight text-fg-primary [overflow-wrap:anywhere]">
          {ruleName}
        </h2>
        {showRuleSubtitle ? (
          <p className="mt-1 text-sm leading-snug text-fg-secondary [overflow-wrap:anywhere]">{issueTitle}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2 border-t border-border-subtle pt-3">
          {lifecycle === "active" ? (
            <>
              <Button variant="primary" size="sm" disabled={busy} onClick={onAcknowledge}>
                Acknowledge
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onMute}>
                Mute issue
              </Button>
            </>
          ) : null}
          {lifecycle === "acknowledged" ? (
            <>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onReopen}>
                Mark unread
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onMute}>
                Mute
              </Button>
            </>
          ) : null}
          {lifecycle === "muted" ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onUnmute}>
              Unmute
            </Button>
          ) : null}
          {alert.kind !== "ingest_cap_hit" && alert.issue_id ? (
            <Button variant="secondary" size="sm" asChild>
              <Link to={issueHref}>Open issue</Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px border-b border-border-subtle bg-border-subtle sm:grid-cols-4">
        <DetailMetric
          label="Events"
          value={events != null ? events.toLocaleString() : "—"}
        />
        <DetailMetric
          label="Users"
          value={users != null ? users.toLocaleString() : "—"}
        />
        <DetailMetric label="Priority" value={priority} />
        <DetailMetric label="Severity" value={severity === "danger" ? "High" : "Medium"} />
      </div>

      {issueIds.length > 0 ? (
        <section className="border-b border-border-subtle px-5 py-3">
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">
            Correlated issues
          </h3>
          <ul className="mt-2 space-y-1.5">
            {issueIds.map((id) => (
              <li key={id}>
                <Link
                  to={projectIssuePath(pid, id)}
                  className="group flex items-baseline gap-2 text-sm text-fg-primary hover:text-accent focus-ring rounded-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium group-hover:underline">
                    {issueTitle && issueIds.length === 1 ? issueTitle : `Issue ${shortIssueId(id)}`}
                  </span>
                  <span className="shrink-0 font-mono text-2xs text-fg-muted">{shortIssueId(id)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {issueIds.length > 1 ? (
            <p className="mt-2 text-[10px] leading-snug text-fg-muted">
              Custom rules can match multiple issues over time; each firing links its primary issue.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="border-b border-border-subtle px-5 py-3">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Output</h3>
        <ul className="mt-2 space-y-1.5">
          {channels.map((channel) => (
            <li
              key={channel.id}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="font-medium text-fg-primary">{channel.label}</span>
              {channel.id === "webhooks" && pid ? (
                <Link
                  to={webhooksPath}
                  className="text-xs text-fg-muted hover:text-accent focus-ring rounded-sm"
                >
                  {channel.detail}
                </Link>
              ) : (
                <span className="text-xs text-fg-muted">{channel.detail}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {detail ? (
        <section className="px-5 py-3">
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Summary</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-secondary [overflow-wrap:anywhere]">{detail}</p>
        </section>
      ) : null}
    </div>
  );
}
