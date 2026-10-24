// src/components/ui/icon.tsx
import * as React from "react";
import type { Icon as PhosphorIcon, IconWeight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// Re-export all Phosphor icons so caller layers can import icons from "@/components/ui/icon"
// without violating the architectural law that Layer 1 is the only layer importing from @phosphor-icons/react
export * from "@phosphor-icons/react";

export interface IconProps extends Omit<React.SVGAttributes<SVGSVGElement>, "size"> {
  icon: PhosphorIcon | React.ComponentType<any>;
  size?: number | string;
  weight?: IconWeight;
  className?: string;
}

export function Icon({
  icon: IconComponent,
  size = 15,
  weight = "regular",
  className,
  ...props
}: IconProps) {
  return (
    <IconComponent
      data-slot="icon"
      size={size}
      weight={weight}
      className={cn("shrink-0", className)}
      {...props}
    />
  );
}

