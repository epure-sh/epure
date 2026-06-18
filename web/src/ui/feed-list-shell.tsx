import { type ReactNode } from "react";

/** Scroll pane for secondary list routes — same horizontal inset as Issues. */
export function FeedListBody({ children }: { children: ReactNode }) {
  return (
    <div className="epure-issues-layout__list min-h-0 flex-1 overflow-auto px-4 pb-6 md:px-6">
      {children}
    </div>
  );
}

/** Stacked card rows — not a data table; each item is its own bordered surface. */
export function StackedCardList({ children }: { children: ReactNode }) {
  return <ul className="epure-stacked-card-list flex flex-col gap-1.5">{children}</ul>;
}
