import { ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import type { HeadlineStats } from "../../lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CaretDown, Check } from "@/components/ui/icon";
import { TimeWindowSelect } from "@/components/kit/time-window-select";
import { FilterChip, KeyboardHintsFooter } from "@/ui/components";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/primitives";
import { cn } from "@/lib/utils";
import { useAppContext } from "../../shell/app-context";
import {
  applyFilterToken,
  getIssueSortLabel,
  ISSUE_SORT_OPTIONS,
  isAllIssuesQuery,
  parseQuery,
  resetQuery,
  TIME_WINDOW_OPTIONS,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";

export interface IssuesFeedFilterRowProps {
  query: string;
  onQueryChange: (value: string) => void;
  timeWindow: TimeWindowValue;
  onTimeWindowChange: (value: TimeWindowValue) => void;
  issueSort: IssueSortValue;
  onIssueSortChange: (value: IssueSortValue) => void;
  stats?: HeadlineStats | null;
  trailing?: ReactNode;
  className?: string;
}

type IssuesFeedFilterCoreProps = {
  query: string;
  onQueryChange: (value: string) => void;
  stats?: HeadlineStats | null;
  /** Issues currently loaded for the active filter view. */
  viewCount?: number;
  className?: string;
  /** Override the unresolved chip label (Alerts inbox uses “Needs action”). */
  unresolvedLabel?: string;
  /** Extra chips after the shared status set (Alerts high-severity, etc.). */
  extraChips?: ReactNode;
};

/** Status / env filter chips — left column in Issues feed and Alerts history. */
export function IssuesFeedFilterChips({
  query,
  onQueryChange,
  stats,
  viewCount,
  className,
  unresolvedLabel = "Unresolved",
  extraChips,
}: IssuesFeedFilterCoreProps) {
  const { environment, setEnvironment } = useAppContext();

  const parsed = parseQuery(query);
  const isUnresolvedActive = parsed.lifecycle === "unresolved";
  const isResolvedActive = parsed.lifecycle === "resolved";
  const isAllActive = isAllIssuesQuery(query);
  const unresolvedCount = stats?.unresolved;

  function handleResetAll() {
    onQueryChange(resetQuery());
  }

  function handleToggleUnresolved() {
    onQueryChange(applyFilterToken(query, "is:unresolved"));
  }

  function handleToggleToken(token: string) {
    onQueryChange(applyFilterToken(query, token));
  }

  const envLabel =
    environment === "local" ? "Local" : environment.charAt(0).toUpperCase() + environment.slice(1);

  return (
    <div
      data-slot="filter-bar-chips"
      className={cn("flex min-w-0 shrink-0 flex-nowrap items-center gap-1", className)}
    >
      <FilterChip
        label="All"
        active={isAllActive}
        count={isAllActive && typeof viewCount === "number" ? viewCount : undefined}
        data-tour="issues-feed-all"
        onClick={handleResetAll}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            className="!h-8 !min-h-8 gap-1 px-2.5 text-xs font-normal"
          >
            <span>{envLabel}</span>
            <CaretDown className="size-3 text-fg-muted" weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem onSelect={() => setEnvironment("production" as typeof environment)}>
            <span>Production</span>
            {environment === "production" ? <Check className="ml-auto size-3" weight="bold" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEnvironment("staging" as typeof environment)}>
            <span>Staging</span>
            {environment === "staging" ? <Check className="ml-auto size-3" weight="bold" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEnvironment("local" as typeof environment)}>
            <span>Local / dev</span>
            {environment === "local" ? <Check className="ml-auto size-3" weight="bold" /> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FilterChip
        label={unresolvedLabel}
        active={isUnresolvedActive}
        count={
          isUnresolvedActive && typeof viewCount === "number"
            ? viewCount
            : typeof unresolvedCount === "number"
              ? unresolvedCount
              : undefined
        }
        data-tour="issues-feed-unresolved"
        onClick={handleToggleUnresolved}
      />

      <FilterChip
        label="Resolved"
        active={isResolvedActive}
        count={isResolvedActive && typeof viewCount === "number" ? viewCount : undefined}
        onClick={() => handleToggleToken("is:resolved")}
      />

      {extraChips}
    </div>
  );
}

/** Day range + icon-only sort + trailing — right rail in Issues feed and Alerts history. */
export function IssuesFeedFilterRowActions({
  timeWindow,
  onTimeWindowChange,
  issueSort,
  onIssueSortChange,
  trailing,
  className,
  sortAriaLabel = "Sort issues",
}: {
  timeWindow: TimeWindowValue;
  onTimeWindowChange: (value: TimeWindowValue) => void;
  issueSort: IssueSortValue;
  onIssueSortChange: (value: IssueSortValue) => void;
  trailing?: ReactNode;
  className?: string;
  sortAriaLabel?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <KeyboardHintsFooter />

      <TimeWindowSelect
        value={timeWindow}
        options={TIME_WINDOW_OPTIONS}
        onValueChange={onTimeWindowChange}
      />

      <Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                aria-label={sortAriaLabel}
              >
                <ArrowUpDown className="size-3.5 text-fg-muted" aria-hidden />
              </Button>
            </TooltipTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {ISSUE_SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className="text-xs"
                onSelect={() => onIssueSortChange(option.value)}
              >
                <span>{getIssueSortLabel(option.value)}</span>
                {issueSort === option.value ? (
                  <Check className="ml-auto size-3" weight="bold" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent side="bottom" className="text-xs">
          {getIssueSortLabel(issueSort)}
        </TooltipContent>
      </Tooltip>

      {trailing}
    </div>
  );
}

/** Shared inbox filter chips — Issues feed and Alerts history. */
export function IssuesFeedFilterRow({
  query,
  onQueryChange,
  timeWindow,
  onTimeWindowChange,
  issueSort,
  onIssueSortChange,
  stats,
  viewCount,
  trailing,
  className,
}: IssuesFeedFilterRowProps & { viewCount?: number }) {
  return (
    <div
      data-slot="filter-bar"
      className={
        className ?? "flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 epure-page-gutter-x py-1.5"
      }
    >
      <IssuesFeedFilterChips
        query={query}
        onQueryChange={onQueryChange}
        stats={stats}
        viewCount={viewCount}
      />
      <IssuesFeedFilterRowActions
        timeWindow={timeWindow}
        onTimeWindowChange={onTimeWindowChange}
        issueSort={issueSort}
        onIssueSortChange={onIssueSortChange}
        trailing={trailing}
      />
    </div>
  );
}
