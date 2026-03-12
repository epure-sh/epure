import { type ReactNode } from "react";

/** Scroll pane for secondary list routes — same horizontal inset as Issues. */
export function FeedListBody({ children }: { children: ReactNode }) {
  return (
    <div className="epure-issues-layout__list min-h-0 flex-1 overflow-auto px-4 pb-6 md:px-6">
      {children}
    </div>
  );
}

/** Contained table for secondary feeds (alerts, releases). */
export function StackedCardList({ children }: { children: ReactNode }) {
  return (
    <ul className="epure-issue-list epure-feed-table flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      {children}
    </ul>
  );
}
