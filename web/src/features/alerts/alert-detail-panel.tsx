import type { ReactNode } from "react";
import {
  BellOff,
  BellRing,
  Check,
  Pencil,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { AlertRow } from "../../lib/api";
import { projectIssuePath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { ActionButton } from "@/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Icon, ArrowSquareOut, CaretLeft, Bell } from "@/components/ui/icon";
import { DETAIL_INLINE_ACTION_CLASS } from "@/ui/issue-detail-tabs";
import { toast } from "@/components/ui/sonner";
import { copyAlertExport } from "./export-markdown";
import { Card } from "@/ui/card";
import { AlertExecutionPipeline } from "@/components/kit/alert-execution-pipeline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAlertDetailStructuredFields,
  getAlertEditableRuleId,
  getAlertLifecycle,
  getAlertListRuleName,
  getAlertKindChipLabel,
  getAlertRelatedIssueRows,
  getAlertImpactMetrics,
} from "./alert-utils";
import {
  AlertDetailContextGrid,
  AlertDetailCrashRequestRow,
  AlertDetailStackBlock,
  alertActionEnabled,
  getAlertPayloadOptions,
} from "./alert-detail-payload-blocks";

interface MetricBlock {
  key: string;
  label: string;
  value: string;
  meta: ReactNode;
}

/** Overview-style flush 2×2 cells — Events / Users / Environment / Release. */
function getAlertMetricBlocks(alert: AlertRow): MetricBlock[] {
  const payload = alert.payload_json ?? {};
  const { events, users } = getAlertImpactMetrics(alert);
  const blocks: MetricBlock[] = [];

  const current =
    typeof payload.current_window === "number" ? payload.current_window : null;
  const previous =
    typeof payload.previous_window === "number" ? payload.previous_window : null;
  const ratio = typeof payload.ratio === "number" ? payload.ratio : null;
  const env = typeof payload.environment === "string" ? payload.environment.trim() : "";
  const release = typeof payload.release === "string" ? payload.release.trim() : "";

  if (current !== null) {
    blocks.push({
      key: "events",
      label: "Events",
      value: current.toLocaleString(),
      meta: (
        <Text variant="caption" color="muted">
          {previous !== null
            ? `Prior ${previous.toLocaleString()}${ratio !== null ? ` · ${ratio.toFixed(1)}×` : ""}`
            : "15m window"}
        </Text>
      ),
    });
  } else if (events !== null) {
    blocks.push({
      key: "events",
      label: "Events",
      value: events.toLocaleString(),
      meta: (
        <Text variant="caption" color="muted">
          Total events
        </Text>
      ),
    });
  }

  if (users !== null) {
    blocks.push({
      key: "users",
      label: "Affected users",
      value: users.toLocaleString(),
      meta: (
        <Text variant="caption" color="muted">
          Unique users
        </Text>
      ),
    });
  }

  if (env) {
    blocks.push({
      key: "environment",
      label: "Environment",
      value: env,
      meta: (
        <Text variant="caption" color="muted">
          Runtime
        </Text>
      ),
    });
  }

  if (release) {
    blocks.push({
      key: "release",
      label: "Release",
      value: release,
      meta: (
        <Text variant="caption" color="muted">
          Deploy
        </Text>
      ),
    });
  }

  return blocks.slice(0, 4);
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
  if (!alert) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center bg-surface-1 p-8 text-center",
          className,
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-xl border border-border-subtle bg-surface-1 text-fg-muted shadow-xs">
          <Icon icon={Bell} size={22} className="text-fg-secondary" aria-hidden />
        </div>
        <h3 className="mt-4 text-sm font-semibold tracking-ui text-fg-primary">
          Select a signal to inspect
        </h3>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-fg-muted">
          Pick an alert from the inbox to see why it fired and where it notified.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-fg-muted">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle bg-surface-1 px-1.5 py-0.5 font-medium text-fg-secondary">
              J
            </kbd>
            <kbd className="rounded border border-border-subtle bg-surface-1 px-1.5 py-0.5 font-medium text-fg-secondary">
              K
            </kbd>
            <span className="ml-0.5 text-fg-muted">Navigate</span>
          </span>
          <span className="text-fg-muted/40">·</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle bg-surface-1 px-1.5 py-0.5 font-medium text-fg-secondary">
              E
            </kbd>
            <span className="ml-0.5 text-fg-muted">Resolve</span>
          </span>
          <span className="text-fg-muted/40">·</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle bg-surface-1 px-1.5 py-0.5 font-medium text-fg-secondary">
              M
            </kbd>
            <span className="ml-0.5 text-fg-muted">Snooze</span>
          </span>
        </div>
      </div>
    );
  }

  const structured = getAlertDetailStructuredFields(alert);
  const lifecycle = getAlertLifecycle(alert);
  const alertTitle = getAlertListRuleName(alert);
  const payload = alert.payload_json ?? {};
  const pid = alert.project_id || projectId;
  const editableRuleId = getAlertEditableRuleId(alert);
  const metricBlocks = getAlertMetricBlocks(alert);
  const relatedIssues = getAlertRelatedIssueRows(alert);
  const payloadOptions = getAlertPayloadOptions(alert);
  const showCopy = alertActionEnabled(payloadOptions, "action:fix");
  const showResolve = alertActionEnabled(payloadOptions, "action:resolve");
  const showMute = alertActionEnabled(payloadOptions, "action:mute");
  const showOpenIssue = alertActionEnabled(payloadOptions, "action:view");
  const environment = typeof payload.environment === "string" ? payload.environment : null;
  const kindChip =
    structured?.kindChip ||
    getAlertKindChipLabel(
      alert.kind === "custom" && typeof payload.rule_kind === "string"
        ? payload.rule_kind
        : alert.kind,
    );
  const primaryIssueId = relatedIssues[0]?.issueId ?? alert.issue_id ?? null;

  return (
    <div
      className={cn(
        "@container @container/detail flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-1",
        className,
      )}
    >
      <header className="shrink-0 border-b border-border-subtle bg-surface-1">
        <div className="flex min-w-0 items-center justify-between gap-2 px-4 py-2 sm:px-6">
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
            <span className="text-fg-muted font-mono text-xs shrink-0">Signal</span>
            {environment ? (
              <>
                <span className="text-fg-muted/40 shrink-0">/</span>
                <Badge variant="env" size="compact" className="font-mono shrink-0">
                  {environment}
                </Badge>
              </>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {showOpenIssue && primaryIssueId ? (
              <ActionButton
                variant="ghost"
                size="sm"
                className={cn(DETAIL_INLINE_ACTION_CLASS, "px-2 @2xl:px-2.5")}
                tooltip="Open issue"
                aria-label="Open issue"
                asChild
              >
                <Link to={projectIssuePath(pid, primaryIssueId)}>
                  <Icon icon={ArrowSquareOut} size={14} aria-hidden />
                  <span className="hidden @2xl:inline">Open issue</span>
                </Link>
              </ActionButton>
            ) : null}

            {showCopy ? (
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
            ) : null}

            {showResolve && lifecycle === "active" ? (
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

            {showMute && lifecycle !== "muted" ? (
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
            ) : null}

            {showMute && lifecycle === "muted" ? (
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
            ) : null}

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

        <div className="flex flex-wrap items-center gap-2.5 px-6 pb-5 pt-3">
          <h2 className="min-w-0 break-words text-xl font-semibold leading-snug tracking-ui text-fg-primary md:text-2xl">
            {alertTitle}
          </h2>
          {kindChip ? (
            <Badge variant="neutral" size="compact" className="font-mono uppercase tracking-wide">
              {kindChip}
            </Badge>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
        {/*
          Top band: left column = metrics grid + crash|request row;
          right column = pipeline stretched to that full left height.
          Below: full-width stack, then context grid + related issues.
        */}
        <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-stretch">
          <div className="flex min-w-0 flex-col gap-3">
            {metricBlocks.length > 0 ? (
              <Box
                data-slot="alert-metrics-grid"
                borderRadius="s"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
                backgroundColor="background-primary"
                overflow="hidden"
                width="100%"
              >
                <Box
                  display="grid"
                  gridTemplateColumns={metricBlocks.length === 1 ? "1fr" : "1fr 1fr"}
                  width="100%"
                >
                  {metricBlocks.map((cell, index) => {
                    const cols = metricBlocks.length === 1 ? 1 : 2;
                    const row = Math.floor(index / cols);
                    const rows = Math.ceil(metricBlocks.length / cols);
                    const showRight =
                      cols === 2 && index % 2 === 0 && index + 1 < metricBlocks.length;
                    const showBottom = row < rows - 1;
                    return (
                      <Box
                        key={cell.key}
                        paddingHorizontal="s"
                        paddingVertical="s"
                        flexDirection="column"
                        rowGap="xs"
                        justifyContent="between"
                        minHeight={64}
                        textAlign="left"
                        backgroundColor="background-primary"
                        borderRightWidth={showRight ? 1 : 0}
                        borderBottomWidth={showBottom ? 1 : 0}
                        borderStyle="solid"
                        borderColor="border-primary"
                      >
                        <Text variant="caption" color="muted">
                          {cell.label}
                        </Text>
                        <span className="truncate text-sm font-semibold tabular-nums tracking-tight text-fg-primary">
                          {cell.value}
                        </span>
                        {cell.meta}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ) : null}

            <AlertDetailCrashRequestRow alert={alert} />
          </div>

          <AlertExecutionPipeline alert={alert} webhookCount={webhookCount} />
        </div>

        <AlertDetailStackBlock alert={alert} />

        <AlertDetailContextGrid alert={alert} />

        {relatedIssues.length > 0 ? (
          <Card className="w-full shrink-0 overflow-hidden rounded-md border-border-subtle bg-surface-1 p-0 shadow-none">
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3.5 py-2.5">
              <h3 className="text-sm font-semibold tracking-ui text-fg-primary">
                Related issues
              </h3>
              <span className="font-mono text-[10px] tabular-nums text-fg-muted">
                {relatedIssues.length}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-transparent hover:bg-transparent">
                  <TableHead className="h-8 px-3.5 text-[10px] font-medium uppercase tracking-wide">
                    Title
                  </TableHead>
                  <TableHead className="h-8 px-3 text-right text-[10px] font-medium uppercase tracking-wide">
                    Events
                  </TableHead>
                  <TableHead className="h-8 px-3 text-right text-[10px] font-medium uppercase tracking-wide">
                    Users
                  </TableHead>
                  <TableHead className="h-8 w-12 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedIssues.map((row) => (
                  <TableRow
                    key={row.issueId}
                    className="border-transparent hover:bg-surface-2/35"
                  >
                    <TableCell className="min-w-[10rem] whitespace-normal break-words px-3.5 py-2.5 text-xs text-fg-primary">
                      {row.title ?? "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-fg-secondary">
                      {row.events !== null ? row.events.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-fg-secondary">
                      {row.users !== null ? row.users.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="px-2 py-2.5 text-right">
                      <ActionButton
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        tooltip="Open issue"
                        aria-label={`Open issue ${row.issueShort}`}
                        asChild
                      >
                        <Link to={projectIssuePath(pid, row.issueId)}>
                          <Icon icon={ArrowSquareOut} size={13} className="text-fg-muted" aria-hidden />
                        </Link>
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
