import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ListRowVariant = "airy" | "flat";
export type ListRowAccent = "danger" | "warning" | "signal" | "none";

export interface ListRowProps extends HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  variant?: ListRowVariant;
  accent?: ListRowAccent;
}

const accentClasses: Record<ListRowAccent, string> = {
  danger: "border-l-2 border-l-semantic-danger",
  warning: "border-l-2 border-l-semantic-warning",
  signal: "border-l-2 border-l-signal",
  none: "border-l-2 border-l-transparent",
};

export const ListRow = forwardRef<HTMLDivElement, ListRowProps>(
  ({ className, asChild = false, variant = "flat", accent = "none", ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(
          "epure-list-row",
          variant === "airy" && [
            "epure-list-row--airy epure-issue-row--airy",
            "flex w-full rounded-panel border border-border-subtle bg-surface-1 text-left",
            "transition-[color,background-color,border-color] duration-150 ease-snap",
            "hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong",
          ],
          variant === "flat" &&
            "flex w-full text-left transition-[color,background-color] duration-150 ease-snap hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong",
          accentClasses[accent],
          className,
        )}
        {...props}
      />
    );
  },
);
ListRow.displayName = "ListRow";
