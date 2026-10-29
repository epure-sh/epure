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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

const DESCRIPTION_MAX = 72;

function trimDescription(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= DESCRIPTION_MAX) return trimmed;
  return `${trimmed.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

/** Tracks: bulk checkbox (hover) · toggle · name · equal right cols · actions. */
export const ALERT_RULE_ROW_GRID =
  "grid-cols-[16px_2rem_minmax(0,1.6fr)_minmax(5.5rem,0.9fr)_minmax(5.5rem,0.9fr)_minmax(0,1fr)_2rem] gap-x-4";

export const ALERT_RULE_ROW_MIN_WIDTH = "min-w-[46rem]";

/** Shared alignment for metric / channel header + cell (equal-width tracks). */
export const ALERT_RULE_COL_END = "w-full text-right";

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
  description?: string;
  /** Cooldown / evaluation window label, e.g. "15 min". */
  duration: string;
  /** Relative or absolute last-fired label, e.g. "2h ago". */
  lastFired: string;
  channel?: AlertRuleRowChannel | null;
  selected?: boolean;
  bulkSelected?: boolean;
  /** When any rule is selected, show checkboxes on every row. */
  selectionActive?: boolean;
  /** When true the rule is paused (Switch off). */
  paused?: boolean;
  onSelectChange?: (selected: boolean) => void;
  /** Toggle enabled / paused. */
  onEnabledChange?: (enabled: boolean) => void;
  onOpen?: () => void;
  actions?: ReactNode;
}

export function AlertRuleListRow({
  name,
  description,
  duration,
  lastFired,
  channel,
  selected = false,
  bulkSelected = false,
  selectionActive = false,
  paused = false,
  onSelectChange,
  onEnabledChange,
  onOpen,
  actions,
}: AlertRuleListRowProps) {
  const ChannelIcon = channel ? CHANNEL_ICON[channel.provider] : WebhooksLogo;
  const note = trimDescription(description);
  return (
    <div
      data-slot="alert-rule-row"
      role="row"
      className={cn(
        "group/row grid w-full items-center px-4 py-3.5 transition-colors",
        ALERT_RULE_ROW_GRID,
        "min-h-16",
        selected && "bg-accent-muted/70",
        bulkSelected && !selected && "bg-accent-muted/50",
        "hover:bg-state-hover",
      )}
      onClick={onOpen}
    >
      <div
        className="flex size-4 items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        {onSelectChange ? (
          <Checkbox
            checked={bulkSelected}
            aria-label={bulkSelected ? `Deselect ${name}` : `Select ${name}`}
            className={cn(
              "transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              bulkSelected || selectionActive
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100",
            )}
            onCheckedChange={(value) => onSelectChange(value === true)}
          />
        ) : (
          <span className="size-4" aria-hidden />
        )}
      </div>
      <div className="flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
        {onEnabledChange ? (
          <Switch
            size="compact"
            checked={!paused}
            aria-label={paused ? `Resume ${name}` : `Pause ${name}`}
            onCheckedChange={(checked) => onEnabledChange(checked)}
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("truncate text-sm font-medium leading-tight", paused ? "text-fg-muted" : "text-fg-primary")}>
          {name}
        </span>
        {note ? (
          <span className="truncate text-[11px] leading-snug text-fg-muted" title={description?.trim()}>
            {note}
          </span>
        ) : null}
      </div>
      <span className={cn(ALERT_RULE_COL_END, "truncate font-mono text-xs tabular-nums text-fg-secondary")}>
        {duration}
      </span>
      <span className={cn(ALERT_RULE_COL_END, "truncate font-mono text-xs tabular-nums text-fg-secondary")}>
        {lastFired}
      </span>
      <div className={cn(ALERT_RULE_COL_END, "flex min-w-0 items-center justify-end gap-2")}>
        {channel ? (
          <>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-secondary">
              <Icon icon={ChannelIcon} size={14} />
            </span>
            <Badge variant="neutral" size="sm" className="min-w-0 max-w-full truncate">
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
