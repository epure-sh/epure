import type { ReactNode } from "react";
import { MagnifyingGlass, CaretDown, Check } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ALERTS_RULES_TOOLBAR_MAIN_CLASS,
  INBOX_FEED_TOOLBAR_RAIL_CLASS,
  INBOX_FEED_TOOLBAR_ROW_CLASS,
} from "@/components/kit/inbox-read-cue";
import { FilterChip } from "@/ui/components";
import { cn } from "@/lib/cn";
import type { RuleDestinationKind } from "./alert-rules-display";
import type { RulesStatusFilter } from "./alerts-toolbar";

export interface AlertsRulesQueryPanelProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: RulesStatusFilter;
  onStatusFilterChange: (value: RulesStatusFilter) => void;
  destinationFilter: RuleDestinationKind;
  onDestinationFilterChange: (value: RuleDestinationKind) => void;
  activeRulesCount?: number;
  totalRulesCount?: number;
  headerActions?: ReactNode;
  className?: string;
  /** Render only filters + search (Alerts toolbar supplies the right rail). */
  embedded?: boolean;
}

const DESTINATION_LABELS: Record<RuleDestinationKind, string> = {
  all: "All destinations",
  slack: "Slack",
  email: "Email",
  discord: "Discord",
  webhook: "Webhook",
};

/** Rules tab toolbar — same FilterChip / env-dropdown rhythm as Issues + Alerts inbox. */
export function AlertsRulesQueryPanel({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  destinationFilter,
  onDestinationFilterChange,
  activeRulesCount,
  totalRulesCount,
  headerActions,
  className,
  embedded = false,
}: AlertsRulesQueryPanelProps) {
  const pausedCount =
    typeof totalRulesCount === "number" && typeof activeRulesCount === "number"
      ? Math.max(0, totalRulesCount - activeRulesCount)
      : undefined;

  const filterCluster = (
    <>
      <div
        data-slot="filter-bar-chips"
        className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1"
      >
        <FilterChip
          label="All"
          active={statusFilter === "all"}
          count={typeof totalRulesCount === "number" ? totalRulesCount : undefined}
          onClick={() => onStatusFilterChange("all")}
        />
        <FilterChip
          label="Enabled"
          active={statusFilter === "monitoring"}
          count={typeof activeRulesCount === "number" ? activeRulesCount : undefined}
          onClick={() => onStatusFilterChange("monitoring")}
        />
        <FilterChip
          label="Paused"
          active={statusFilter === "paused"}
          count={pausedCount}
          onClick={() => onStatusFilterChange("paused")}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              className="!h-8 !min-h-8 gap-1 px-2.5 text-xs font-normal"
              aria-label="Filter by destination"
            >
              <span>{DESTINATION_LABELS[destinationFilter]}</span>
              <CaretDown className="size-3 text-fg-muted" weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {(Object.keys(DESTINATION_LABELS) as RuleDestinationKind[]).map((kind) => (
              <DropdownMenuItem key={kind} onSelect={() => onDestinationFilterChange(kind)}>
                <span>{DESTINATION_LABELS[kind]}</span>
                {destinationFilter === kind ? (
                  <Check className="ml-auto size-3" weight="bold" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        data-slot="alerts-rules-search"
        className="flex h-8 max-h-8 w-full min-w-0 max-w-sm flex-1 basis-[10rem] flex-nowrap items-center gap-1 overflow-hidden rounded-full border border-border-subtle bg-surface-1 px-2.5 py-0 focus-within:border-border-strong focus-within:bg-surface-2/40"
      >
        <MagnifyingGlass className="size-3.5 shrink-0 text-fg-muted" weight="bold" aria-hidden />
        <Input
          variant="ghost"
          size="auto"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search rules by name or type…"
          aria-label="Search rules"
          wrapperClassName="flex h-6 min-h-0 min-w-0 flex-1 items-center border-0 px-0 py-0 shadow-none"
          className="h-6 min-h-0 py-0 text-xs leading-none"
        />
      </div>
    </>
  );

  if (embedded) {
    return (
      <div
        data-slot="alerts-rules-query-panel"
        className={cn(ALERTS_RULES_TOOLBAR_MAIN_CLASS, className)}
      >
        {filterCluster}
      </div>
    );
  }

  return (
    <div
      data-slot="alerts-rules-query-panel"
      className={cn(INBOX_FEED_TOOLBAR_ROW_CLASS, className)}
    >
      <div className={ALERTS_RULES_TOOLBAR_MAIN_CLASS}>{filterCluster}</div>

      {headerActions ? (
        <div className={INBOX_FEED_TOOLBAR_RAIL_CLASS}>
          <div className="flex shrink-0 flex-nowrap items-center gap-1 border-l border-border-subtle pl-2">
            {headerActions}
          </div>
        </div>
      ) : null}
    </div>
  );
}
