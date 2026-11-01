/**
 * AlertExecutionPipeline — node canvas:
 * source group (real trigger + conditions) → one fan-out to each channel.
 */
import { useMemo, type ReactNode } from "react";
import {
  Icon,
  type IconType,
  Bell,
  Check,
  EnvelopeSimple,
  Flame,
  Hash,
  Radio as RadioIcon,
  SlackLogo,
  SlidersHorizontal,
  TrendUp,
  Users,
  Warning,
  WebhooksLogo,
} from "@/components/ui/icon";
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
import { cn } from "@/lib/cn";
import "./alert-execution-pipeline.css";

export interface AlertExecutionPipelineProps {
  alert: AlertRow;
  webhookCount?: number | null;
}

type PipelineNode = {
  id: string;
  title: string;
  subtitle: string;
  icon: IconType;
  tone: "trigger" | "condition" | "channel";
  ok?: boolean;
};

/** Title = real trigger kind; subtitle = live reading + threshold. */
function triggerCopy(
  alert: AlertRow,
  trigger: AlertTrigger,
): { title: string; subtitle: string } {
  const title = TRIGGER_LABEL[trigger.type];
  const payload = alert.payload_json ?? {};
  const { events, users } = getAlertImpactMetrics(alert);
  const current =
    typeof payload.current_window === "number" ? payload.current_window : null;

  if (trigger.type === "issue_new") {
    return {
      title,
      subtitle: "Fires on the first event of a new issue",
    };
  }

  if (trigger.type === "issue_count") {
    const windowText =
      COUNT_WINDOWS.find((item) => item.id === trigger.window)?.label ?? trigger.window;
    const live = current ?? events;
    const liveText =
      live !== null ? `${live.toLocaleString()} events in ${windowText}` : `Window ${windowText}`;
    return {
      title,
      subtitle: `${liveText} · ${COMPARE_LABEL[trigger.op]} ${trigger.threshold}`,
    };
  }

  const windowText =
    USER_WINDOWS.find((item) => item.id === trigger.window)?.label ?? trigger.window;
  const live = users;
  const liveText =
    live !== null ? `${live.toLocaleString()} users · ${windowText}` : `Window ${windowText}`;
  return {
    title,
    subtitle: `${liveText} · ${COMPARE_LABEL[trigger.op]} ${trigger.threshold}`,
  };
}

function conditionCopy(condition: AlertCondition): { title: string; subtitle: string } {
  const hideValue = condition.op === "exists" || condition.op === "is_not_null";
  const op = OP_LABEL[condition.op] ?? condition.op;
  return {
    title: fieldLabel(condition.field),
    subtitle: hideValue ? op : `${op} ${condition.value || "-"}`,
  };
}

function channelGlyph(channel: string): IconType {
  const key = channel.toLowerCase();
  if (key.includes("slack")) return SlackLogo;
  if (key.includes("discord") || key.includes("telegram")) return RadioIcon;
  if (key.includes("email") || key.includes("mail")) return EnvelopeSimple;
  if (key.includes("pager") || key.includes("incident")) return Flame;
  if (key.includes("feed") || key.includes("alert")) return Bell;
  if (key.includes("hash") || key.includes("#")) return Hash;
  return WebhooksLogo;
}

function triggerGlyph(trigger: AlertTrigger): IconType {
  if (trigger.type === "users_affected") return Users;
  if (trigger.type === "issue_new") return Bell;
  if (trigger.type === "issue_count") return TrendUp;
  return Warning;
}

function NodeCard({ node }: { node: PipelineNode }) {
  return (
    <div
      data-slot="alert-pipeline-node"
      data-tone={node.tone}
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 px-3",
        node.tone === "channel" ? "py-2.5" : "py-2",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          node.tone === "trigger" && "bg-semantic-danger/10 text-semantic-danger",
          node.tone === "condition" && "bg-surface-2 text-fg-secondary",
          node.tone === "channel" &&
            (node.ok === false
              ? "bg-semantic-danger/10 text-semantic-danger"
              : "bg-surface-2 text-fg-secondary"),
        )}
        aria-hidden
      >
        <Icon
          icon={node.icon}
          size={15}
          weight={node.tone === "condition" ? "bold" : "regular"}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight tracking-ui text-fg-primary">
          {node.title}
        </p>
        <p className="mt-0.5 truncate text-xs leading-snug text-fg-muted">{node.subtitle}</p>
      </div>
      {node.tone === "condition" ? (
        <span className="shrink-0 text-semantic-success" aria-hidden>
          <Icon icon={Check} size={13} weight="bold" />
        </span>
      ) : null}
    </div>
  );
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 px-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-fg-muted">
      {children}
    </p>
  );
}

