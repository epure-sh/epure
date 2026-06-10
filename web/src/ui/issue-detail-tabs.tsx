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

const DETAIL_TABS = ["overview", "stack", "breadcrumbs", "more"] as const;
const OVERFLOW_TABS = ["breadcrumbs", "more"] as const;
export type IssueDetailTab = (typeof DETAIL_TABS)[number];

/** @deprecated Use Button `size="toolbar"` instead */
export const DETAIL_TOOLBAR_BUTTON_CLASS = "h-control-sm gap-1 px-2 text-xs";

const DETAIL_TAB_TRIGGER =
  "h-control min-h-control max-h-control px-4 py-0 text-sm";

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
      className="epure-issue-detail-tabs flex h-full min-h-0 flex-1 flex-col overflow-hidden outline-none"
      tabIndex={-1}
      onMouseDown={() => rootRef.current?.focus()}
    >
      {onClose && showBackLink ? (
        <div className="shrink-0 border-b border-border px-4 py-1.5 md:px-6">
          <Button variant="ghost" size="toolbar" className="text-ink-muted" onClick={onClose}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Back to list
          </Button>
        </div>
      ) : null}

      <Tabs {...tabsProps} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-control min-h-control shrink-0 items-stretch overflow-hidden bg-surface">
          <div className="min-w-0 flex-1 overflow-hidden border-b border-border">
            <TabsList className="h-control min-h-control flex w-full items-stretch gap-0 overflow-hidden border-b-0 bg-transparent px-4 md:px-6">
              <TabsTrigger value="overview" className={cn(DETAIL_TAB_TRIGGER, "shrink-0 first:pl-0")}>
                Overview
              </TabsTrigger>
              <TabsTrigger value="stack" className={cn(DETAIL_TAB_TRIGGER, "shrink-0")}>
                Stack
              </TabsTrigger>
              <TabsTrigger
                value="breadcrumbs"
                className={cn(DETAIL_TAB_TRIGGER, "hidden shrink-0 lg:inline-flex")}
              >
                Breadcrumbs
              </TabsTrigger>
              <TabsTrigger value="more" className={cn(DETAIL_TAB_TRIGGER, "hidden shrink-0 lg:inline-flex")}>
                More
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-1 border-b border-border bg-surface pr-4 md:pr-6">
            {onTabChange ? (
              <div className="flex items-center lg:hidden">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="toolbar"
                      className={cn("h-control", overflowActive && "font-semibold text-ink")}
                      aria-label="More tabs"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onTabChange("breadcrumbs")}>
                      Breadcrumbs
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onTabChange("more")}>More</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
            {actions ? (
              <div className="flex h-control items-center gap-1 border-l border-border bg-surface pl-2">
                {actions}
              </div>
            ) : null}
          </div>
        </div>

        {issueTitle ? (
          <div className="shrink-0 border-b border-border px-4 py-3 md:px-6">
            <h2
              className="w-full text-xl font-medium tracking-ui text-ink"
              title={issueTitle}
            >
              {issueTitle}
            </h2>
            {statusBadges ? (
              <div className="mt-2 flex min-h-5 w-full flex-wrap items-center gap-1">
                {statusBadges}
              </div>
            ) : null}
          </div>
        ) : null}

        <TabsContent value="overview" className="flex min-h-0 flex-1 flex-col overflow-auto">
          {overview}
        </TabsContent>
        <TabsContent value="stack" className="flex min-h-0 flex-1 flex-col overflow-auto">
          {stack}
        </TabsContent>
        <TabsContent value="breadcrumbs" className="flex min-h-0 flex-1 flex-col overflow-auto">
          {breadcrumbs}
        </TabsContent>
        <TabsContent value="more" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {more}
        </TabsContent>
      </Tabs>
    </div>
  );
}
