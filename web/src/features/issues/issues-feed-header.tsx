import { CircleHelp, Download } from "lucide-react";
import { useCallback, useEffect, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { HeadlineStats } from "../../lib/api";
import { ActionButton } from "../../ui/action-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  startEpureProductTour,
  tryAutoStartEpureProductTour,
} from "@/components/kit/product-tour";
import { INBOX_FEED_TOOLBAR_HEADER_CLASS } from "@/components/kit/inbox-read-cue";
import { useAppContext } from "../../shell/app-context";
import { IssuesFeedQueryPanel } from "./issues-feed-query-panel";
import type { IssueSortValue, TimeWindowValue } from "./query-utils";

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
  const { user, userLoading } = useAppContext();

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

  return (
    <header className={cn("epure-issues-feed-header w-full min-w-0", INBOX_FEED_TOOLBAR_HEADER_CLASS)}>
      <IssuesFeedQueryPanel
        query={query}
        onQueryChange={onQueryChange}
        timeWindow={timeWindow}
        onTimeWindowChange={onTimeWindowChange}
        issueSort={issueSort}
        onIssueSortChange={onIssueSortChange}
        stats={stats}
        filterInputRef={filterInputRef}
        trailing={
          <>
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
          </>
        }
      />
    </header>
  );
}
