import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn";
import {
  FEED_CELL_CHECKBOX,
  FEED_CELL_ISSUE,
  FEED_CELL_NUMERIC,
  FEED_CELL_PRIORITY,
  FEED_CELL_TEXT,
  FEED_CELL_TREND,
  FEED_GRID_FULL,
} from "./issue-feed-layout";
export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "epure-skeleton animate-pulse rounded-sm bg-bg-subtle",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}

export function CardRowSkeleton() {
  return (
    <li className="epure-card-row-skeleton rounded-lg border border-border bg-surface px-4 py-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-64" />
    </li>
  );
}

export function IssueRowSkeleton() {
  return (
    <div
      className={cn(
        "epure-issue-row-skeleton grid min-h-row items-center border-b border-l-2 border-l-transparent border-border",
        FEED_GRID_FULL,
      )}
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
