// web/src/ui/block/feed-skeletons.tsx
// Tier 3 Block: Feed & Row Skeletons
// Consolidates CardRowSkeleton and IssueRowSkeleton with FeedRowSkeleton and FeedSkeletonList.

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "../primitives";
import {
  FEED_CELL_CHECKBOX,
  FEED_CELL_ISSUE,
  FEED_CELL_NUMERIC,
  FEED_CELL_PRIORITY,
  FEED_CELL_TEXT,
  FEED_CELL_TREND,
  FEED_GRID_FULL,
  FEED_GRID_COMPACT,
} from "./issue-feed-row";

export interface CardRowSkeletonProps extends HTMLAttributes<HTMLLIElement> {}

/**
 * Skeleton placeholder for list card rows (releases, monitors, alerts).
 */
export function CardRowSkeleton({ className, ...props }: CardRowSkeletonProps) {
  return (
    <li
      className={cn(
        "epure-card-row-skeleton border-b border-border-subtle px-4 py-2.5 last:border-b-0 list-none",
        className,
      )}
      {...props}
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-64" />
    </li>
  );
}

export interface IssueRowSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

/**
 * Skeleton placeholder for full CSS Grid issue feed rows.
 */
export function IssueRowSkeleton({ className, compact = false, ...props }: IssueRowSkeletonProps) {
  return (
    <div
      className={cn(
        "epure-issue-row-skeleton grid min-h-row items-center border-b border-l-2 border-l-transparent border-border-subtle",
        compact ? FEED_GRID_COMPACT : FEED_GRID_FULL,
        className,
      )}
      {...props}
    >
      <div className={cn("hidden lg:flex", FEED_CELL_CHECKBOX)}>
        <Skeleton className="h-3.5 w-3.5" />
      </div>
      <div className={cn("flex flex-col gap-0.5", FEED_CELL_ISSUE)}>
        <Skeleton className="h-3.5 w-[55%]" />
        <Skeleton className="h-2.5 w-[72%]" />
        <Skeleton className="hidden h-2 w-[40%] sm:block" />
      </div>
      <Skeleton className={cn("hidden h-3 lg:block", FEED_CELL_TEXT)} />
      <Skeleton className={cn("hidden h-3 xl:block", FEED_CELL_TEXT)} />
      <Skeleton className={cn("hidden h-6 lg:block", FEED_CELL_TREND)} />
      <Skeleton className={cn("h-3", FEED_CELL_NUMERIC)} />
      <Skeleton className={cn("hidden h-3 xl:block", FEED_CELL_NUMERIC)} />
      <div className={cn("hidden xl:flex", FEED_CELL_PRIORITY)}>
        <Skeleton className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

export interface FeedRowSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "grid" | "compact" | "card";
}

/**
 * Polymorphic feed row skeleton supporting "grid", "compact", and "card" variants.
 */
export function FeedRowSkeleton({ variant = "grid", className, ...props }: FeedRowSkeletonProps) {
  if (variant === "card") {
    return <CardRowSkeleton className={className} />;
  }
  return <IssueRowSkeleton compact={variant === "compact"} className={className} {...props} />;
}

export interface FeedSkeletonListProps extends HTMLAttributes<HTMLDivElement> {
  count?: number;
  variant?: "grid" | "compact" | "card";
}

/**
 * Multi-row skeleton loader list for feed loading states.
 */
export function FeedSkeletonList({
  count = 5,
  variant = "grid",
  className,
  ...props
}: FeedSkeletonListProps) {
  const items = Array.from({ length: count }, (_, i) => i);
  if (variant === "card") {
    return (
      <ul className={cn("divide-y divide-border-subtle list-none p-0 m-0", className)}>
        {items.map((i) => (
          <CardRowSkeleton key={i} />
        ))}
      </ul>
    );
  }
  return (
    <div className={cn("flex flex-col divide-y divide-border-subtle", className)} {...props}>
      {items.map((i) => (
        <FeedRowSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}

export { Skeleton };
