import { Clock, Flame, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import type { HeadlineStats } from "../../lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CaretDown, Check } from "@/components/ui/icon";
import { TimeWindowSelect } from "@/components/kit/time-window-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { cn } from "@/lib/utils";
import { useAppContext } from "../../shell/app-context";
import {
  applyFilterToken,
  getIssueSortLabel,
  getIssueSortShortLabel,
  ISSUE_SORT_OPTIONS,
  isAllIssuesQuery,
  parseQuery,
  resetQuery,
  TIME_WINDOW_OPTIONS,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";

function FeedFilterIconButton({
  label,
  tooltip,
  active,
  activeVariant = "secondary",
  onClick,
  children,
  dataTour,
}: {
  label: string;
  tooltip: string;
  active: boolean;
  activeVariant?: "secondary" | "filterEscalating" | "filterRegression";
  onClick: () => void;
  children: ReactNode;
  dataTour?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? activeVariant : "outline"}
          size="icon"
          className="size-7 shrink-0"
          aria-label={label}
          aria-pressed={active}
          data-tour={dataTour}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

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

type IssuesFeedFilterCoreProps = Omit<IssuesFeedFilterRowProps, "issueSort" | "onIssueSortChange" | "trailing"> & {
  /** Override the unresolved chip label (Alerts inbox uses “Needs action”). */
  unresolvedLabel?: string;
  /** Extra chips after the shared status set (Alerts high-severity, etc.). */
  extraChips?: ReactNode;
};

/** Status / env filter chips — left column in Issues feed and Alerts history. */
export function IssuesFeedFilterChips({
  query,
  onQueryChange,
  timeWindow,
  onTimeWindowChange,
  stats,
  className,
  unresolvedLabel = "Unresolved",
  extraChips,
}: IssuesFeedFilterCoreProps) {
  const { environment, setEnvironment } = useAppContext();

  const parsed = parseQuery(query);
  const isUnresolvedActive = parsed.lifecycle === "unresolved";
  const isResolvedActive = parsed.lifecycle === "resolved";
  const isRegressionActive = parsed.viewModifier === "regression";
  const isSnoozedActive = parsed.viewModifier === "snoozed";
  const isEscalatingActive = Boolean(parsed.escalating);
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
      className={cn("flex min-w-0 shrink-0 flex-nowrap items-center gap-1.5", className)}
    >
        <Button
          variant={isAllActive ? "primary" : "outline"}
          size="xs"
          className="h-7 text-xs font-medium"
          data-tour="issues-feed-all"
          onClick={handleResetAll}
        >
          All
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="xs" className="h-7 gap-1 text-xs font-medium">
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

        <Button
          variant={isUnresolvedActive ? "secondary" : "outline"}
          size="xs"
          className="h-7 gap-1 text-xs"
          data-tour="issues-feed-unresolved"
          onClick={handleToggleUnresolved}
        >
          <span>{unresolvedLabel}</span>
          {typeof unresolvedCount === "number" ? (
            <Badge variant="neutral" size="sm" className="h-4 px-1 text-[10px] tabular-nums">
              {unresolvedCount}
            </Badge>
          ) : null}
        </Button>

        <Button
          variant={isResolvedActive ? "secondary" : "outline"}
          size="xs"
          className="h-7 text-xs"
          onClick={() => handleToggleToken("is:resolved")}
        >
          Resolved
        </Button>

        <FeedFilterIconButton
          label="Came back"
          tooltip={
            typeof stats?.regressions === "number" && stats.regressions > 0
              ? `Came back · ${stats.regressions}`
              : "Came back"
          }
          active={isRegressionActive}
          activeVariant="filterRegression"
          onClick={() => handleToggleToken("is:regression")}
          dataTour="issues-feed-came-back"
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </FeedFilterIconButton>

        <FeedFilterIconButton
          label="Escalating"
          tooltip="Escalating (3d)"
          active={isEscalatingActive}
          activeVariant="filterEscalating"
          onClick={() => handleToggleToken("is:escalating")}
        >
          <Flame className="size-3.5" aria-hidden />
        </FeedFilterIconButton>

        <FeedFilterIconButton
          label="Snoozed"
          tooltip={
            typeof stats?.snoozed === "number" && stats.snoozed > 0 ? `Snoozed · ${stats.snoozed}` : "Snoozed"
          }
          active={isSnoozedActive}
          onClick={() => handleToggleToken("is:snoozed")}
        >
          <Clock className="size-3.5" aria-hidden />
        </FeedFilterIconButton>

        {extraChips}

        <TimeWindowSelect value={timeWindow} options={TIME_WINDOW_OPTIONS} onValueChange={onTimeWindowChange} />
    </div>
  );
}

/** Sort + trailing actions — right column in Issues feed and Alerts history. */
export function IssuesFeedFilterRowActions({
  issueSort,
  onIssueSortChange,
  trailing,
  className,
  sortAriaLabel = "Sort issues",
}: Pick<IssuesFeedFilterRowProps, "issueSort" | "onIssueSortChange" | "trailing" | "className"> & {
  sortAriaLabel?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <Select value={issueSort} onValueChange={(value) => onIssueSortChange(value as IssueSortValue)}>
        <SelectTrigger aria-label={sortAriaLabel} className="h-7 w-auto min-w-[7.5rem] text-xs">
          <SelectValue>{getIssueSortShortLabel(issueSort)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {ISSUE_SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {getIssueSortLabel(option.value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  trailing,
  className,
}: IssuesFeedFilterRowProps) {
  return (
    <div
      data-slot="filter-bar"
      className={
        className ?? "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 epure-page-gutter-x py-2"
      }
    >
      <IssuesFeedFilterChips
        query={query}
        onQueryChange={onQueryChange}
        timeWindow={timeWindow}
        onTimeWindowChange={onTimeWindowChange}
        stats={stats}
      />
      <IssuesFeedFilterRowActions
        issueSort={issueSort}
        onIssueSortChange={onIssueSortChange}
        trailing={trailing}
      />
    </div>
  );
}
