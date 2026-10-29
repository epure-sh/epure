/**
 * AlertExecutionPipeline — fixed vertical Trigger → Conditions → Channels.
 * Static layout + simple SVG curves. No pan, zoom, or drag.
 * Orbit zone: Box/Text only for layout; SVG hosts keep connector geometry.
 */
import type { ReactNode } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { Icon, Check, EnvelopeSimple, Hash, Radio as RadioIcon, WebhooksLogo, Bell } from "@/components/ui/icon";
import type { AlertRow } from "@/lib/api";
import {
  getAlertDispatchAuditRows,
  getAlertImpactMetrics,
  getAlertListRuleName,
  type AlertDispatchAuditRow,
} from "@/features/alerts/alert-utils";
import {
  COMPARE_LABEL,
  COUNT_WINDOWS,
  OP_LABEL,
  TRIGGER_LABEL,
  USER_WINDOWS,
  draftFromAlert,
  fieldLabel,
  type AlertCondition,
  type AlertTrigger,
} from "@/components/kit/create-alert-rule-model";
import "./alert-execution-pipeline.css";

export interface AlertExecutionPipelineProps {
  alert: AlertRow;
  webhookCount?: number | null;
}

const EDGE = "color-mix(in srgb, var(--fg-muted) 48%, transparent)";

function smoothV(x0: number, y0: number, x1: number, y1: number): string {
  const dy = Math.max((y1 - y0) * 0.5, 10);
  return `M ${x0} ${y0} C ${x0} ${y0 + dy}, ${x1} ${y1 - dy}, ${x1} ${y1}`;
}

function StageHeader({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "ok" | "hot";
}) {
  const dotBg =
    tone === "ok"
      ? "background-success"
      : tone === "hot"
        ? "background-danger"
        : "background-secondary";
  return (
    <Box alignItems="center" columnGap="xs" marginBottom="xs">
      <Box
        width={6}
        height={6}
        flexShrink={0}
        borderRadius="full"
        backgroundColor={dotBg}
        aria-hidden
      />
      <Text as="p" variant="caption" color="muted" monospace>
        {label}
      </Text>
    </Box>
  );
}

function StageCard({ children }: { children: ReactNode }) {
  return (
    <Box
      flexDirection="column"
      rowGap="xs"
      minWidth={0}
      borderRadius="s"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
      padding="s"
    >
      {children}
    </Box>
  );
}

function MonoPill({ children }: { children: ReactNode }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      maxWidth="100%"
      borderRadius="s"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-secondary"
      paddingHorizontal="xs"
      paddingVertical="none"
    >
      <Text as="span" variant="caption" monospace tabularNums truncate>
        {children}
      </Text>
    </Box>
  );
}

function triggerMetricLine(
  alert: AlertRow,
  trigger: AlertTrigger,
): { primary: string; threshold: string | null } {
  const payload = alert.payload_json ?? {};
  const { events } = getAlertImpactMetrics(alert);
  const current =
    typeof payload.current_window === "number" ? payload.current_window : events;

  if (trigger.type === "issue_new") {
    return { primary: TRIGGER_LABEL.issue_new, threshold: null };
  }

  const windows = trigger.type === "users_affected" ? USER_WINDOWS : COUNT_WINDOWS;
  const windowText =
    windows.find((item) => item.id === trigger.window)?.label ?? trigger.window;
  const live =
    current !== null
      ? `${current.toLocaleString()} in ${windowText}`
      : `${TRIGGER_LABEL[trigger.type]} in ${windowText}`;
  const threshold = `Threshold ${COMPARE_LABEL[trigger.op]} ${trigger.threshold}`;
  return { primary: live, threshold };
}

function conditionText(condition: AlertCondition): string {
  const hideValue = condition.op === "exists" || condition.op === "is_not_null";
  const op = OP_LABEL[condition.op] ?? condition.op;
  if (hideValue) {
    return `${fieldLabel(condition.field)} ${op}`;
  }
  return `${fieldLabel(condition.field)} ${op} ${condition.value || "—"}`;
}

function channelGlyph(channel: string) {
  const key = channel.toLowerCase();
  if (key.includes("slack")) return Hash;
  if (key.includes("discord") || key.includes("telegram")) return RadioIcon;
  if (key.includes("email") || key.includes("mail")) return EnvelopeSimple;
  if (key.includes("feed") || key.includes("alert")) return Bell;
  return WebhooksLogo;
}

/** Plain vertical connector. */
function VBridge() {
  return (
    <Box
      width="100%"
      height={24}
      alignItems="center"
      justifyContent="center"
      aria-hidden
    >
      <svg
        viewBox="0 0 2 24"
        width={1}
        height={24}
        style={{ overflow: "visible" }}
        fill="none"
      >
        <path
          d={smoothV(1, 0, 1, 24)}
          stroke={EDGE}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </Box>
  );
}

