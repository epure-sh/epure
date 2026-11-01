// web/src/ui/block/feed-list-shell.tsx
// Tier 3 Block: Feed List Shell & Containers

import { type ReactNode } from "react";

/** Scroll pane for secondary list routes — same horizontal inset as Issues. */
export function FeedListBody({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="feed-list-body"
      className="epure-feed-list-body epure-issues-layout__list min-h-0 flex-1 overflow-auto epure-page-gutter-x py-4 pb-6"
    >
      {children}
    </div>
  );
}

/** Contained table for secondary feeds (alerts, releases, monitors). */
export function StackedCardList({ children }: { children: ReactNode }) {
  return (
    <ul
      data-slot="stacked-card-list"
      className="epure-stacked-card-list epure-issue-list epure-feed-table flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-1 shadow-tactile"
    >
      {children}
    </ul>
  );
}
