// src/components/ui/badge.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  [
    "inline-flex items-center justify-center font-medium select-none tabular-nums rounded-control",
    "border transition-[color,background-color,border-color] duration-150 ease-snap",
  ],
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-fg-secondary border-border-subtle",
        escalating: "bg-escalating/15 text-escalating border-escalating/30",
        regression: "bg-regression/15 text-regression border-regression/30",
        healthy: "bg-healthy/15 text-healthy border-healthy/30",
        info: "bg-info/15 text-info border-info/30",
        warning: "bg-regression/15 text-regression border-regression/30",
        error: "bg-escalating/15 text-escalating border-escalating/30",
        env: "bg-surface-2 text-fg-secondary border-border-subtle",
        flat: "bg-surface-2 text-fg-secondary border-transparent",
        resolved: "bg-healthy/15 text-healthy border-healthy/30",
        default: "bg-surface-2 text-fg-secondary border-border-subtle",
        secondary: "bg-surface-2 text-fg-secondary border-border-subtle",
      },
      size: {
        sm: "h-5 px-1.5 text-[11px] gap-1",
        md: "h-6 px-2 text-xs gap-1.5",
        default: "h-5 px-1.5 text-[11px] gap-1",
        compact: "h-4 px-1.5 text-[10px] gap-1",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "sm",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({
  variant,
  size,
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          data-slot="badge-dot"
          className="size-1.5 rounded-full bg-current shrink-0"
        />
      )}
      {children}
    </span>
  );
}
