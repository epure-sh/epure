import { useState, type ReactNode } from "react";
import {
  BellOff,
  BellRing,
  Check,
  Pencil,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { AlertRow } from "../../lib/api";
import { projectIssuePath, projectSettingsPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/ui/action-button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Icon, ArrowSquareOut, CaretDown, CaretLeft, Bell, Warning } from "@/components/ui/icon";
import { DETAIL_INLINE_ACTION_CLASS } from "@/ui/issue-detail-tabs";
import { toast } from "@/components/ui/sonner";
import { copyAlertExport } from "./export-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { AlertStateBadge } from "./alert-state-badge";
import {
  getAlertDetailHeadline,
  getAlertDetailStructuredFields,
  getAlertDispatchAuditRows,
  getAlertEditableRuleId,
  getAlertImpactMetrics,
  getAlertLifecycle,
  getAlertListRuleName,
  getAlertOutputChannels,
  getAlertOutputsCollapsedPreview,
  getAlertRuleDisplayName,
  formatAlertTimestampPrecise,
  type AlertDetailKvRow,
} from "./alert-utils";

function DetailCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("shadow-none border-border-subtle bg-surface-1 rounded-panel", className)}>
      <CardHeader className="flex flex-row items-center justify-between px-5 py-3.5 border-b border-border-subtle/60 bg-surface-1">
        <CardTitle className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          {title}
        </CardTitle>
        {subtitle ? <div className="text-xs text-fg-muted">{subtitle}</div> : null}
      </CardHeader>
      <CardContent className="p-5 text-sm text-fg-secondary">{children}</CardContent>
    </Card>
  );
}