/** One exit from the source group, fanning to every channel card. */
function FanEdges({
  count,
  tones,
}: {
  count: number;
  tones: Array<"active" | "muted">;
}) {
  const n = Math.max(count, 1);
  return (
    <svg
      className="absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {Array.from({ length: n }, (_, i) => {
        const y1 = n === 1 ? 50 : ((i + 0.5) / n) * 100;
        const dx = 42;
        return (
          <path
            key={i}
            data-slot="alert-pipeline-edge"
            data-tone={tones[i] ?? "active"}
            vectorEffect="non-scaling-stroke"
            d={`M 0 50 C ${dx} 50, ${100 - dx} ${y1}, 100 ${y1}`}
          />
        );
      })}
    </svg>
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
  const matchAll = draft.match !== "any";

  const channelRows = useMemo<AlertDispatchAuditRow[]>(() => {
    const channels = getAlertDispatchAuditRows(alert, webhookCount).slice(0, 5);
    if (channels.length > 0) return channels;
    return [
      {
        id: "feed",
        channel: "Alerts feed",
        target: "In-app",
        status: "Recorded",
        statusOk: true,
        timeLabel: "",
      },
    ];
  }, [alert, webhookCount]);

  const sourceNodes = useMemo<PipelineNode[]>(() => {
    const trig = triggerCopy(alert, trigger);
    const nodes: PipelineNode[] = [
      {
        id: "trigger",
        title: trig.title,
        subtitle: trig.subtitle,
        icon: triggerGlyph(trigger),
        tone: "trigger",
      },
    ];
    if (conditions.length === 0) {
      nodes.push({
        id: "condition-none",
        title: "No filters",
        subtitle: matchAll ? "Always matched" : "Any matched",
        icon: SlidersHorizontal,
        tone: "condition",
      });
    } else {
      conditions.forEach((condition, index) => {
        const copy = conditionCopy(condition);
        nodes.push({
          id: `condition-${index}`,
          title: copy.title,
          subtitle: copy.subtitle,
          icon: SlidersHorizontal,
          tone: "condition",
        });
      });
    }
    return nodes;
  }, [alert, trigger, conditions, matchAll]);

  const destNodes = useMemo<PipelineNode[]>(
    () =>
      channelRows.map((row) => ({
        id: row.id,
        title: row.channel,
        subtitle: `${row.target} · ${row.status}`,
        icon: channelGlyph(row.channel),
        tone: "channel" as const,
        ok: row.statusOk,
      })),
    [channelRows],
  );

  const edgeTones = destNodes.map((node) =>
    node.ok === false ? ("muted" as const) : ("active" as const),
  );

  return (
    <section
      data-slot="alert-execution-pipeline"
      aria-label="Pipeline"
      className="flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-border-subtle"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-1 px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-ui text-fg-primary">Pipeline</h3>
          <p className="mt-0.5 truncate text-xs text-fg-muted">{ruleName}</p>
        </div>
        <p className="shrink-0 font-mono text-[10px] tabular-nums text-fg-muted">
          {destNodes.length} channel{destNodes.length === 1 ? "" : "s"}
        </p>
      </header>

      <div data-slot="alert-pipeline-canvas" className="relative overflow-hidden">
        <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(4.5rem,6rem)_minmax(0,1fr)] sm:items-stretch sm:gap-x-0 sm:p-5">
          <div className="flex min-w-0 flex-col justify-center">
            <ColumnLabel>Trigger & conditions</ColumnLabel>
            <div
              data-slot="alert-pipeline-source-group"
              className="flex flex-col gap-2 p-2"
            >
              {sourceNodes.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
            </div>
          </div>

          <div className="relative hidden self-stretch sm:block" aria-hidden>
            <FanEdges count={destNodes.length} tones={edgeTones} />
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <ColumnLabel>Output channels</ColumnLabel>
            <div className="flex flex-col gap-2.5">
              {destNodes.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
