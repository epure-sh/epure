// src/components/ui/badge.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  [
    "inline-flex items-center justify-center font-medium select-none tabular-nums rounded-control",
    "border border-solid bg-opacity-100 transition-colors duration-100",
  ],
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-fg-secondary border-border-subtle",
        escalating: "bg-badge-escalating-bg text-escalating border-badge-escalating-border",
        regression: "bg-badge-regression-bg text-regression border-badge-regression-border",
        healthy: "bg-badge-healthy-bg text-healthy border-badge-healthy-border",
        info: "bg-badge-info-bg text-info border-badge-info-border",
        warning: "bg-badge-regression-bg text-regression border-badge-regression-border",
        error: "bg-badge-escalating-bg text-escalating border-badge-escalating-border",
        accent: "bg-badge-accent-bg text-badge-accent-fg border-badge-accent-border",
        env: "bg-surface-2 text-fg-secondary border-border-subtle",
        flat: "bg-surface-2 text-fg-secondary border-transparent",
        resolved: "bg-badge-healthy-bg text-healthy border-badge-healthy-border",
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
    VariantProps<typeof badgeVariants> {}

export function Badge({
  variant,
  size,
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
      {children}
    </span>
  );
}
