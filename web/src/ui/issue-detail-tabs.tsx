import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const DETAIL_TABS = ["overview", "breadcrumbs", "stack"] as const;
export type IssueDetailTab = (typeof DETAIL_TABS)[number] | "more";
export const DETAIL_TOOLBAR_BUTTON_CLASS = "h-control-sm gap-1 px-2 text-xs";
/** Title-row triage cluster — slightly taller than toolbar, still compact. */
export const DETAIL_INLINE_ACTION_CLASS = "h-7 gap-1.5 px-2.5 text-xs";

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
  /** Primary triage actions (resolve, copy, …) — top toolbar. */
  actions?: ReactNode;
  /** Icon actions on the title row (snooze, ignore, …). */
  inlineActions?: ReactNode;
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
  inlineActions,
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
      className="epure-issue-detail-tabs flex h-full min-h-0 flex-1 flex-col overflow-hidden outline-none bg-surface-1"
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

      <Tabs variant="folder" {...tabsProps} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface-1">
        <div className="shrink-0 bg-surface-1">
          {issueTitle ? (
            <div className="px-4 pt-3 pb-4 md:px-5">
              {statusBadges ? (
                <div className="mb-2.5 flex min-h-5 flex-wrap items-center gap-1.5">{statusBadges}</div>
              ) : null}
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <h2
                  className="min-w-[min(100%,10rem)] flex-1 break-words text-lg font-semibold leading-snug tracking-ui text-fg-primary"
                  title={issueTitle}
                >
                  {issueTitle}
                </h2>
                {inlineActions ? (
                  <div className="ml-auto flex min-w-0 max-w-full shrink-0 items-center">{inlineActions}</div>
                ) : null}
              </div>
            </div>
          ) : null}
          <TabsList className="epure-issue-detail-tabs__list w-full shrink-0 justify-start gap-1 border-border-subtle !h-auto !min-h-0 !items-end !bg-surface-1 !pt-0 px-4">
            <TabsTrigger value="overview" className="px-3.5 py-2">
              Context
            </TabsTrigger>
            <TabsTrigger value="breadcrumbs" className="px-3.5 py-2">
              Breadcrumbs
            </TabsTrigger>
            <TabsTrigger value="stack" className="px-3.5 py-2">
              Stack trace
            </TabsTrigger>
          </TabsList>
        </div>
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
