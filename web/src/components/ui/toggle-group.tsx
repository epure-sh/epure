import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleGroupItemVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap rounded-xs px-3 py-1.5",
    "text-xs font-medium text-fg-muted transition-colors select-none cursor-pointer",
    "hover:text-fg-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
    "disabled:pointer-events-none disabled:opacity-40",
    "data-[state=on]:bg-surface-1 data-[state=on]:text-fg-primary data-[state=on]:font-semibold data-[state=on]:shadow-tactile",
  ],
  {
    variants: {
      size: {
        /** Matches `Button` size xs / feed toolbar (`h-7`). */
        toolbar: "h-6 gap-1 px-2 text-xs",
        sm: "h-7 px-2.5 text-xs",
        default: "h-8 px-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export type ToggleGroupProps = React.ComponentProps<typeof ToggleGroupPrimitive.Root> & {
  /** `toolbar` = `h-7` outer shell aligned with feed filter controls. */
  density?: "default" | "toolbar";
};

export function ToggleGroup({
  className,
  density = "default",
  ...props
}: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-density={density}
      className={cn(
        "inline-flex rounded-control border border-border-subtle bg-surface-2 p-0.5",
        density === "toolbar" && "h-7 items-center gap-0.5",
        density === "default" && "rounded-md border-border bg-bg-subtle/80",
        className,
      )}
      {...props}
    />
  );
}

export function ToggleGroupItem({
  className,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleGroupItemVariants>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(toggleGroupItemVariants({ size }), className)}
      {...props}
    />
  );
}
