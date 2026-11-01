// web/src/ui/primitives/elements/switch.tsx
// Orbit Switch (Radix) with Epure size and onCheckedChange API.

import * as React from "react";
import { Switch as OrbitSwitch } from "@polar-sh/orbit/Switch";
import { cn } from "@/lib/utils";

const switchSizeClass = {
  default: "",
  compact: "scale-90 origin-left",
} as const;

export interface SwitchProps
  extends Omit<
    React.ComponentProps<typeof OrbitSwitch>,
    "className" | "onCheckedChange"
  > {
  className?: string;
  size?: keyof typeof switchSizeClass;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  className,
  size = "default",
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <OrbitSwitch
      data-slot="switch"
      data-size={size}
      className={cn(switchSizeClass[size], className)}
      onCheckedChange={onCheckedChange}
      {...props}
    />
  );
}
