import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DiscordLogo,
  EnvelopeSimple,
  Icon,
  SlackLogo,
  TelegramLogo,
  WebhooksLogo,
} from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/** Fixed tracks so the checkbox never shifts the name. */
export const ALERT_RULE_ROW_GRID =
  "grid-cols-[16px_minmax(0,1.6fr)_minmax(6.5rem,11rem)_4.75rem_6.75rem_minmax(8.5rem,1.1fr)_2rem] gap-x-4";

export const ALERT_RULE_ROW_MIN_WIDTH = "min-w-[56rem]";

export type AlertRuleChannelProvider = "slack" | "discord" | "telegram" | "email" | "webhook";

const CHANNEL_ICON: Record<AlertRuleChannelProvider, typeof SlackLogo> = {
  slack: SlackLogo,
  discord: DiscordLogo,
  telegram: TelegramLogo,
  email: EnvelopeSimple,
  webhook: WebhooksLogo,
};

export interface AlertRuleRowChannel {
  provider: AlertRuleChannelProvider;
  label: string;
  extra?: number;
}

export interface AlertRuleListRowProps {
  name: string;
  why: string;
  firedCount: number;
  lastTriggered: string;
  channel?: AlertRuleRowChannel | null;
  selected?: boolean;
  bulkSelected?: boolean;
  selectionActive?: boolean;
  paused?: boolean;
  onSelectChange?: (selected: boolean) => void;
  onOpen?: () => void;
  onEdit?: () => void;
  actions?: ReactNode;
}

export function AlertRuleListRow({
  name,
  why,
  firedCount,
  lastTriggered,
  channel,
  selected = false,
  bulkSelected = false,
  paused = false,
  onSelectChange,
  onOpen,
  onEdit,
  actions,
}: AlertRuleListRowProps) {
  const ChannelIcon = channel ? CHANNEL_ICON[channel.provider] : WebhooksLogo;
  return (
    <div
      data-slot="alert-rule-row"
      role="row"
      className={cn(
        "group/row grid w-full items-center px-4 transition-colors",
        ALERT_RULE_ROW_GRID,
        "min-h-[4.5rem]",
        selected && "bg-accent-muted/70",
        bulkSelected && !selected && "bg-accent-muted/50",
        "hover:bg-state-hover",
      )}
      onClick={onOpen}
      onDoubleClick={onEdit}
    >
      <div className="flex size-4 items-center justify-center" onClick={(event) => event.stopPropagation()}>
        {onSelectChange ? (
          <Checkbox
            checked={bulkSelected}
            aria-label={bulkSelected ? `Deselect ${name}` : `Select ${name}`}
            className="pointer-events-auto opacity-100"
            onCheckedChange={(value) => onSelectChange(value === true)}
          />
        ) : null}
      </div>
      <span className={cn("truncate text-sm font-medium", paused ? "text-fg-muted" : "text-fg-primary")}>
        {name}
      </span>
      <Badge variant={paused ? "neutral" : "info"} size="sm" className="w-fit max-w-full truncate">
        {why}
      </Badge>
      <span className="text-right font-mono text-sm tabular-nums text-fg-primary">{firedCount}</span>
      <span className="truncate text-right font-mono text-xs tabular-nums text-fg-secondary">{lastTriggered}</span>
      <div className="flex min-w-0 items-center gap-2">
        {channel ? (
          <>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-secondary">
              <Icon icon={ChannelIcon} size={16} />
            </span>
            <Badge variant="neutral" size="sm" className="min-w-0 truncate">
              {channel.label}
            </Badge>
            {channel.extra ? (
              <Badge variant="neutral" size="sm" className="shrink-0 tabular-nums">
                +{channel.extra}
              </Badge>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-fg-muted">No channel</span>
        )}
      </div>
      <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
        {actions}
      </div>
    </div>
  );
}
