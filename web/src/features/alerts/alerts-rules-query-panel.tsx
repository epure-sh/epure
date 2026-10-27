import type { ReactNode } from "react";
import { MagnifyingGlass } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALERTS_RULES_TOOLBAR_MAIN_CLASS,
  INBOX_FEED_TOOLBAR_RAIL_CLASS,
  INBOX_FEED_TOOLBAR_ROW_CLASS,
} from "@/components/kit/inbox-read-cue";
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

/** Rules tab toolbar — same row rhythm as Issues feed, rules-only filters. */
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
  const filterCluster = (
    <>
          <div className="flex shrink-0 flex-nowrap items-center gap-1">
            <Button
              variant={statusFilter === "all" ? "primary" : "outline"}
              size="xs"
              className="h-7 text-xs font-medium"
              onClick={() => onStatusFilterChange("all")}
            >
              All
              {typeof totalRulesCount === "number" ? (
                <span className="ml-1 font-mono text-[10px] tabular-nums opacity-80">{totalRulesCount}</span>
              ) : null}
            </Button>
            <Button
              variant={statusFilter === "monitoring" ? "secondary" : "outline"}
              size="xs"
              className="h-7 text-xs"
              onClick={() => onStatusFilterChange("monitoring")}
            >
              Enabled
              {typeof activeRulesCount === "number" ? (
                <span className="ml-1 font-mono text-[10px] tabular-nums opacity-80">{activeRulesCount}</span>
              ) : null}
            </Button>
            <Button
              variant={statusFilter === "paused" ? "secondary" : "outline"}
              size="xs"
              className="h-7 text-xs"
              onClick={() => onStatusFilterChange("paused")}
            >
              Paused
            </Button>
          </div>

          <div
            data-slot="alerts-rules-search"
            className="flex h-7 max-h-7 w-full min-w-0 max-w-sm flex-1 basis-[10rem] flex-nowrap items-center gap-1 overflow-hidden rounded-md border border-border-subtle bg-surface-1 px-1.5 py-0 focus-within:border-border-strong focus-within:bg-surface-2/40"
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

          <Select
            value={destinationFilter}
            onValueChange={(value) => onDestinationFilterChange(value as RuleDestinationKind)}
          >
            <SelectTrigger className="h-7 w-auto min-w-[7rem] shrink-0 text-xs" aria-label="Filter by destination">
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Destination: All</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="discord">Discord</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
            </SelectContent>
          </Select>
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
