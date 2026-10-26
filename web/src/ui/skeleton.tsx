import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { ISSUE_ROW_GRID } from "@/components/kit/issue-row-shell";
export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "epure-skeleton animate-pulse rounded-sm bg-surface-2",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}

export function CardRowSkeleton() {
  return (
    <li className="epure-card-row-skeleton border-b border-border-subtle px-4 py-2.5 last:border-b-0">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-64" />
    </li>
  );
}

export function IssueRowSkeleton() {
  return (
    <div
      className={cn(
        "epure-issue-row-skeleton grid min-h-14 items-center border-b border-border-subtle px-3",
        ISSUE_ROW_GRID,
      )}
    >
      <Skeleton className="size-4" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-[46%]" />
        <Skeleton className="h-2.5 w-[62%]" />
      </div>
      <Skeleton className="ml-auto h-3 w-10" />
      <Skeleton className="ml-auto h-3 w-8" />
      <Skeleton className="ml-auto h-5 w-20" />
      <Skeleton className="ml-auto h-3 w-8" />
      <Skeleton className="ml-auto h-3 w-8" />
      <Skeleton className="ml-auto h-3 w-12" />
    </div>
  );
}
