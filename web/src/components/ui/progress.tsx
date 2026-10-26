// src/components/ui/progress.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indicatorClassName?: string;
}

export function Progress({
  value = 0,
  className,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <div
      data-slot="progress"
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3",
        className
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 transition-all duration-300",
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </div>
  );
}

export interface SegmentedProgressSegment {
  value: number;
  className?: string;
  title?: string;
}

export interface SegmentedProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  segments: SegmentedProgressSegment[];
}

export function SegmentedProgress({
  segments,
  className,
  ...props
}: SegmentedProgressProps) {
  return (
    <div
      data-slot="segmented-progress"
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full bg-surface-2 border border-border-subtle/80 flex",
        className
      )}
      {...props}
    >
      {segments.map((seg, i) =>
        seg.value > 0 ? (
          <div
            key={i}
            className={cn("h-full transition-all duration-500", seg.className)}
            style={{ width: `${Math.max(0, Math.min(seg.value, 100))}%` }}
            title={seg.title}
          />
        ) : null
      )}
    </div>
  );
}