/** Soft fan into a horizontal destination row. */
function FanDown({ count }: { count: number }) {
  const n = Math.max(count, 1);
  const width = 160;
  const height = 24;
  const midX = width / 2;
  const xs = Array.from({ length: n }, (_, i) =>
    n === 1 ? midX : 20 + (i * (width - 40)) / Math.max(n - 1, 1),
  );

  return (
    <Box
      width="100%"
      height={24}
      alignItems="center"
      justifyContent="center"
      aria-hidden
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={24}
        style={{ maxWidth: "14rem", overflow: "visible" }}
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d={`M ${midX} 0 L ${midX} 8`}
          stroke={EDGE}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        {xs.map((x, i) => (
          <path
            key={i}
            d={smoothV(midX, 8, x, height)}
            stroke={EDGE}
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </Box>
  );
}

function DestinationCard({ row }: { row: AlertDispatchAuditRow }) {
  const Glyph = channelGlyph(row.channel);
  return (
    <Box
      flex={1}
      flexBasis={0}
      minWidth={0}
      alignItems="center"
      columnGap="xs"
      borderRadius="s"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
      paddingHorizontal="s"
      paddingVertical="xs"
    >
      <Box
        width={6}
        height={6}
        flexShrink={0}
        borderRadius="full"
        backgroundColor={row.statusOk ? "background-success" : "background-danger"}
        aria-hidden
      />
      <Box flexShrink={0} color="text-secondary">
        <Icon icon={Glyph} size={11} aria-hidden />
      </Box>
      <Box flexDirection="column" minWidth={0} rowGap="none">
        <Text as="p" variant="caption" truncate>
          {row.channel}
        </Text>
        <Text
          as="p"
          variant="caption"
          color={row.statusOk ? "muted" : "danger"}
          monospace
          truncate
        >
          {row.target} · {row.status}
        </Text>
      </Box>
    </Box>
  );
}

export function AlertExecutionPipeline({
  alert,
  webhookCount = null,
}: AlertExecutionPipelineProps) {
  const draft = draftFromAlert(alert);
  const trigger = draft.triggers[0] ?? ({ type: "issue_new" } as AlertTrigger);
  const conditions = draft.conditions;
  const ruleName = getAlertListRuleName(alert);
  const metric = triggerMetricLine(alert, trigger);
  const channels = getAlertDispatchAuditRows(alert, webhookCount).slice(0, 6);
  const channelRows =
    channels.length > 0
      ? channels
      : [
          {
            id: "feed",
            channel: "Alerts feed",
            target: "In-app",
            status: "Recorded",
            statusOk: true,
            timeLabel: "",
          } satisfies AlertDispatchAuditRow,
        ];

  const matchAll = draft.match !== "any";
  const gateLabel = matchAll ? "All matched" : "Any matched";
  const payload = alert.payload_json ?? {};
  const cooldown =
    typeof payload.cooldown_minutes === "number" ? payload.cooldown_minutes : null;
  const duplicatesBlocked =
    typeof payload.duplicates_blocked === "number" ? payload.duplicates_blocked : null;

  return (
    <Box
      as="section"
      data-slot="alert-execution-pipeline"
      flexDirection="column"
      height="100%"
      width="100%"
      minWidth={0}
      overflow="hidden"
      borderRadius="s"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-secondary"
      aria-label="Pipeline"
    >
      <Box
        as="header"
        flexShrink={0}
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor="background-card"
        paddingHorizontal="m"
        paddingVertical="s"
      >
        <Text as="h3" variant="label">
          Pipeline
        </Text>
      </Box>

      <Box
        flex={1}
        flexDirection="column"
        alignItems="stretch"
        justifyContent="between"
        rowGap="s"
        paddingHorizontal="s"
        paddingVertical="m"
      >
        <Box minWidth={0}>
          <StageHeader label="Triggered" tone="hot" />
          <StageCard>
            <Text as="p" variant="caption">
              {ruleName}
            </Text>
            <Box flexWrap="wrap" columnGap="xs" rowGap="xs">
              <MonoPill>{metric.primary}</MonoPill>
              {metric.threshold ? <MonoPill>{metric.threshold}</MonoPill> : null}
            </Box>
          </StageCard>
        </Box>

        <VBridge />

        <Box minWidth={0}>
          <StageHeader label={gateLabel} tone="ok" />
          <Box flexDirection="column" rowGap="xs">
            {conditions.length > 0 ? (
              conditions.map((condition, index) => (
                <Box
                  key={`${condition.field}-${index}`}
                  minWidth={0}
                  alignItems="start"
                  columnGap="xs"
                  borderRadius="s"
                  borderWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                  backgroundColor="background-card"
                  paddingHorizontal="s"
                  paddingVertical="xs"
                >
                  <Box flexShrink={0} marginTop="xs" color="text-success">
                    <Icon icon={Check} size={12} weight="bold" aria-hidden />
                  </Box>
                  <Text as="span" variant="caption" monospace>
                    {conditionText(condition)}
                  </Text>
                </Box>
              ))
            ) : (
              <StageCard>
                <Text as="p" variant="caption" color="muted">
                  No filters
                </Text>
              </StageCard>
            )}
            {cooldown !== null || duplicatesBlocked !== null ? (
              <Text as="p" variant="caption" color="muted" monospace>
                {cooldown !== null ? `${cooldown}m cooldown` : null}
                {cooldown !== null && duplicatesBlocked !== null ? " · " : null}
                {duplicatesBlocked !== null ? `${duplicatesBlocked} suppressed` : null}
              </Text>
            ) : null}
          </Box>
        </Box>

        <FanDown count={channelRows.length} />

        <Box minWidth={0}>
          <StageHeader label={`Sent to (${channelRows.length})`} tone="ok" />
          <Box minWidth={0} alignItems="stretch" columnGap="xs" flexWrap="nowrap">
            {channelRows.map((row) => (
              <DestinationCard key={row.id} row={row} />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
