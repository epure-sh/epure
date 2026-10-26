import { CircleHelp, Clock, Download, Flame, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { HeadlineStats } from "../../lib/api";
import { ActionButton } from "../../ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CaretDown, Check } from "@/components/ui/icon";
import {
  startEpureProductTour,
  tryAutoStartEpureProductTour,
} from "@/components/kit/product-tour";
import { useAppContext } from "../../shell/app-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { IssuesFeedQueryBar } from "./issues-feed-query-bar";
import {
  applyFilterToken,
  getIssueSortLabel,
  getIssueSortShortLabel,
  getSearchText,
  getTimeWindowShortLabel,
  ISSUE_SORT_OPTIONS,
  isAllIssuesQuery,
  parseQuery,
  resetQuery,
  TIME_WINDOW_OPTIONS,
  withSearchText,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

const SEARCH_DEBOUNCE_MS = 250;

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

export interface IssuesFeedHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  onApply: () => void;
  timeWindow: TimeWindowValue;
  onTimeWindowChange: (value: TimeWindowValue) => void;
  issueSort: IssueSortValue;
  onIssueSortChange: (value: IssueSortValue) => void;
  filterInputRef?: RefObject<HTMLInputElement | null>;
  issueCount?: number;
  loading?: boolean;
  /** When true, first visit may auto-start the tour (requires issues in the feed). */
  tourAutoStartReady?: boolean;
  stats?: HeadlineStats | null;
  statsLoading?: boolean;
  onFilterToken?: (token: string) => void;
  selectedCount?: number;
  onExportCsv?: (scope: "view" | "selected") => void;
}

export function IssuesFeedHeader({
  query,
  onQueryChange,
  timeWindow,
  onTimeWindowChange,
  issueSort,
  onIssueSortChange,
  filterInputRef,
  issueCount,
  loading = false,
  tourAutoStartReady = false,
  stats,
  onExportCsv,
  selectedCount = 0,
}: IssuesFeedHeaderProps) {
  const { environment, setEnvironment, user, userLoading } = useAppContext();

  const userId = user?.user_id;

  const launchTour = useCallback(() => {
    startEpureProductTour(undefined, userId, { force: true });
  }, [userId]);

  useEffect(() => {
    if (userLoading || !userId || loading || !tourAutoStartReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      tryAutoStartEpureProductTour(userId, tourAutoStartReady);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [userId, userLoading, loading, tourAutoStartReady]);

  const parsed = parseQuery(query);
  const isUnresolvedActive = parsed.status === "unresolved";
  const isResolvedActive = parsed.status === "resolved";
  const isRegressionActive = parsed.status === "regression";
  const isSnoozedActive = parsed.status === "snoozed";
  const isEscalatingActive = Boolean(parsed.escalating);
  const isAllActive = isAllIssuesQuery(query);
  const unresolvedCount = stats?.unresolved;

  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;
  const searchTimerRef = useRef<number | null>(null);
  const querySearchText = getSearchText(query);
  const [searchText, setSearchText] = useState(querySearchText);

  useEffect(() => {
    if (searchTimerRef.current !== null) {
      return;
    }
    setSearchText((current) => (current.trim() === querySearchText ? current : querySearchText));
  }, [querySearchText]);

  useEffect(
    () => () => {
      if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current);
    },
    [],
  );

  function handleSearchChange(text: string) {
    setSearchText(text);
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null;
      const nextQuery = withSearchText(latestQueryRef.current, text);
      if (nextQuery !== latestQueryRef.current) {
        onQueryChange(nextQuery);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleResetAll() {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setSearchText("");
    onQueryChange(resetQuery());
  }

  function handleToggleUnresolved() {
    onQueryChange(applyFilterToken(query, "is:unresolved"));
  }

  function handleToggleToken(token: string) {
    onQueryChange(applyFilterToken(query, token));
  }

  const envLabel =
    environment === "local"
      ? "Local"
      : environment.charAt(0).toUpperCase() + environment.slice(1);

  return (
    <header className="epure-issues-feed-header shrink-0 border-b border-border bg-bg select-none">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2 md:px-6">
        <h2 className="text-sm font-medium tracking-ui text-fg-primary">Feed</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-tour="issues-feed-help"
          className="size-7 shrink-0 text-fg-muted hover:text-fg-primary"
          aria-label="Product tour"
          title="Product tour"
          onClick={launchTour}
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </Button>
      </div>

      <div
        data-slot="filter-bar"
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 md:px-6"
      >
        <div className="flex flex-wrap items-center gap-1.5">
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
                {environment === "production" ? (
                  <Check className="ml-auto size-3" weight="bold" />
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEnvironment("staging" as typeof environment)}>
                <span>Staging</span>
                {environment === "staging" ? (
                  <Check className="ml-auto size-3" weight="bold" />
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEnvironment("local" as typeof environment)}>
                <span>Local / dev</span>
                {environment === "local" ? (
                  <Check className="ml-auto size-3" weight="bold" />
                ) : null}
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
            <span>Unresolved</span>
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
              typeof stats?.snoozed === "number" && stats.snoozed > 0
                ? `Snoozed · ${stats.snoozed}`
                : "Snoozed"
            }
            active={isSnoozedActive}
            onClick={() => handleToggleToken("is:snoozed")}
          >
            <Clock className="size-3.5" aria-hidden />
          </FeedFilterIconButton>

          <Select
            value={timeWindow}
            onValueChange={(value) => onTimeWindowChange(value as TimeWindowValue)}
          >
            <SelectTrigger aria-label="Time range" className="h-7 w-auto min-w-[4.25rem] text-xs">
              <SelectValue>{getTimeWindowShortLabel(timeWindow)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIME_WINDOW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Select value={issueSort} onValueChange={(value) => onIssueSortChange(value as IssueSortValue)}>
            <SelectTrigger aria-label="Sort issues" className="h-7 w-auto min-w-[7.5rem] text-xs">
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

          {onExportCsv ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ActionButton variant="ghost" size="toolbar" className="h-7 text-xs">
                  <Download className="mr-1 h-3 w-3 text-ink-muted" />
                  <span>Export</span>
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem disabled={!issueCount} onSelect={() => onExportCsv("view")}>
                  CSV · Current view {issueCount ? `(${issueCount})` : ""}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selectedCount === 0}
                  onSelect={() => onExportCsv("selected")}
                >
                  CSV · Selected {selectedCount ? `(${selectedCount})` : ""}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-2 md:px-6 md:pb-3">
        <IssuesFeedQueryBar
          query={query}
          searchText={searchText}
          onSearchChange={handleSearchChange}
          onQueryChange={onQueryChange}
          searchInputRef={filterInputRef}
        />
      </div>
    </header>
  );
}
