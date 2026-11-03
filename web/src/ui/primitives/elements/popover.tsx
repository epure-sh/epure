// web/src/ui/primitives/elements/popover.tsx
// Popover primitive styled with Orbit chrome and origin transforms.

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { makeForwardRef } from "@/lib/forward-ref";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = makeForwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent(
  {
    className,
    align = "start",
    sideOffset = 4,
    ...props
  },
  ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "epure-popover-content z-[1000000003] w-72 rounded-panel border-2 border-border-strong bg-surface-1 p-3 text-xs text-fg-primary shadow-float outline-none",
          "[transform-origin:var(--radix-popper-transform-origin,center)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "duration-150 ease-[var(--ease-out,cubic-bezier(0.23,1,0.32,1))]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
