// web/src/ui/primitives/elements/checkbox.tsx
// Orbit Checkbox wrapper with crisp border styling.

import * as React from "react";
import { Checkbox as OrbitCheckbox } from "@polar-sh/orbit/Checkbox";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.ComponentProps<typeof OrbitCheckbox>, "className"> {
  className?: string;
}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <OrbitCheckbox
      data-slot="checkbox"
      className={cn("border-2", className)}
      {...props}
    />
  );
}
