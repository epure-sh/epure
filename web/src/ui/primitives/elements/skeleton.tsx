// web/src/ui/primitives/elements/skeleton.tsx
// Atomic pulsing skeleton placeholder primitive.

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "epure-skeleton animate-pulse rounded-sm bg-surface-2",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}
