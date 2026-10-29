import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Circle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-border-strong bg-surface-1 text-fg-primary shadow-xs",
        "transition-[background-color,border-color,transform,color] duration-150 ease-[var(--ease-mechanical,cubic-bezier(0.16,1,0.3,1))]",
        "active:scale-[0.92] motion-reduce:active:scale-100",
        "hover:border-fg-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-fg-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-fg-primary data-[state=checked]:bg-fg-primary data-[state=checked]:text-surface-canvas",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center data-[state=checked]:animate-in data-[state=checked]:zoom-in-95 data-[state=checked]:duration-100">
        <Circle className="size-2 fill-current text-current" weight="fill" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
