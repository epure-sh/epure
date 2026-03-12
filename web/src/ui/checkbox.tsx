import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/cn";

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "epure-checkbox flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface transition-colors duration-fast focus-ring data-[state=checked]:border-accent data-[state=checked]:bg-accent-muted/60 data-[state=checked]:text-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3 w-3 [[data-state=indeterminate]_&]:hidden" strokeWidth={2.5} />
      <span className="hidden h-0.5 w-2 rounded-sm bg-accent [[data-state=indeterminate]_&]:block" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
