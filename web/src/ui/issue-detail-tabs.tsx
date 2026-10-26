import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const DETAIL_TABS = ["overview", "breadcrumbs", "stack"] as const;
export type IssueDetailTab = (typeof DETAIL_TABS)[number] | "more";
export const DETAIL_TOOLBAR_BUTTON_CLASS = "h-control-sm gap-1 px-2 text-xs";

export interface IssueDetailTabsProps {
  overview: ReactNode;
  stack: ReactNode;
  breadcrumbs: ReactNode;
  more?: ReactNode;
  tab?: IssueDetailTab;
  onTabChange?: (tab: IssueDetailTab) => void;
  defaultTab?: IssueDetailTab;
  onClose?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
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
  tab,
  onTabChange,
  defaultTab = "overview",
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  issueTitle,
  statusBadges,
  actions,
}: IssueDetailTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeTab = tab === "more" ? "stack" : tab;

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
    activeTab && onTabChange
      ? { value: activeTab, onValueChange: (value: string) => onTabChange(value as IssueDetailTab) }
      : { defaultValue: defaultTab };

  return (
    <div
      ref={rootRef}
      className="epure-issue-detail-tabs flex h-full min-h-0 flex-1 flex-col overflow-hidden outline-none bg-surface"
      tabIndex={-1}
      onMouseDown={() => rootRef.current?.focus()}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-surface-1 px-3 py-1.5">
        <div className="flex items-center gap-1">
          {onClose ? (
            <Button variant="ghost" size="xs" onClick={onClose}>
              <ChevronLeft className="size-3.5" aria-hidden />
              Issues
            </Button>
          ) : null}
          <Button variant="outline" size="icon-xs" onClick={onPrevious} disabled={!hasPrevious} aria-label="Previous issue">
            <ChevronUp className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-xs" onClick={onNext} disabled={!hasNext} aria-label="Next issue">
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
        {actions ? <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">{actions}</div> : null}
      </div>

      {issueTitle ? (
        <div className="shrink-0 bg-surface-1 px-4 pb-3 pt-3">
          {statusBadges ? (
            <div className="mb-1.5 flex min-h-5 flex-wrap items-center gap-1.5">{statusBadges}</div>
          ) : null}
          <h2 className="break-words text-base font-semibold leading-snug tracking-tight text-fg-primary" title={issueTitle}>
            {issueTitle}
          </h2>
        </div>
      ) : null}

      <Tabs variant="folder" {...tabsProps} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="shrink-0">
          <TabsTrigger value="overview">Context</TabsTrigger>
          <TabsTrigger value="breadcrumbs">Breadcrumbs</TabsTrigger>
          <TabsTrigger value="stack">Stack trace</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex min-h-0 flex-1 flex-col overflow-auto bg-surface-1">
          {overview}
        </TabsContent>
        <TabsContent value="breadcrumbs" className="flex min-h-0 flex-1 flex-col overflow-auto bg-surface-1">
          {breadcrumbs}
        </TabsContent>
        <TabsContent value="stack" className="flex min-h-0 flex-1 flex-col overflow-auto bg-surface-1">
          {stack}
        </TabsContent>
      </Tabs>
    </div>
  );
}
