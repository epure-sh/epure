// web/src/ui/block/issue-detail-tabs.tsx
// Tier 3 Block: Issue Detail Tabs Frame
// Pinned issue header, folder tabs (Context, Stack trace, Breadcrumbs), bottom-left triage footer.

import { useEffect, useRef, type ReactNode } from "react";
import type { IssueSummary, IssueTimeline } from "../../lib/api";
import { Badge } from "../primitives/elements/badge";
import { IssueImpactLine, IssueOccurrenceTrend } from "./issue-impact-strip";
import type { TimelineWindowValue } from "./issue-occurrence-timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../primitives/elements/tabs";

const DETAIL_TABS = ["overview", "stack", "breadcrumbs"] as const;
export type IssueDetailTab = (typeof DETAIL_TABS)[number] | "more";
export const DETAIL_TOOLBAR_BUTTON_CLASS = "h-8 gap-1.5 rounded-full px-2.5 text-sm";
/** Labeled triage buttons — match alert detail footer. */
export const DETAIL_INLINE_ACTION_CLASS = "h-8 gap-1.5 rounded-full px-3 text-sm";
/** Icon-only triage buttons — match alert detail footer. */
export const DETAIL_INLINE_ICON_ACTION_CLASS = "size-8 shrink-0 rounded-full";

export interface IssueDetailTabsProps {
  overview?: ReactNode;
  stack?: ReactNode;
  breadcrumbs?: ReactNode;
  more?: ReactNode;
  tab?: IssueDetailTab;
  activeTab?: IssueDetailTab;
  onTabChange?: (tab: IssueDetailTab) => void;
  defaultTab?: IssueDetailTab;
  /** @deprecated Close chrome removed — overlay backdrop / Esc still close. */
  onClose?: () => void;
  /** @deprecated Prev/next chrome removed. */
  onPrevious?: () => void;
  /** @deprecated Prev/next chrome removed. */
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  showBackLink?: boolean;
  issueTitle?: string;
  issue?: IssueSummary;
  statusBadges?: ReactNode;
  /** Triage actions — bottom-left footer (Resolve → Copy → Ignore/Snooze). */
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
  overview = null,
  stack = null,
  breadcrumbs = null,
  tab: tabProp,
  activeTab,
  onTabChange,
  defaultTab = "overview",
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
  const resolvedTab = tabProp ?? activeTab;
  const currentActiveTab = resolvedTab === "more" ? "overview" : resolvedTab;

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
    currentActiveTab && onTabChange
      ? { value: currentActiveTab, onValueChange: (value: string) => onTabChange(value as IssueDetailTab) }
      : { defaultValue: defaultTab === "more" ? "overview" : defaultTab };

  const footerActions = actions ?? inlineActions;
  const culprit = issue?.culprit?.trim() || null;

  return (
    <div
      ref={rootRef}
      data-slot="issue-detail-tabs"
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
              className="min-w-0 break-words text-xl font-semibold leading-snug tracking-ui text-fg-primary md:text-2xl"
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

        <div className="sticky top-0 z-10 shrink-0 border-b border-border-subtle bg-canvas px-4 pt-2 md:px-5">
          <TabsList className="w-full justify-start gap-1 !border-b-0">
            <TabsTrigger
              value="overview"
              className="!px-4 !py-2.5 !text-sm"
            >
              Context
            </TabsTrigger>
            <TabsTrigger
              value="stack"
              className="!px-4 !py-2.5 !text-sm"
            >
              Stack trace
            </TabsTrigger>
            <TabsTrigger
              value="breadcrumbs"
              className="!px-4 !py-2.5 !text-sm"
            >
              Breadcrumbs
            </TabsTrigger>
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

      {footerActions ? (
        <footer className="flex shrink-0 items-center justify-start gap-2 border-t border-border-subtle bg-surface-1 px-4 py-3 sm:px-6">
          {footerActions}
        </footer>
      ) : null}
    </div>
  );
}
