import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const DETAIL_TABS = ["overview", "breadcrumbs", "stack", "more"] as const;
const OVERFLOW_TABS = ["stack", "more"] as const;
export type IssueDetailTab = (typeof DETAIL_TABS)[number];
export const DETAIL_TOOLBAR_BUTTON_CLASS = "h-control-sm gap-1 px-2 text-xs";

const DETAIL_TAB_TRIGGER =
  "h-7 px-2.5 text-2xs font-medium border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-ink text-ink-muted hover:text-ink transition-colors rounded-none";

export interface IssueDetailTabsProps {
  overview: ReactNode;
  stack: ReactNode;
  breadcrumbs: ReactNode;
  more: ReactNode;
  tab?: IssueDetailTab;
  onTabChange?: (tab: IssueDetailTab) => void;
  defaultTab?: IssueDetailTab;
  onClose?: () => void;
  showBackLink?: boolean;
  issueTitle?: string;
  statusBadges?: ReactNode;
  actions?: ReactNode;
  spacious?: boolean;
}

export function IssueDetailTabs({
  overview,
  stack,
  breadcrumbs,
  more,
  tab,
  onTabChange,
  defaultTab = "overview",
  onClose,
  showBackLink = true,
  issueTitle,
  statusBadges,
  actions,
}: IssueDetailTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const overflowActive = tab ? OVERFLOW_TABS.includes(tab as (typeof OVERFLOW_TABS)[number]) : false;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !onTabChange) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!root.contains(document.activeElement)) {
        return;
      }

      const index = Number.parseInt(event.key, 10);
      if (index >= 1 && index <= DETAIL_TABS.length) {
        event.preventDefault();
        onTabChange(DETAIL_TABS[index - 1]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTabChange]);

  const tabsProps =
    tab && onTabChange
      ? { value: tab, onValueChange: (value: string) => onTabChange(value as IssueDetailTab) }
      : { defaultValue: defaultTab };

  return (
    <div
      ref={rootRef}
      className="epure-issue-detail-tabs flex h-full min-h-0 flex-1 flex-col overflow-hidden outline-none bg-surface"
      tabIndex={-1}
      onMouseDown={() => rootRef.current?.focus()}
    >
      {/* Optional top back link for non-overlay views */}
      {onClose && showBackLink ? (
        <div className="shrink-0 border-b border-border px-4 py-1.5 md:px-6">
          <Button variant="ghost" size="toolbar" className="text-ink-muted" onClick={onClose}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Back to list
          </Button>
        </div>
      ) : null}

      {/* Hero Header Zone: Badges, Title, and Dedicated Action Ribbon */}
      {issueTitle ? (
        <div className="shrink-0 border-b border-border bg-surface px-5 py-4 md:px-7 select-none">
          {statusBadges ? (
            <div className="flex min-h-5 w-full flex-wrap items-center gap-1.5 mb-2.5">
              {statusBadges}
            </div>
          ) : null}

          <h2
            className="w-full text-base md:text-lg font-bold tracking-tight text-ink select-text break-words leading-snug"
            title={issueTitle}
          >
            {issueTitle}
          </h2>

          {/* High-Visibility Hero Action Toolbar */}
          {actions ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Navigation Tabs Bar */}
      <Tabs {...tabsProps} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-7 shrink-0 items-center justify-between border-b border-border/80 bg-surface px-4 md:px-6 select-none">
          <TabsList className="flex h-full items-stretch gap-1 border-b-0 bg-transparent p-0">
            <TabsTrigger value="overview" className={DETAIL_TAB_TRIGGER}>
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="breadcrumbs"
              className={DETAIL_TAB_TRIGGER}
            >
              Breadcrumbs
            </TabsTrigger>
            <TabsTrigger value="stack" className={DETAIL_TAB_TRIGGER}>
              Stack Trace
            </TabsTrigger>
            <TabsTrigger
              value="more"
              className={cn(DETAIL_TAB_TRIGGER, "hidden sm:inline-flex")}
            >
              Grouping & Diff
            </TabsTrigger>
          </TabsList>

          {onTabChange ? (
            <div className="flex items-center sm:hidden">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="toolbar"
                    className={cn("h-7 px-2", overflowActive && "font-semibold text-ink")}
                    aria-label="More tabs"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onTabChange("stack")}>
                    Stack Trace
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onTabChange("more")}>
                    Grouping & Diff
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>

        {/* Tab Panels */}
        <TabsContent value="overview" className="flex min-h-0 flex-1 flex-col overflow-auto">
          {overview}
        </TabsContent>
        <TabsContent value="breadcrumbs" className="flex min-h-0 flex-1 flex-col overflow-auto">
          {breadcrumbs}
        </TabsContent>
        <TabsContent value="stack" className="flex min-h-0 flex-1 flex-col overflow-auto">
          {stack}
        </TabsContent>
        <TabsContent value="more" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {more}
        </TabsContent>
      </Tabs>
    </div>
  );
}
