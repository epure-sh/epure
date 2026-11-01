import type { ReactNode } from "react";
import { BellOff, BellRing, Check, Pencil, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { AlertRow } from "../../lib/api";
import { projectIssuePath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { ActionButton, Card } from "@/ui/components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon, ArrowSquareOut, CaretLeft, Bell } from "@/components/ui/icon";
import { toast } from "@/components/ui/sonner";
import { copyAlertExport } from "./export-markdown";
import { AlertExecutionPipeline } from "@/components/kit/alert-execution-pipeline";
import { CopyForAgentsButton } from "@/components/kit/copy-for-agents-button";
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
          "flex min-h-0 flex-1 flex-col items-center justify-center rounded-lg bg-surface-1 p-8 text-center",
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
              C
            </kbd>
            <span className="ml-0.5 text-fg-muted">Copy for agent</span>
          </span>
          <span className="text-fg-muted/40">·</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle bg-surface-1 px-1.5 py-0.5 font-medium text-fg-secondary">
              M
            </kbd>
            <span className="ml-0.5 text-fg-muted">Ignore</span>
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
  const showCopy = alertActionEnabled(payloadOptions, "action:copy");
  const showResolve = alertActionEnabled(payloadOptions, "action:resolve");
  const showMute = alertActionEnabled(payloadOptions, "action:mute");
  const kindChip =
    structured?.kindChip ||
    getAlertKindChipLabel(
      alert.kind === "custom" && typeof payload.rule_kind === "string"
        ? payload.rule_kind
        : alert.kind,
    );
  const showEditRule = Boolean(canManageRules && editableRuleId && onEditRule);

  return (
    <div
      className={cn(
        "@container @container/detail flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-surface-1",
        className,
      )}
    >
      <header className="shrink-0 rounded-t-lg border-b border-border-subtle bg-surface-1">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-4 sm:px-6">
          {onBackToList ? (
            <ActionButton
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 lg:hidden"
              tooltip="Back to alerts"
              aria-label="Back to alerts"
              onClick={onBackToList}
            >
              <Icon icon={CaretLeft} size={14} aria-hidden />
            </ActionButton>
          ) : null}
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
          Pipeline canvas first — full width, fixed band height (~former side column).
          Everything else stacks underneath in reading order.
        */}
        <div className="w-full min-w-0 shrink-0">
          <AlertExecutionPipeline alert={alert} webhookCount={webhookCount} />
        </div>

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
            flexShrink={0}
          >
            <Box
              display="grid"
              gridTemplateColumns={
                metricBlocks.length === 1
                  ? "1fr"
                  : metricBlocks.length === 2
                    ? "1fr 1fr"
                    : "repeat(2, minmax(0, 1fr))"
              }
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
                      {row.title ?? "-"}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-fg-secondary">
                      {row.events !== null ? row.events.toLocaleString() : "-"}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-fg-secondary">
                      {row.users !== null ? row.users.toLocaleString() : "-"}
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
      <footer className="flex shrink-0 items-center justify-start gap-2 rounded-b-lg border-t border-border-subtle bg-surface-1 px-4 py-3 sm:px-6">
        {showResolve && lifecycle === "active" ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="h-8 gap-1.5 rounded-full"
            disabled={busy}
            aria-label="Resolve (E)"
            onClick={onAcknowledge}
          >
            <Check className="size-3.5" aria-hidden />
            <span>Resolve</span>
          </Button>
        ) : null}
        {lifecycle === "acknowledged" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-full border-border"
            disabled={busy}
            aria-label="Unresolve"
            onClick={onReopen}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            <span>Unresolve</span>
          </Button>
        ) : null}
        {showCopy ? (
          <CopyForAgentsButton
            disabled={busy}
            title="Copy a diagnostic brief for your coding agent (C)"
            onClick={() => {
              void copyAlertExport(alert, pid).then(() => toast("Copied alert brief for AI"));
            }}
          />
        ) : null}
        {showMute && lifecycle !== "muted" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-full"
            disabled={busy}
            aria-label="Ignore (M)"
            onClick={onMute}
          >
            <BellOff className="size-3.5" aria-hidden />
            <span>Ignore</span>
          </Button>
        ) : null}
        {showMute && lifecycle === "muted" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-full"
            disabled={busy}
            aria-label="Unignore (M)"
            onClick={onUnmute}
          >
            <BellRing className="size-3.5" aria-hidden />
            <span>Unignore</span>
          </Button>
        ) : null}
        {showEditRule ? (
          <ActionButton
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-full"
            disabled={busy}
            tooltip="Edit rule"
            aria-label="Edit rule"
            onClick={() => onEditRule?.(editableRuleId!)}
          >
            <Pencil className="size-3.5" aria-hidden />
          </ActionButton>
        ) : null}
      </footer>
    </div>
  );
}