function DetailKvRows({ rows }: { rows: AlertDetailKvRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <dl className="divide-y divide-border-subtle/50">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.value}`}
          className="grid grid-cols-1 gap-x-4 gap-y-1.5 py-2.5 first:pt-0 last:pb-0 @[20rem]:grid-cols-[minmax(0,10.5rem)_1fr] @[20rem]/detail:grid-cols-[minmax(0,10.5rem)_1fr]"
        >
          <dt className="text-xs text-fg-muted font-normal">{row.label}</dt>
          <dd
            className={cn(
              "min-w-0 text-xs text-fg-primary [overflow-wrap:anywhere]",
              row.mono ? "font-mono tabular-nums" : "",
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

interface MetricBlock {
  label: string;
  badge?: string;
  badgeVariant?: BadgeProps["variant"];
  value: string;
  unit?: string;
  subtext?: string;
}

function getAlertMetricBlocks(alert: AlertRow): MetricBlock[] {
  const payload = alert.payload_json ?? {};
  const kind = alert.kind;
  const ruleKind =
    kind === "custom" && typeof payload.rule_kind === "string"
      ? payload.rule_kind
      : kind;

  if (ruleKind === "velocity_spike" || ruleKind === "velocity") {
    const ratio = typeof payload.ratio === "number" ? payload.ratio : null;
    const current =
      typeof payload.current_window === "number" ? payload.current_window : null;
    const previous =
      typeof payload.previous_window === "number" ? payload.previous_window : null;
    const eventCount =
      typeof payload.event_count === "number" ? payload.event_count : current;
    const userCount =
      typeof payload.unique_user_count === "number"
        ? payload.unique_user_count
        : null;
    const trafficShare =
      typeof payload.traffic_share === "string" ? payload.traffic_share : null;
    const env =
      typeof payload.environment === "string" ? payload.environment : null;

    // Extract short percent if trafficShare contains words (e.g. "21.6% checkout traffic" -> "21.6%")
    const trafficShareBadge = trafficShare
      ? trafficShare.split(" ")[0]
      : eventCount && eventCount > 1000
        ? "Surge"
        : undefined;

    return [
      {
        label: "Breach",
        badge: ratio !== null ? `+${Math.round((ratio - 1) * 100)}%` : undefined,
        badgeVariant: "escalating",
        value: current !== null ? current.toLocaleString() : "Spike",
        unit: "ev",
        subtext:
          previous !== null
            ? `Baseline: ${previous.toLocaleString()} ev (${ratio ? `${ratio.toFixed(1)}x` : "window"})`
            : "Rolling 15m window",
      },
      {
        label: "Traffic",
        badge: trafficShareBadge,
        badgeVariant: trafficShare ? "accent" : "neutral",
        value: eventCount !== null ? eventCount.toLocaleString() : "N/A",
        subtext: trafficShare ? `${trafficShare}` : "Fire-time event volume",
      },
      {
        label: "Impacted",
        badge: userCount !== null && userCount > 0 ? "Unique" : "Scope",
        badgeVariant: "neutral",
        value: userCount !== null ? userCount.toLocaleString() : "N/A",
        unit: userCount !== null ? "users" : undefined,
        subtext: env ? "Production scope" : "Unique accounts affected",
      },
    ];
  }

  if (kind === "regression") {
    const release = typeof payload.release === "string" ? payload.release : "Reopened";
    const resolvedIn =
      typeof payload.resolved_in_release === "string" ? payload.resolved_in_release : null;
    const eventCount =
      typeof payload.event_count === "number" ? payload.event_count : null;
    const userCount =
      typeof payload.unique_user_count === "number"
        ? payload.unique_user_count
        : null;

    return [
      {
        label: "Regression",
        badge: "Reopened",
        badgeVariant: "escalating",
        value: release,
        subtext: resolvedIn ? `Resolved in ${resolvedIn}` : "Exception reopened",
      },
      {
        label: "Volume",
        badge: "Total",
        badgeVariant: "neutral",
        value: eventCount !== null ? eventCount.toLocaleString() : "1",
        unit: "event",
        subtext: "Events since reopen",
      },
      {
        label: "Impacted",
        badge: "Customer",
        badgeVariant: "neutral",
        value: userCount !== null ? userCount.toLocaleString() : "Active",
        unit: userCount !== null ? "users" : undefined,
        subtext: "Customer accounts hit",
      },
    ];
  }

  if (kind === "new_issue") {
    const release = typeof payload.release === "string" ? payload.release : "New exception";
    const eventCount =
      typeof payload.event_count === "number" ? payload.event_count : 1;
    const userCount =
      typeof payload.unique_user_count === "number"
        ? payload.unique_user_count
        : 1;

    return [
      {
        label: "First Seen",
        badge: "New",
        badgeVariant: "warning",
        value: release,
        subtext: "Brand-new fingerprint recorded",
      },
      {
        label: "Volume",
        badge: "1st event",
        badgeVariant: "neutral",
        value: eventCount.toLocaleString(),
        unit: "event",
        subtext: "Group created from ingest",
      },
      {
        label: "Impacted",
        badge: "Scope",
        badgeVariant: "neutral",
        value: userCount.toLocaleString(),
        unit: "user",
        subtext: "First affected customer",
      },
    ];
  }

  if (kind === "event_milestone") {
    const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
    const eventCount =
      typeof payload.event_count === "number" ? payload.event_count : threshold;
    const userCount =
      typeof payload.unique_user_count === "number"
        ? payload.unique_user_count
        : null;

    return [
      {
        label: "Milestone",
        badge: "Crossed",
        badgeVariant: "warning",
        value: threshold !== null ? threshold.toLocaleString() : "Milestone",
        unit: "ev",
        subtext: "Threshold trigger hit",
      },
      {
        label: "Cumulative",
        badge: "Total",
        badgeVariant: "neutral",
        value: eventCount !== null ? eventCount.toLocaleString() : "N/A",
        unit: "events",
        subtext: "Total recorded events",
      },
      {
        label: "Impacted",
        badge: "Active",
        badgeVariant: "neutral",
        value: userCount !== null ? userCount.toLocaleString() : "N/A",
        unit: "users",
        subtext: "Unique accounts affected",
      },
    ];
  }

  if (kind === "users_affected") {
    const threshold = typeof payload.threshold === "number" ? payload.threshold : null;
    const userCount =
      typeof payload.unique_user_count === "number"
        ? payload.unique_user_count
        : threshold;
    const eventCount =
      typeof payload.event_count === "number" ? payload.event_count : null;

    return [
      {
        label: "Milestone",
        badge: "Threshold",
        badgeVariant: "warning",
        value: userCount !== null ? userCount.toLocaleString() : "Users",
        unit: "users",
        subtext: threshold ? `Targeted ${threshold} users milestone` : "User blast threshold",
      },
      {
        label: "Volume",
        badge: "Total",
        badgeVariant: "neutral",
        value: eventCount !== null ? eventCount.toLocaleString() : "N/A",
        unit: "events",
        subtext: "Correlated events count",
      },
      {
        label: "Impacted",
        badge: "Scope",
        badgeVariant: "neutral",
        value: "Active",
        subtext: "Customer-facing impact",
      },
    ];
  }

  if (kind === "ingest_cap_hit") {
    const cap = typeof payload.cap_per_hour === "number" ? payload.cap_per_hour : null;
    const projectName =
      typeof payload.project_name === "string" ? payload.project_name : "Project";

    return [
      {
        label: "Quota",
        badge: "Cap reached",
        badgeVariant: "escalating",
        value: cap !== null ? cap.toLocaleString() : "Limit hit",
        unit: "/hr",
        subtext: "Ingest protection limit",
      },
      {
        label: "Status",
        badge: "Dropping",
        badgeVariant: "escalating",
        value: "Rejected",
        subtext: "Rejected until top of hour",
      },
      {
        label: "Target",
        badge: "Scope",
        badgeVariant: "neutral",
        value: projectName,
        subtext: "Protected ingest channel",
      },
    ];
  }

  return [
    {
      label: "Signal",
      badge: "Active",
      badgeVariant: "neutral",
      value: "Recorded",
      subtext: "Processed by alerting engine",
    },
    {
      label: "Rule",
      badge: "Rule",
      badgeVariant: "neutral",
      value: getAlertRuleDisplayName(alert),
      subtext: "Standard evaluation path",
    },
    {
      label: "Impact",
      badge: "Scope",
      badgeVariant: "neutral",
      value: "Observed",
      subtext: "Signal telemetry captured",
    },
  ];
}

function formatCompactTime(iso?: string | null): string {
  if (!iso) return "N/A";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function TelemetrySparkline({
  alert,
  currentEvents,
  previousEvents,
  ratio,
}: {
  alert: AlertRow;
  currentEvents: number;
  previousEvents: number;
  ratio: number | null;
}) {
  const payload = alert.payload_json ?? {};
  const currentEnd = typeof payload.current_window_end_at === "string"
    ? payload.current_window_end_at
    : alert.fired_at;
  const prevStart = typeof payload.previous_window_start_at === "string"
    ? payload.previous_window_start_at
    : null;

  const baselineTime = prevStart
    ? formatCompactTime(prevStart)
    : formatCompactTime(new Date(new Date(alert.fired_at).getTime() - 30 * 60 * 1000).toISOString());
  const spikeTime = formatCompactTime(currentEnd);
  const surgePercent = ratio ? `+${Math.round((ratio - 1) * 100)}%` : null;

  return (
    <Card className="shadow-none border-border-subtle bg-surface-1 rounded-panel p-5 flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          Telemetry Window (Rolling 15m)
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-fg-muted font-mono">
            <span className="size-1.5 rounded-full bg-fg-muted/60" aria-hidden />
            Baseline: {previousEvents.toLocaleString()} ev
          </span>
          <span className="text-fg-muted/40 font-mono" aria-hidden>
            ·
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-semantic-danger font-mono">
            <span className="size-1.5 rounded-full bg-semantic-danger" aria-hidden />
            Spike: {currentEvents.toLocaleString()} ev
          </span>
          {surgePercent ? (
            <Badge variant="escalating" size="compact" className="font-mono tabular-nums ml-1">
              {surgePercent}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="relative h-22 w-full overflow-hidden rounded-md border border-border-subtle/60 bg-surface-2/40 p-2">
        <svg
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 600 68"
        >
          <defs>
            <linearGradient id="alertTelemetryGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--status-escalating)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--status-escalating)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <line
            x1="0"
            x2="600"
            y1="50"
            y2="50"
            stroke="var(--border-strong)"
            strokeDasharray="3,3"
            strokeWidth="1"
            opacity="0.35"
          />
          <line
            x1="0"
            x2="600"
            y1="18"
            y2="18"
            stroke="var(--status-escalating)"
            strokeDasharray="3,3"
            strokeWidth="1"
            opacity="0.45"
          />
          <polygon
            points="0,50 120,49 220,50 320,48 380,44 430,30 470,18 520,20 560,22 600,23 600,68 0,68"
            fill="url(#alertTelemetryGradient)"
          />
          <path
            d="M 0,50 L 120,49 L 220,50 L 320,48 L 380,44 L 430,30 L 470,18 L 520,20 L 560,22 L 600,23"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="470"
            cy="18"
            r="3.5"
            fill="var(--status-escalating)"
            stroke="var(--surface-1)"
            strokeWidth="1.5"
          />
          <circle
            cx="600"
            cy="23"
            r="3"
            fill="var(--accent)"
            stroke="var(--surface-1)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] text-fg-muted pt-1 border-t border-border-subtle/50">
        <span>{baselineTime} (Baseline)</span>
        <span className="font-medium text-semantic-danger">
          {spikeTime} (Spike: {currentEvents.toLocaleString()} ev)
        </span>
        <span className="font-medium text-fg-primary">Live</span>
      </div>
    </Card>
  );
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
  const [outputsOpen, setOutputsOpen] = useState(true);

  if (!alert) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center bg-surface-1",
          className,
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 text-fg-muted shadow-2xs">
          <Icon icon={Bell} size={22} className="text-fg-secondary" aria-hidden />
        </div>
        <h3 className="mt-4 text-sm font-semibold tracking-ui text-fg-primary">
          Select a signal to inspect
        </h3>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-fg-muted">
          Review breach telemetry, root cause, blast radius metrics, dispatch audit, and linked issues.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-fg-muted">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-medium text-fg-secondary">
              J
            </kbd>
            <kbd className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-medium text-fg-secondary">
              K
            </kbd>
            <span className="ml-0.5 text-fg-muted">Navigate</span>
          </span>
          <span className="text-fg-muted/40">·</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-medium text-fg-secondary">
              E
            </kbd>
            <span className="ml-0.5 text-fg-muted">Resolve</span>
          </span>
          <span className="text-fg-muted/40">·</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-medium text-fg-secondary">
              M
            </kbd>
            <span className="ml-0.5 text-fg-muted">Snooze</span>
          </span>
          <span className="text-fg-muted/40">·</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-medium text-fg-secondary">
              C
            </kbd>
            <span className="ml-0.5 text-fg-muted">AI brief</span>
          </span>
        </div>
      </div>
    );
  }

  const structured = getAlertDetailStructuredFields(alert);
  const lifecycle = getAlertLifecycle(alert);
  const alertTitle = getAlertListRuleName(alert);
  const payload = alert.payload_json ?? {};
  const errorHeadline =
    (typeof payload.title === "string" && payload.title.trim()) ||
    getAlertDetailHeadline(alert).trim() ||
    null;
  const impactMetrics = getAlertImpactMetrics(alert);
  const dispatches = getAlertDispatchAuditRows(alert, webhookCount);
  const outputChannels = getAlertOutputChannels(alert, webhookCount);
  const hasDeliveryAudit = alertHasDispatchPayload(alert);
  const deliveredCount = dispatches.filter((row) => row.statusOk).length;
  const pid = alert.project_id || projectId;
  const webhooksPath = pid ? projectSettingsPath(pid, "webhooks") : "/settings";
  const editableRuleId = getAlertEditableRuleId(alert);

  const showIssueSection = structured?.linkedIssue && pid;
  const metricBlocks = getAlertMetricBlocks(alert);

  const outputsCollapsedPreview = hasDeliveryAudit ? getAlertOutputsCollapsedPreview(alert) : null;
  const outputsSummary = hasDeliveryAudit
    ? `${deliveredCount}/${dispatches.length} delivered`
    : webhookCount === 0
      ? "No webhooks"
      : webhookCount === null
        ? "..."
        : `${webhookCount} route${webhookCount === 1 ? "" : "s"}`;

  const environment = typeof payload.environment === "string" ? payload.environment : null;

  return (
    <div className={cn("@container @container/detail flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-1", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {/* Sticky Header with Context & Standardized Actions */}
          <header className="sticky top-0 z-10 shrink-0 border-b border-border-subtle bg-surface-1/95 backdrop-blur-sm">
            {/* Top context bar */}
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border-subtle/60 px-4 py-2 sm:px-6 bg-surface-1">
              <div className="flex shrink-0 items-center gap-2 text-xs text-fg-muted font-mono">
                {onBackToList ? (
                  <ActionButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 lg:hidden mr-1 shrink-0"
                    tooltip="Back to alerts"
                    aria-label="Back to alerts"
                    onClick={onBackToList}
                  >
                    <Icon icon={CaretLeft} size={14} aria-hidden />
                  </ActionButton>
                ) : null}
                <span className="text-fg-muted font-mono text-xs shrink-0">
                  Signal
                </span>
                {environment ? (
                  <>
                    <span className="text-fg-muted/40 shrink-0">/</span>
                    <Badge variant="env" size="compact" className="font-mono shrink-0">
                      {environment}
                    </Badge>
                  </>
                ) : null}
              </div>

              {/* Action buttons cluster: copy for agent, resolve, snooze/unsnooze */}
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <ActionButton
                  variant="ghost"
                  size="sm"
                  className={cn(DETAIL_INLINE_ACTION_CLASS, "px-2 @2xl:px-2.5")}
                  disabled={busy}
                  tooltip="Copy a diagnostic brief for your coding agent (C)"
                  aria-label="Copy a diagnostic brief for your coding agent (C)"
                  onClick={() => {
                    void copyAlertExport(alert, pid).then(() => toast("Copied alert brief for AI"));
                  }}
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  <span className="hidden @2xl:inline">Copy for agent</span>
                </ActionButton>

                {lifecycle === "active" ? (
                  <ActionButton
                    variant="primary"
                    size="sm"
                    className={DETAIL_INLINE_ACTION_CLASS}
                    disabled={busy}
                    tooltip="Resolve (E)"
                    aria-label="Resolve"
                    onClick={onAcknowledge}
                  >
                    <Check className="size-3.5" aria-hidden />
                    <span>Resolve</span>
                  </ActionButton>
                ) : null}

                {lifecycle === "acknowledged" ? (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    className={DETAIL_INLINE_ACTION_CLASS}
                    disabled={busy}
                    tooltip="Mark unread"
                    aria-label="Mark unread"
                    onClick={onReopen}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    <span>Mark unread</span>
                  </ActionButton>
                ) : null}

                {lifecycle !== "muted" ? (
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    className={DETAIL_INLINE_ACTION_CLASS}
                    disabled={busy}
                    tooltip="Snooze (M)"
                    aria-label="Snooze"
                    onClick={onMute}
                  >
                    <BellOff className="size-3.5" aria-hidden />
                  </ActionButton>
                ) : (
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    className={DETAIL_INLINE_ACTION_CLASS}
                    disabled={busy}
                    tooltip="Unsnooze (M)"
                    aria-label="Unsnooze"
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
                    className={DETAIL_INLINE_ACTION_CLASS}
                    disabled={busy}
                    tooltip="Edit rule"
                    aria-label="Edit rule"
                    onClick={() => onEditRule(editableRuleId)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </ActionButton>
                ) : null}
              </div>
            </div>

            {/* Signal Title & Meta Banner */}
            <div className="flex flex-col gap-2.5 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <AlertStateBadge
                  alert={alert}
                  showOpenDuration
                  className="opacity-95 [&_svg]:opacity-90"
                />
                {structured?.kindChip ? (
                  <Badge variant="neutral" size="compact" className="font-mono uppercase tracking-wide">
                    {structured.kindChip}
                  </Badge>
                ) : null}
                <span className="text-fg-muted font-mono text-xs">
                  {formatAlertTimestampPrecise(alert.fired_at).absolute}
                  {" · "}
                  <span className="text-fg-secondary">{formatAlertTimestampPrecise(alert.fired_at).relative}</span>
                </span>
              </div>

              <h2 className="min-w-0 break-words text-xl font-semibold leading-snug tracking-ui text-fg-primary md:text-2xl">
                {alertTitle}
              </h2>

              {editableRuleId && onEditRule ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  <ActionButton
                    variant="link"
                    size="xs"
                    onClick={() => onEditRule(editableRuleId)}
                    tooltip="Configure rule"
                    className="h-auto p-0 font-normal text-fg-muted hover:text-accent hover:underline focus-ring align-baseline"
                  >
                    Configure alert rule
                  </ActionButton>
                </div>
              ) : null}
            </div>
          </header>

          {/* Body Content Stream */}
          <div className="flex flex-col gap-5 p-6">
            {/* 3-Column Blast Radius Metric Strip */}
            <Card className="shadow-none border-border-subtle bg-surface-1 rounded-panel overflow-hidden">
              <div className="grid grid-cols-1 divide-y divide-border-subtle sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
                {metricBlocks.map((block) => (
                  <div key={block.label} className="p-3.5 sm:p-4 flex flex-col justify-between gap-2 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between gap-1.5 min-h-[1.5rem] min-w-0">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted truncate">
                        {block.label}
                      </span>
                      {block.badge ? (
                        <Badge
                          variant={block.badgeVariant ?? "neutral"}
                          size="compact"
                          className="shrink-0 font-mono tabular-nums text-[10px] px-1.5 py-0"
                        >
                          {block.badge}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-baseline gap-1.5 min-w-0 overflow-hidden mt-0.5">
                      <span className="truncate font-mono text-xl sm:text-2xl font-semibold tracking-tight text-fg-primary tabular-nums">
                        {block.value}
                      </span>
                      {block.unit ? (
                        <span className="font-mono text-xs font-normal text-fg-muted shrink-0">
                          {block.unit}
                        </span>
                      ) : null}
                    </div>
                    {block.subtext ? (
                      <div className="text-xs text-fg-muted truncate mt-0.5" title={block.subtext}>
                        {block.subtext}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>

            {/* Telemetry Sparkline Window (for velocity alerts) */}
            {structured?.velocityStats ? (
              <TelemetrySparkline
                alert={alert}
                currentEvents={structured.velocityStats.current}
                previousEvents={structured.velocityStats.previous}
                ratio={structured.velocityStats.ratio}
              />
            ) : null}

            {/* Correlated Root Cause / Linked Issue Card */}
            {showIssueSection && structured?.linkedIssue ? (
              <Card className="shadow-none border-border-subtle bg-surface-1 rounded-panel p-5 flex flex-col gap-3.5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-2 text-fg-muted mt-0.5">
                      <Icon icon={Warning} size={16} className="text-escalating" aria-hidden />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-fg-primary">
                          Issue {structured.linkedIssue.issueShort}
                        </span>
                        <Badge variant="regression" size="compact" className="font-mono">
                          Root cause
                        </Badge>
                      </div>
                      {errorHeadline ? (
                        <h3 className="mt-1.5 text-sm font-semibold text-fg-primary leading-snug break-words">
                          {errorHeadline}
                        </h3>
                      ) : null}
                    </div>
                  </div>

                  <ActionButton
                    variant="secondary"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    tooltip="Open linked issue"
                    aria-label="Investigate issue"
                    asChild
                  >
                    <Link to={projectIssuePath(pid, structured.linkedIssue.issueId)}>
                      <span>Investigate</span>
                      <Icon icon={ArrowSquareOut} size={13} className="text-fg-muted" aria-hidden />
                    </Link>
                  </ActionButton>
                </div>

                {/* Small metrics strip */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border-subtle/60 pt-3 text-xs text-fg-muted">
                  {impactMetrics.events !== null ? (
                    <span className="flex items-center gap-1 font-mono">
                      <span className="text-fg-primary font-medium">{impactMetrics.events.toLocaleString()}</span>
                      <span className="text-fg-muted">events</span>
                    </span>
                  ) : null}
                  {impactMetrics.users !== null ? (
                    <span className="flex items-center gap-1 font-mono">
                      <span className="text-fg-primary font-medium">{impactMetrics.users.toLocaleString()}</span>
                      <span className="text-fg-muted">users</span>
                    </span>
                  ) : null}
                  {structured.linkedIssue.rows
                    .filter((row) => row.label.toLowerCase() !== "issue")
                    .map((row) => (
                      <span key={row.label} className="flex items-center gap-1 font-mono">
                        <span className="text-fg-muted">{row.label}:</span>
                        <span className="text-fg-primary font-medium">{row.value}</span>
                      </span>
                    ))}
                </div>

                {structured.linkedIssue.correlatedIssueIds.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle/40 pt-2.5 font-mono text-xs text-fg-muted">
                    <span className="text-[11px]">Also matched:</span>
                    {structured.linkedIssue.correlatedIssueIds.map((id) => (
                      <Link
                        key={id}
                        to={projectIssuePath(pid, id)}
                        className="focus-ring"
                      >
                        <Badge variant="neutral" size="compact" className="font-mono hover:border-accent">
                          #{id.replace(/-/g, "").slice(0, 8)}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </Card>
            ) : null}

            {/* Trigger Conditions & At a glance */}
            {structured ? (
              <DetailCard title="At a glance">
                <div className="flex flex-col gap-3.5">
                  {structured.triggerExplanation ? (
                    <p className="text-sm leading-relaxed text-fg-secondary [overflow-wrap:anywhere]">
                      {structured.triggerExplanation}
                    </p>
                  ) : null}
                  <DetailKvRows rows={structured.triggerRows} />
                </div>
              </DetailCard>
            ) : null}

            {/* Dispatches Audit (Outputs) */}
            <Card className="shadow-none border-border-subtle bg-surface-1 rounded-panel overflow-hidden">
              <CardHeader className="px-5 py-3.5 border-b border-border-subtle/60 bg-surface-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-between gap-2 px-0 py-0 font-normal hover:bg-transparent"
                  aria-expanded={outputsOpen}
                  onClick={() => setOutputsOpen((open) => !open)}
                >
                  <CardTitle className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                    Outputs
                  </CardTitle>
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge variant="neutral" size="compact" className="font-mono">
                      {outputsSummary}
                    </Badge>
                    <Icon
                      icon={CaretDown}
                      size={14}
                      className={cn("shrink-0 text-fg-muted transition-transform duration-150", outputsOpen && "rotate-180")}
                      aria-hidden
                    />
                  </span>
                </Button>
              </CardHeader>

              {outputsOpen ? (
                <CardContent className="p-5">
                  {hasDeliveryAudit ? (
                    <ul className="divide-y divide-border-subtle/60 rounded-md border border-border-subtle font-mono text-xs bg-surface-2/20 overflow-hidden">
                      {dispatches.map((row) => (
                        <li
                          key={row.id}
                          className="flex min-w-0 flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                        >
                          <div className="flex min-w-0 items-center gap-2.5 text-fg-muted">
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                row.statusOk ? "bg-healthy" : "bg-semantic-danger",
                              )}
                              aria-hidden
                            />
                            <Badge variant="neutral" size="compact" className="font-mono">
                              {row.channel}
                            </Badge>
                            <span className="min-w-0 truncate font-medium text-fg-primary">
                              {row.target}
                            </span>
                          </div>
                          <div className="flex shrink-0 flex-col items-start gap-0.5 pl-4 tabular-nums sm:items-end sm:pl-0">
                            <span className={row.statusOk ? "font-medium text-fg-primary" : "text-semantic-danger font-medium"}>
                              {row.status}
                            </span>
                            <span className="text-[11px] text-fg-muted">{row.timeLabel}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-fg-muted">
                      <span>No direct delivery audit captured for this signal.</span>
                      <Button variant="ghost" size="xs" asChild className="gap-1 px-0 text-fg-secondary hover:text-accent">
                        <Link to={webhooksPath}>
                          <span>Manage webhooks</span>
                          <Icon icon={ArrowSquareOut} size={12} aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              ) : outputsCollapsedPreview ? (
                <CardContent className="px-5 py-3.5 text-xs font-mono text-fg-muted">
                  {outputsCollapsedPreview}
                </CardContent>
              ) : outputChannels.length > 0 ? (
                <CardContent className="px-5 py-3.5 text-xs font-mono text-fg-muted">
                  {outputChannels.map((channel) => channel.label).join(" · ")}
                </CardContent>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
