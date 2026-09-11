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
  danger: "epure-regression-strip border-l-[3px] border-l-semantic-danger",
  warning: "border-l-[3px] border-l-semantic-warning",
  signal: "border-l-[length:var(--unread-bar-width)] border-l-signal",
  none: "",
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
            "flex w-full rounded-lg border border-border bg-surface text-left transition-colors duration-fast",
            "hover:border-border-strong hover:bg-state-hover focus-ring",
          ],
          variant === "flat" &&
            "flex w-full border-b border-border text-left transition-colors duration-fast hover:bg-state-hover focus-ring",
          accentClasses[accent],
          className,
        )}
        {...props}
      />
    );
  },
);
ListRow.displayName = "ListRow";
