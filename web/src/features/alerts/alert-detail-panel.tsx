import { useState, type ReactNode } from "react";
import { BellOff, BellRing, Check, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { AlertRow } from "../../lib/api";
import { projectIssuePath, projectSettingsPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon, ArrowSquareOut, CaretDown, CaretLeft } from "@/components/ui/icon";
import { ActionButton } from "@/ui/action-button";
import { DETAIL_INLINE_ACTION_CLASS } from "@/ui/issue-detail-tabs";
import { useToast } from "@/ui/toast-provider";
import { copyAlertExport } from "./export-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { AlertStateBadge } from "./alert-state-badge";
import {
  getAlertDetailHeadline,
  getAlertDetailStructuredFields,
  getAlertDispatchAuditRows,
  getAlertEditableRuleId,
  getAlertLifecycle,
  getAlertOutputChannels,
  getAlertOutputsCollapsedPreview,
  type AlertDetailKvRow,
} from "./alert-utils";

function DetailCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-mono text-[10px] font-medium uppercase tracking-wide text-fg-muted">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 text-sm text-fg-secondary">{children}</CardContent>
    </Card>
  );
}

function DetailKvRows({ rows }: { rows: AlertDetailKvRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <dl className="space-y-2.5">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.value}`}
          className="grid grid-cols-1 gap-x-4 gap-y-0.5 @[20rem]/detail:grid-cols-[minmax(0,8.5rem)_1fr]"
        >
          <dt className="text-xs text-fg-muted">{row.label}</dt>
          <dd
            className={cn(
              "min-w-0 text-sm text-fg-primary [overflow-wrap:anywhere]",
              row.mono ? "font-mono-slash tabular-nums" : "",
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function alertHasDispatchPayload(alert: AlertRow): boolean {
  const raw = alert.payload_json?.dispatches;
  return Array.isArray(raw) && raw.length > 0;
}

export interface AlertDetailPanelProps {
  alert: AlertRow | null;
  projectId: string;
  webhookCount?: number | null;
  busy?: boolean;
  canManageRules?: boolean;
  onAcknowledge: () => void;
  onReopen: () => void;
  onMute: () => void;
  onUnmute: () => void;
  onEditRule?: (ruleId: string) => void;
  onBackToList?: () => void;
  className?: string;
}

export function AlertDetailPanel({
  alert,
  projectId,
  webhookCount = null,
  busy,
  canManageRules = false,
  onAcknowledge,
  onReopen,
  onMute,
  onUnmute,
  onEditRule,
  onBackToList,
  className,
}: AlertDetailPanelProps) {
  const [outputsOpen, setOutputsOpen] = useState(false);
  const { toast } = useToast();

  if (!alert) {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col px-6 py-6", className)}>
        <p className="max-w-sm text-sm text-fg-muted">
          Select an alert to see what triggered it and where notifications went.
        </p>
      </div>
    );
  }

  const structured = getAlertDetailStructuredFields(alert);
  const lifecycle = getAlertLifecycle(alert);
  const title = getAlertDetailHeadline(alert).trim() || "Alert";
  const dispatches = getAlertDispatchAuditRows(alert, webhookCount);
  const outputChannels = getAlertOutputChannels(alert, webhookCount);
  const hasDeliveryAudit = alertHasDispatchPayload(alert);
  const deliveredCount = dispatches.filter((row) => row.statusOk).length;
  const pid = alert.project_id || projectId;
  const webhooksPath = pid ? projectSettingsPath(pid, "webhooks") : "/settings";
  const editableRuleId = getAlertEditableRuleId(alert);

  const showIssueSection = structured?.linkedIssue && pid;
  const primaryIssueId = structured?.linkedIssue?.issueId ?? null;

  const outputsCollapsedPreview = hasDeliveryAudit ? getAlertOutputsCollapsedPreview(alert) : null;

  const outputsSummary = hasDeliveryAudit
    ? `${deliveredCount}/${dispatches.length} delivered`
    : webhookCount === 0
      ? "No webhooks"
      : webhookCount === null
        ? "…"
        : `${webhookCount} route${webhookCount === 1 ? "" : "s"}`;

  return (
    <div className={cn("@container/detail flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-1", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col">
          <header className="sticky top-0 z-10 shrink-0 border-b border-border-subtle bg-surface-1">
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border-subtle px-3 py-1.5">
              {onBackToList ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="gap-1 lg:hidden"
                  onClick={onBackToList}
                >
                  <Icon icon={CaretLeft} size={14} aria-hidden />
                  Alerts
                </Button>
              ) : (
                <span className="hidden lg:block" aria-hidden />
              )}
              <div className="ml-auto flex min-w-0 max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
                <ActionButton
                  variant="ghost"
                  size="sm"
                  className={DETAIL_INLINE_ACTION_CLASS}
                  disabled={busy}
                  tooltip="Copy a diagnostic brief for your coding agent (C)"
                  onClick={() => {
                    void copyAlertExport(alert, pid).then(() => toast("Copied alert brief for AI"));
                  }}
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  <span>Copy for agent</span>
                </ActionButton>
                {showIssueSection && primaryIssueId ? (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    className={DETAIL_INLINE_ACTION_CLASS}
                    asChild
                    tooltip="Open linked issue"
                  >
                    <Link to={projectIssuePath(pid, primaryIssueId)}>
                      <Icon icon={ArrowSquareOut} size={14} className="text-fg-muted" aria-hidden />
                      <span>Open issue</span>
                    </Link>
                  </ActionButton>
                ) : null}
                {lifecycle === "active" ? (
                  <ActionButton
                    variant="primary"
                    size="sm"
                    className={DETAIL_INLINE_ACTION_CLASS}
                    disabled={busy}
                    onClick={onAcknowledge}
                  >
                    <Check className="size-3.5" aria-hidden />
                    <span>{busy ? "Saving…" : "Resolve"}</span>
                  </ActionButton>
                ) : null}
                {lifecycle === "acknowledged" ? (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    className={DETAIL_INLINE_ACTION_CLASS}
                    disabled={busy}
                    onClick={onReopen}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    <span>{busy ? "Saving…" : "Mark unread"}</span>
                  </ActionButton>
                ) : null}
                {lifecycle !== "muted" ? (
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    tooltip="Snooze alert notifications (M)"
                    disabled={busy}
                    aria-label="Snooze alert"
                    onClick={onMute}
                  >
                    <BellOff className="size-3.5" aria-hidden />
                  </ActionButton>
                ) : (
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    tooltip="Unsnooze (M)"
                    disabled={busy}
                    aria-label="Unsnooze alert"
                    onClick={onUnmute}
                  >
                    <BellRing className="size-3.5" aria-hidden />
                  </ActionButton>
                )}
                {canManageRules && editableRuleId && onEditRule ? (
                  <ActionButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    tooltip="Edit rule"
                    disabled={busy}
                    aria-label="Edit rule"
                    onClick={() => onEditRule(editableRuleId)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </ActionButton>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 px-4 pb-4 pt-3 md:px-5">
              <AlertStateBadge
                alert={alert}
                showOpenDuration
                className="w-fit opacity-90 [&_svg]:opacity-80"
              />
              <h2 className="min-w-0 break-words text-lg font-semibold leading-snug tracking-ui text-fg-primary md:text-xl">
                {title}
              </h2>
            </div>
          </header>

          {structured ? (
            <div className="flex flex-col gap-4 px-6 py-6">
              <DetailCard title="At a glance">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="font-mono text-sm tabular-nums text-fg-primary">{structured.timestamp.absolute}</p>
                    <span className="text-fg-muted" aria-hidden>·</span>
                    <p className="text-sm tabular-nums text-fg-secondary">{structured.timestamp.relative}</p>
                  </div>
                  {structured.timestamp.isoSubline ? (
                    <p className="font-mono text-[11px] tabular-nums text-fg-muted">{structured.timestamp.isoSubline}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-fg-muted">Rule kind</span>
                    <Badge variant="neutral" size="compact" className="font-mono font-normal uppercase tracking-wide">
                      {structured.kindChip}
                    </Badge>
                  </div>
                </div>
              </DetailCard>

              <DetailCard title="Trigger">
                {structured.triggerExplanation ? (
                  <p className="mb-3 text-fg-secondary [overflow-wrap:anywhere]">{structured.triggerExplanation}</p>
                ) : (
                  <p className="mb-3 text-fg-muted">No trigger summary for this firing.</p>
                )}
                <DetailKvRows rows={structured.triggerRows} />
              </DetailCard>

              <DetailCard title="Impact">
                {structured.impactRows.length > 0 ? (
                  <DetailKvRows rows={structured.impactRows} />
                ) : (
                  <p className="text-fg-muted">No impact metrics recorded at fire time.</p>
                )}
              </DetailCard>

              {showIssueSection && structured.linkedIssue ? (
                <DetailCard title="Linked issue">
                  <DetailKvRows rows={structured.linkedIssue.rows} />
                  <div className="mt-3">
                    <Button variant="ghost" size="sm" className="gap-1 px-0" asChild>
                      <Link to={projectIssuePath(pid, structured.linkedIssue.issueId)}>
                        Open {structured.linkedIssue.issueShort}
                        <Icon icon={ArrowSquareOut} size={12} className="text-fg-muted" aria-hidden />
                      </Link>
                    </Button>
                  </div>
                  {structured.linkedIssue.correlatedIssueIds.length > 0 ? (
                    <ul className="mt-2 space-y-1 border-t border-border-subtle pt-3 font-mono text-xs text-fg-muted">
                      {structured.linkedIssue.correlatedIssueIds.map((id) => (
                        <li key={id} className="min-w-0 truncate">
                          <Link
                            to={projectIssuePath(pid, id)}
                            className="text-fg-secondary hover:text-accent focus-ring"
                            title={id}
                          >
                            Also matched #{id.replace(/-/g, "").slice(0, 8)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </DetailCard>
              ) : null}

              <Card className="shadow-none">
                <CardHeader className="px-4 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-between gap-2 px-0 py-0 font-normal hover:bg-transparent"
                    aria-expanded={outputsOpen}
                    onClick={() => setOutputsOpen((open) => !open)}
                  >
                    <CardTitle className="font-mono text-[10px] font-medium uppercase tracking-wide text-fg-muted">
                      Outputs
                    </CardTitle>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs text-fg-secondary">{outputsSummary}</span>
                      <Icon
                        icon={CaretDown}
                        size={14}
                        className={cn("shrink-0 text-fg-muted transition-transform", outputsOpen && "rotate-180")}
                        aria-hidden
                      />
                    </span>
                  </Button>
                </CardHeader>
                {!outputsOpen ? (
                  outputsCollapsedPreview ? (
                    <CardContent className="px-4 pb-4 pt-0 text-sm text-fg-muted [overflow-wrap:anywhere]">
                      {outputsCollapsedPreview}
                    </CardContent>
                  ) : outputChannels.length > 0 ? (
                    <CardContent className="px-4 pb-4 pt-0 text-sm text-fg-muted [overflow-wrap:anywhere]">
                      {outputChannels.map((channel) => channel.label).join(" · ")}
                    </CardContent>
                  ) : null
                ) : (
                  <CardContent className="px-4 pb-4 pt-0">
                    {hasDeliveryAudit ? (
                      <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle font-mono text-xs">
                        {dispatches.map((row) => (
                          <li
                            key={row.id}
                            className="flex min-w-0 flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                          >
                            <div className="flex min-w-0 items-center gap-2 text-fg-muted">
                              <span
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  row.statusOk ? "bg-healthy" : "bg-fg-muted",
                                )}
                                aria-hidden
                              />
                              <span className="min-w-0 truncate">
                                <span className="text-fg-secondary">{row.channel}</span>{" "}
                                <span className="text-fg-primary">{row.target}</span>
                              </span>
                            </div>
                            <div className="flex shrink-0 flex-col items-start gap-0.5 pl-3.5 tabular-nums sm:items-end sm:pl-0">
                              <span className={row.statusOk ? "font-medium text-fg-primary" : "text-fg-muted"}>
                                {row.status}
                              </span>
                              <span className="text-[11px] text-fg-muted">{row.timeLabel}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-fg-muted">
                        No delivery log.{" "}
                        <Link
                          to={webhooksPath}
                          className="text-fg-secondary underline-offset-2 hover:text-accent hover:underline"
                        >
                          Webhooks
                        </Link>
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
