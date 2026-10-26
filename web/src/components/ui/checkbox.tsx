// src/components/ui/checkbox.tsx
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "className"> {
  className?: string;
}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative inline-flex size-4 shrink-0 items-center justify-center rounded-xs cursor-pointer",
        "border border-border-strong bg-surface-1 text-primary-fg",
        "transition-[color,background-color,border-color,box-shadow] duration-150 ease-snap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
        "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary",
        "disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" weight="bold" />
        ) : (
          <Check className="size-3" weight="bold" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
