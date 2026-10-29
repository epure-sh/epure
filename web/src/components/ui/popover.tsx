// src/components/ui/popover.tsx
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "epure-popover-content z-[100] w-72 rounded-2xl border border-gray-200 bg-white p-3 text-xs text-black shadow-md outline-none   ",
          "[transform-origin:var(--radix-popper-transform-origin,center)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "duration-150 ease-[var(--ease-out,cubic-bezier(0.23,1,0.32,1))]",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
