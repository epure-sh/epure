import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "epure-badge inline-flex items-center rounded-md border font-medium transition-colors",
  {
    variants: {
      size: {
        default: "px-2 py-0.5 text-xs",
        compact: "h-4 px-1.5 text-2xs leading-none",
      },
      variant: {
        error:
          "border-semantic-danger/30 bg-semantic-danger/10 text-semantic-danger",
        warning:
          "border-semantic-warning/30 bg-semantic-warning/10 text-semantic-warning",
        env: "border-border bg-bg-subtle text-ink-muted",
        info: "border-info/30 bg-info/10 text-info",
        resolved: "border-border bg-bg-subtle text-ink-muted",
        default: "border-border bg-surface text-ink",
        secondary: "border-transparent bg-bg-subtle text-ink-muted",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "env",
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size, className }))} {...props} />;
}
