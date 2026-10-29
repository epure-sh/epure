import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { HeadlineStats } from "../../lib/api";
import {
  INBOX_FEED_TOOLBAR_MAIN_CLASS,
  INBOX_FEED_TOOLBAR_RAIL_CLASS,
  INBOX_FEED_TOOLBAR_ROW_CLASS,
} from "@/components/kit/inbox-read-cue";
import { cn } from "@/lib/utils";
import {
  IssuesFeedFilterChips,
  IssuesFeedFilterRowActions,
} from "./issues-feed-filter-row";
import { IssuesFeedQueryBar } from "./issues-feed-query-bar";
import { getSearchText, withSearchText, type IssueSortValue, type TimeWindowValue } from "./query-utils";

const SEARCH_DEBOUNCE_MS = 250;

export interface IssuesFeedQueryPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  timeWindow: TimeWindowValue;
  onTimeWindowChange: (value: TimeWindowValue) => void;
  issueSort: IssueSortValue;
  onIssueSortChange: (value: IssueSortValue) => void;
  stats?: HeadlineStats | null;
  trailing?: ReactNode;
  /** Extra controls after search (rules status, etc.) — left cluster only. */
  inlineTrailing?: ReactNode;
  /** History/Rules toggle, create rule, etc. — pinned right cluster. */
  headerActions?: ReactNode;
  filterInputRef?: RefObject<HTMLInputElement | null>;
  filterRowClassName?: string;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  /** Render only filter + search (Alerts toolbar supplies the right rail). */
  embedded?: boolean;
  unresolvedLabel?: string;
  extraFilterChips?: ReactNode;
}

/** Compact filter chips + search — shared by Issues feed and Alerts. */
export function IssuesFeedQueryPanel({
  query,
  onQueryChange,
  timeWindow,
  onTimeWindowChange,
  issueSort,
  onIssueSortChange,
  stats,
  trailing,
  inlineTrailing,
  headerActions,
  filterInputRef,
  filterRowClassName,
  searchPlaceholder,
  searchAriaLabel,
  embedded = false,
  unresolvedLabel,
  extraFilterChips,
}: IssuesFeedQueryPanelProps) {
  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;
  const searchTimerRef = useRef<number | null>(null);
  const querySearchText = getSearchText(query);
  const [searchText, setSearchText] = useState(querySearchText);

  useEffect(() => {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setSearchText((current) => (current === querySearchText ? current : querySearchText));
  }, [querySearchText]);

  useEffect(
    () => () => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
      }
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

  const filterCluster = (
    <>
      <IssuesFeedFilterChips
        query={query}
        onQueryChange={onQueryChange}
        timeWindow={timeWindow}
        onTimeWindowChange={onTimeWindowChange}
        stats={stats}
        unresolvedLabel={unresolvedLabel}
        extraChips={extraFilterChips}
      />

      <IssuesFeedQueryBar
        query={query}
        searchText={searchText}
        onSearchChange={handleSearchChange}
        onQueryChange={onQueryChange}
        searchInputRef={filterInputRef}
        placeholder={searchPlaceholder}
        ariaLabel={searchAriaLabel}
        className="h-7 min-w-[min(100%,10rem)] max-w-sm flex-1 basis-[10rem]"
      />

      {inlineTrailing}
    </>
  );

  if (embedded) {
    return (
      <div
        data-slot="issues-feed-query-panel"
        className={cn(INBOX_FEED_TOOLBAR_MAIN_CLASS, filterRowClassName)}
      >
        {filterCluster}
      </div>
    );
  }

  return (
    <div
      data-slot="issues-feed-query-panel"
      className={cn(INBOX_FEED_TOOLBAR_ROW_CLASS, "min-w-0 flex-1", filterRowClassName)}
    >
      <div className={INBOX_FEED_TOOLBAR_MAIN_CLASS}>{filterCluster}</div>

      <div className={INBOX_FEED_TOOLBAR_RAIL_CLASS}>
        <IssuesFeedFilterRowActions
          issueSort={issueSort}
          onIssueSortChange={onIssueSortChange}
          trailing={trailing}
        />

        {headerActions ? (
          <div className="flex shrink-0 flex-nowrap items-center gap-1 border-l border-border-subtle pl-2">
            {headerActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
