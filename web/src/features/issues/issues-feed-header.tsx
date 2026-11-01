import { Download } from "lucide-react";
import type { RefObject } from "react";
import { cn } from "@/lib/utils";
import type { HeadlineStats } from "../../lib/api";
import { ActionButton } from "@/ui/components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  INBOX_FEED_TOOLBAR_HEADER_CLASS,
  INBOX_FEED_TOOLBAR_SHELL_CLASS,
} from "@/components/kit/inbox-read-cue";
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
  /** @deprecated Tour help lives on the project Dashboard. */
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
  stats,
  onExportCsv,
  selectedCount = 0,
}: IssuesFeedHeaderProps) {
  return (
    <header className={cn("epure-issues-feed-header w-full min-w-0", INBOX_FEED_TOOLBAR_HEADER_CLASS)}>
      <div className={INBOX_FEED_TOOLBAR_SHELL_CLASS}>
        <IssuesFeedQueryPanel
          query={query}
          onQueryChange={onQueryChange}
          timeWindow={timeWindow}
          onTimeWindowChange={onTimeWindowChange}
          issueSort={issueSort}
          onIssueSortChange={onIssueSortChange}
          stats={stats}
          viewCount={issueCount}
          filterInputRef={filterInputRef}
          trailing={
            onExportCsv ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ActionButton variant="ghost" size="toolbar" className="h-8 text-xs">
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
            ) : null
          }
        />
      </div>
    </header>
  );
}
