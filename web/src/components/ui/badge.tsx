// src/components/ui/badge.tsx — Phase 2: Orbit Pill under Epure Badge API
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Pill, type PillColor } from "@polar-sh/orbit/Pill";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("", {
  variants: {
    variant: {
      neutral: "",
      escalating: "",
      regression: "",
      healthy: "",
      info: "",
      warning: "",
      error: "",
      accent: "",
      env: "",
      flat: "",
      resolved: "",
      default: "",
      secondary: "",
    },
    size: {
      sm: "",
      md: "",
      default: "",
      compact: "",
    },
  },
  defaultVariants: {
    variant: "neutral",
    size: "sm",
  },
});

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof badgeVariants> {}

type EpureBadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

const PILL_COLOR: Record<EpureBadgeVariant, PillColor> = {
  neutral: "gray",
  default: "gray",
  secondary: "gray",
  env: "gray",
  flat: "gray",
  escalating: "red",
  error: "red",
  regression: "yellow",
  warning: "yellow",
  healthy: "green",
  resolved: "green",
  info: "blue",
  accent: "gray",
};

const SIZE_CLASS: Record<
  NonNullable<VariantProps<typeof badgeVariants>["size"]>,
  string
> = {
  sm: "h-5 min-h-5 px-1.5 text-[11px]",
  default: "h-5 min-h-5 px-1.5 text-[11px]",
  md: "h-6 min-h-6 px-2 text-xs",
  compact: "h-4 min-h-4 px-1.5 text-[10px]",
};

/** Epure Badge → Orbit Pill (no wrapper span — Pill is the surface). */
export function Badge({
  variant = "neutral",
  size = "sm",
  className,
  children,
}: BadgeProps) {
  const v = variant ?? "neutral";
  const s = size ?? "sm";

  return (
    <Pill color={PILL_COLOR[v]} className={cn(SIZE_CLASS[s], className)}>
      {children}
    </Pill>
  );
}
