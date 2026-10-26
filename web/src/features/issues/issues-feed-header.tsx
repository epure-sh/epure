import { Clock, Download, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { HeadlineStats } from "../../lib/api";
import { formatCompactCount } from "../../lib/format-count";
import { ActionButton } from "../../ui/action-button";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/kit/filter-bar";
import { startAcmeProductTour } from "@/components/kit/product-tour";
import { useAppContext } from "../../shell/app-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  extractChips,
  getEventsStatLabel,
  getIssueSortLabel,
  getSearchText,
  ISSUE_SORT_OPTIONS,
  queryHasToken,
  removeChipToken,
  resetQuery,
  setToken,
  TIME_WINDOW_OPTIONS,
  toggleToken,
  withSearchText,
  type IssueSortValue,
  type TimeWindowValue,
} from "./query-utils";

const SEARCH_DEBOUNCE_MS = 250;

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
  stats,
  statsLoading = false,
  onFilterToken,
  selectedCount = 0,
  onExportCsv,
}: IssuesFeedHeaderProps) {
  const { environment, setEnvironment, projectId, projects } = useAppContext();
  const currentProject = projects.find((p) => p.id === projectId);
  const isAcmeDemo = Boolean(currentProject?.is_demo || projectId?.startsWith("acme") || projectId?.includes("acme"));

  useEffect(() => {
    if (isAcmeDemo && typeof window !== "undefined") {
      const tourSeen = localStorage.getItem("epure.acme_tour_seen");
      if (!tourSeen) {
        localStorage.setItem("epure.acme_tour_seen", "true");
        const timer = setTimeout(() => {
          startAcmeProductTour();
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [isAcmeDemo]);
  const chips = extractChips(query);
  const isUnresolvedActive = queryHasToken(query, "is:unresolved");
  const isRegressionActive = queryHasToken(query, "is:regression");
  const isSnoozedActive = queryHasToken(query, "is:snoozed");

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

  function setDirectStateFilter(token: string | null) {
    if (token && onFilterToken) {
      onFilterToken(token);
      return;
    }
    let nextQuery = query;
    for (const chip of chips) {
      if (chip.key === "is") {
        nextQuery = removeChipToken(nextQuery, chip.token);
      }
    }
    if (token) {
      nextQuery = `${nextQuery.trim()} ${token}`.trim();
    }
    onQueryChange(nextQuery);
  }

  function handleResetAll() {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setSearchText("");
    onQueryChange(resetQuery());
  }

  const eventsCount = statsLoading ? "…" : formatCompactCount(stats?.events_7d ?? 0);

  return (
    <header className="epure-issues-feed-header shrink-0 border-b border-border bg-bg select-none">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 md:px-6">
        <FilterBar
          environment={environment}
          onEnvironmentChange={(env) => setEnvironment(env as any)}
          status={
            isRegressionActive
              ? "regression"
              : isSnoozedActive
                ? "snoozed"
                : isUnresolvedActive
                  ? "unresolved"
                  : "all"
          }
          onStatusChange={(nextStatus) => {
            if (nextStatus === "all") setDirectStateFilter(null);
            else if (nextStatus === "unresolved") setDirectStateFilter("is:unresolved");
            else if (nextStatus === "resolved") setDirectStateFilter("is:resolved");
            else if (nextStatus === "snoozed") setDirectStateFilter("is:snoozed");
          }}
          escalating={queryHasToken(query, "is:escalating")}
          onToggleEscalating={() => onQueryChange(toggleToken(query, "is:escalating"))}
          regression={isRegressionActive}
          onToggleRegression={() =>
            setDirectStateFilter(isRegressionActive ? "is:unresolved" : "is:regression")
          }
          priority={
            queryHasToken(query, "level:error")
              ? "critical"
              : queryHasToken(query, "level:warning")
                ? "medium"
                : ""
          }
          onPriorityChange={(p) => {
            if (!p) {
              onQueryChange(removeChipToken(removeChipToken(query, "level:error"), "level:warning"));
            } else if (p === "critical" || p === "high") {
              onQueryChange(setToken(query, "level:error"));
            } else {
              onQueryChange(setToken(query, "level:warning"));
            }
          }}
          stats={{
            unresolved: stats?.unresolved,
            regressions: stats?.regressions,
            snoozed: stats?.snoozed,
          }}
          onReset={handleResetAll}
          search={searchText}
          onSearchChange={handleSearchChange}
          searchInputRef={filterInputRef}
        />

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-2xs text-fg-muted xl:flex">
            <span className="font-mono font-medium tabular-nums text-fg-primary">{eventsCount}</span>
            <span>{getEventsStatLabel(timeWindow).toLowerCase()}</span>
          </span>

          {/* Sort Selector */}
          <Select value={issueSort} onValueChange={(value) => onIssueSortChange(value as IssueSortValue)}>
            <SelectTrigger aria-label="Sort issues" className="h-7 w-auto min-w-[8rem] text-xs btn-tactile">
              <SlidersHorizontal className="mr-1.5 h-3 w-3 text-ink-muted shrink-0" />
              <SelectValue>{getIssueSortLabel(issueSort)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ISSUE_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time Window Selector */}
          <Select value={timeWindow} onValueChange={(value) => onTimeWindowChange(value as TimeWindowValue)}>
            <SelectTrigger aria-label="Time range" className="h-7 w-auto min-w-[4.8rem] text-xs btn-tactile">
              <Clock className="mr-1.5 h-3 w-3 text-ink-muted shrink-0" />
              <SelectValue>
                {TIME_WINDOW_OPTIONS.find((option) => option.value === timeWindow)?.label.replace("Last ", "") ??
                  timeWindow.toUpperCase()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIME_WINDOW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Export Action */}
          {onExportCsv ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ActionButton variant="ghost" size="toolbar" className="h-7 text-xs btn-tactile">
                  <Download className="mr-1 h-3 w-3 text-ink-muted" />
                  <span>Export</span>
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  disabled={!issueCount}
                  onSelect={() => onExportCsv("view")}
                >
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

          {/* Acme Spotlight Product Tour Trigger */}
          {isAcmeDemo && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => startAcmeProductTour()}
              className="h-7 text-xs gap-1 font-medium text-accent hover:text-accent border-accent/30 bg-accent/5 shadow-2xs"
              title="Start Acme interactive tour"
            >
              <Sparkles className="size-3" />
              <span>Product Tour</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
