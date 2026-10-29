import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { IssueSummary, IssueTimeline } from "../lib/api";
import { Badge } from "./badge";
import { Button } from "./button";
import { IssueImpactLine, IssueOccurrenceTrend } from "./issue-impact-strip";
import type { TimelineWindowValue } from "./issue-occurrence-timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const DETAIL_TABS = ["overview", "stack", "breadcrumbs"] as const;
export type IssueDetailTab = (typeof DETAIL_TABS)[number] | "more";
export const DETAIL_TOOLBAR_BUTTON_CLASS = "h-8 gap-1.5 px-2.5 text-sm";
/** Triage cluster in the detail chrome — large enough to notice. */
export const DETAIL_INLINE_ACTION_CLASS = "h-8 gap-1.5 px-3 text-sm";

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
  issue?: IssueSummary;
  statusBadges?: ReactNode;
  /** Triage actions (copy, resolve, snooze, …) — chrome row, right. */
  actions?: ReactNode;
  /** @deprecated Prefer `actions` — still rendered when `actions` is omitted. */
  inlineActions?: ReactNode;
  spacious?: boolean;
  /** @deprecated Fullscreen control removed from the chrome. */
  isFullscreen?: boolean;
  /** @deprecated Fullscreen control removed from the chrome. */
  onToggleFullscreen?: () => void;
  timeline?: IssueTimeline | null;
  timelineLoading?: boolean;
  timelineWindow?: TimelineWindowValue;
  onTimelineWindowChange?: (window: TimelineWindowValue) => void;
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
  issue,
  statusBadges,
  actions,
  inlineActions,
  timeline,
  timelineLoading,
  timelineWindow = "7d",
  onTimelineWindowChange,
}: IssueDetailTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeTab = tab === "more" ? "overview" : tab;

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
      : { defaultValue: defaultTab === "more" ? "overview" : defaultTab };

  const toolbarActions = actions ?? inlineActions;
  const culprit = issue?.culprit?.trim() || null;

  return (
    <div
      ref={rootRef}
      className="epure-issue-detail-tabs flex h-full min-h-0 flex-1 flex-col overflow-hidden outline-none bg-canvas"
      tabIndex={-1}
      onPointerDownCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        // Never steal focus from menus — that aborts Select open mid-gesture.
        if (
          target.closest(
            'button, a, input, textarea, select, [role="combobox"], [role="listbox"], [data-slot="select-trigger"], [data-slot="select-content"], [contenteditable="true"]',
          )
        ) {
          return;
        }
        rootRef.current?.focus({ preventScroll: true });
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-canvas px-3 py-2">
        <div className="flex items-center gap-1">
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close issue detail">
              <ChevronLeft className="size-4" aria-hidden />
              <span className="hidden sm:inline">Close</span>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon-xs"
            onClick={onPrevious}
            disabled={!hasPrevious}
            aria-label="Previous issue"
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next issue"
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
        {toolbarActions ? (
          <div className="ml-auto flex min-w-0 max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
            {toolbarActions}
          </div>
        ) : null}
      </div>

      <Tabs
        variant="folder"
        {...tabsProps}
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-canvas"
      >
        <div className="shrink-0 bg-canvas px-4 pt-3.5 pb-4 md:px-5">
          {statusBadges || issue?.is_unhandled || culprit ? (
            <div className="mb-2.5 flex min-h-6 flex-wrap items-center gap-2">
              {statusBadges}
              {issue?.is_unhandled ? (
                <Badge size="md" variant="warning">
                  unhandled
                </Badge>
              ) : null}
              {culprit ? (
                <span
                  className="min-w-0 truncate font-mono text-xs text-fg-muted"
                  title={culprit}
                >
                  {culprit}
                </span>
              ) : null}
            </div>
          ) : null}
          {issueTitle ? (
            <h2
              className="min-w-0 truncate text-base font-semibold leading-snug tracking-ui text-fg-primary md:text-lg"
              title={issueTitle}
            >
              {issueTitle}
            </h2>
          ) : null}
          {issue ? (
            <div className="mt-3.5">
              <IssueImpactLine issue={issue} />
            </div>
          ) : null}
        </div>

        <div className="sticky top-0 z-10 shrink-0 border-b border-border-subtle bg-canvas px-4 pt-1.5 md:px-5">
          <TabsList className="w-full justify-start !border-b-0">
            <TabsTrigger value="overview">Context</TabsTrigger>
            <TabsTrigger value="stack">Stack trace</TabsTrigger>
            <TabsTrigger value="breadcrumbs">Breadcrumbs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="overview"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto bg-canvas"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border-subtle px-4 py-3 md:px-5">
              <IssueOccurrenceTrend
                timeline={timeline}
                timelineLoading={timelineLoading}
                timelineWindow={timelineWindow}
                onTimelineWindowChange={onTimelineWindowChange}
              />
            </div>
            {overview}
          </div>
        </TabsContent>
        <TabsContent
          value="stack"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto bg-canvas"
        >
          {stack}
        </TabsContent>
        <TabsContent
          value="breadcrumbs"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto bg-canvas"
        >
          {breadcrumbs}
        </TabsContent>
      </Tabs>
    </div>
  );
}
