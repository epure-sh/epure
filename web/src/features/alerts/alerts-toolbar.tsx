import type { HeadlineStats } from "../../lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon, Plus } from "@/components/ui/icon";
import {
  INBOX_FEED_TOOLBAR_HEADER_CLASS,
  INBOX_FEED_TOOLBAR_MAIN_CLASS,
  INBOX_FEED_TOOLBAR_RAIL_CLASS,
  INBOX_FEED_TOOLBAR_ROW_CLASS,
  INBOX_FEED_TOOLBAR_SHELL_CLASS,
} from "@/components/kit/inbox-read-cue";
import { IssuesFeedQueryPanel } from "../issues/issues-feed-query-panel";
import { IssuesFeedFilterRowActions } from "../issues/issues-feed-filter-row";
import type { IssueSortValue, TimeWindowValue } from "../issues/query-utils";
import type { AlertsSection } from "./alerts-section-toggle";
import { AlertsRulesQueryPanel } from "./alerts-rules-query-panel";
import type { RuleDestinationKind } from "./alert-rules-display";
import { FilterChip } from "@/ui/components";

export type RulesStatusFilter = "all" | "monitoring" | "paused";

export interface AlertsToolbarProps {
  section: AlertsSection;
  canManageRules?: boolean;
  onCreateRule?: () => void;
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

/** Filters left · sort + create-rule right (Inbox|Rules lives on the page title). */
export function AlertsToolbar({
  section,
  canManageRules = false,
  onCreateRule,
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
      unresolvedLabel="Needs action"
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
      <div className={INBOX_FEED_TOOLBAR_SHELL_CLASS}>
        <div className={INBOX_FEED_TOOLBAR_ROW_CLASS}>
          <div className={INBOX_FEED_TOOLBAR_MAIN_CLASS}>{filterCluster}</div>

          <div className={INBOX_FEED_TOOLBAR_RAIL_CLASS}>
            {isHistory ? (
              <IssuesFeedFilterRowActions
                timeWindow={timeWindow}
                onTimeWindowChange={onTimeWindowChange}
                issueSort={issueSort}
                onIssueSortChange={onIssueSortChange}
                sortAriaLabel="Sort alerts"
              />
            ) : null}

            {!isHistory && canManageRules && onCreateRule ? (
              <Button
                variant="primary"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={onCreateRule}
              >
                <Icon icon={Plus} size={14} aria-hidden />
                Create rule
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
