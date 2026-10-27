import type { HeadlineStats } from "../../lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon, PencilSimple, Plus } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import {
  INBOX_FEED_TOOLBAR_HEADER_CLASS,
  INBOX_FEED_TOOLBAR_MAIN_CLASS,
  INBOX_FEED_TOOLBAR_RAIL_CLASS,
  INBOX_FEED_TOOLBAR_ROW_CLASS,
} from "@/components/kit/inbox-read-cue";
import { IssuesFeedQueryPanel } from "../issues/issues-feed-query-panel";
import { IssuesFeedFilterRowActions } from "../issues/issues-feed-filter-row";
import type { IssueSortValue, TimeWindowValue } from "../issues/query-utils";
import {
  AlertsSectionToggle,
  type AlertsSection,
  type AlertsSectionCounts,
} from "./alerts-section-toggle";
import { AlertsRulesQueryPanel } from "./alerts-rules-query-panel";
import type { RuleDestinationKind } from "./alert-rules-display";
import { FilterChip } from "@/ui/filter-chip";

export type RulesStatusFilter = "all" | "monitoring" | "paused";

export interface AlertsToolbarProps {
  section: AlertsSection;
  onSectionChange: (value: AlertsSection) => void;
  sectionCounts?: AlertsSectionCounts;
  canManageRules?: boolean;
  onCreateRule?: () => void;
  onEditRule?: () => void;
  editRuleDisabled?: boolean;
  /** History — shared with Issues feed. */
  query: string;
  onQueryChange: (value: string) => void;
  timeWindow: TimeWindowValue;
  onTimeWindowChange: (value: TimeWindowValue) => void;
  issueSort: IssueSortValue;
  onIssueSortChange: (value: IssueSortValue) => void;
  headlineStats?: HeadlineStats | null;
  /** History — filter fired rows to one rule (from Configure “View history”). */
  historyRuleName?: string | null;
  onHistoryRuleNameClear?: () => void;
  /** Rules — local to Rules tab. */
  rulesSearch: string;
  onRulesSearchChange: (value: string) => void;
  rulesStatusFilter?: RulesStatusFilter;
  onRulesStatusFilterChange?: (value: RulesStatusFilter) => void;
  rulesDestinationFilter?: RuleDestinationKind;
  onRulesDestinationFilterChange?: (value: RuleDestinationKind) => void;
  activeRulesCount?: number;
  totalRulesCount?: number;
}

/** Filters left · sort + History|Rules + actions right (Issues feed rhythm). */
export function AlertsToolbar({
  section,
  onSectionChange,
  sectionCounts,
  canManageRules = false,
  onCreateRule,
  onEditRule,
  editRuleDisabled = true,
  query,
  onQueryChange,
  timeWindow,
  onTimeWindowChange,
  issueSort,
  onIssueSortChange,
  headlineStats,
  historyRuleName = null,
  onHistoryRuleNameClear,
  rulesSearch,
  onRulesSearchChange,
  rulesStatusFilter = "all",
  onRulesStatusFilterChange,
  rulesDestinationFilter = "all",
  onRulesDestinationFilterChange,
  activeRulesCount,
  totalRulesCount,
}: AlertsToolbarProps) {
  const isHistory = section === "history";

  const filterCluster = isHistory ? (
    <IssuesFeedQueryPanel
      embedded
      query={query}
      onQueryChange={onQueryChange}
      timeWindow={timeWindow}
      onTimeWindowChange={onTimeWindowChange}
      issueSort={issueSort}
      onIssueSortChange={onIssueSortChange}
      stats={headlineStats ?? undefined}
      searchPlaceholder="Search alerts or add filters…"
      searchAriaLabel="Search alerts"
      filterRowClassName="max-w-full [&_[data-slot=issues-feed-query]]:max-w-[min(100%,11rem)] sm:[&_[data-slot=issues-feed-query]]:max-w-sm"
      inlineTrailing={
        historyRuleName ? (
          <FilterChip
            variant="query"
            filterKey="rule"
            label={historyRuleName}
            onRemove={() => onHistoryRuleNameClear?.()}
          />
        ) : null
      }
    />
  ) : (
    <AlertsRulesQueryPanel
      embedded
      search={rulesSearch}
      onSearchChange={onRulesSearchChange}
      statusFilter={rulesStatusFilter}
      onStatusFilterChange={onRulesStatusFilterChange ?? (() => {})}
      destinationFilter={rulesDestinationFilter}
      onDestinationFilterChange={onRulesDestinationFilterChange ?? (() => {})}
      activeRulesCount={activeRulesCount}
      totalRulesCount={totalRulesCount}
      className="max-w-full [&_[data-slot=alerts-rules-search]]:max-w-[min(100%,11rem)] sm:[&_[data-slot=alerts-rules-search]]:max-w-sm"
    />
  );

  return (
    <header className={cn("epure-issues-feed-header w-full min-w-0", INBOX_FEED_TOOLBAR_HEADER_CLASS)}>
      <div className={INBOX_FEED_TOOLBAR_ROW_CLASS}>
        <div className={INBOX_FEED_TOOLBAR_MAIN_CLASS}>{filterCluster}</div>

        <div className={INBOX_FEED_TOOLBAR_RAIL_CLASS}>
          {isHistory ? (
            <IssuesFeedFilterRowActions
              issueSort={issueSort}
              onIssueSortChange={onIssueSortChange}
              sortAriaLabel="Sort alerts"
            />
          ) : null}

          {!isHistory && canManageRules && onEditRule ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label="Edit rule"
                  disabled={editRuleDisabled}
                  onClick={onEditRule}
                >
                  <Icon icon={PencilSimple} size={14} aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {editRuleDisabled ? "Select a rule to edit" : "Edit selected rule"}
              </TooltipContent>
            </Tooltip>
          ) : null}

          <div className="flex h-7 shrink-0 flex-nowrap items-center gap-1.5 border-l border-border-subtle pl-2">
            <AlertsSectionToggle
              value={section}
              onChange={onSectionChange}
              counts={sectionCounts}
            />
            {canManageRules && onCreateRule ? (
              <Button
                variant="primary"
                size="xs"
                className="h-7 shrink-0 gap-1 text-xs"
                onClick={onCreateRule}
              >
                <Icon icon={Plus} size={14} aria-hidden />
                <span className="hidden sm:inline">Create rule</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
