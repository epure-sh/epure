import * as React from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

const switchSizes = {
  default: {
    root: "h-[26px] w-[46px] p-0.5",
    thumb: "size-[22px] data-[checked]:translate-x-5",
  },
  compact: {
    root: "h-5 w-[2.375rem] p-px",
    thumb: "size-[18px] data-[checked]:translate-x-[1.125rem]",
  },
} as const;

export interface SwitchProps
  extends Omit<React.ComponentProps<typeof BaseSwitch.Root>, "className" | "onCheckedChange"> {
  className?: string;
  size?: keyof typeof switchSizes;
  onCheckedChange?: (checked: boolean) => void;
}

/** Calm Ledger toggle — flat thumb, accent when on, hairline off track (Base UI). */
export function Switch({ className, size = "default", onCheckedChange, ...props }: SwitchProps) {
  const dims = switchSizes[size];

  return (
    <BaseSwitch.Root
      data-slot="switch"
      data-size={size}
      nativeButton
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full",
        "bg-fg-muted/15 transition-[background-color,box-shadow] duration-150 ease-out",
        "ring-1 ring-inset ring-border-subtle/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "data-[checked]:bg-accent data-[checked]:ring-accent/30",
        dims.root,
        className,
      )}
      onCheckedChange={
        onCheckedChange
          ? (checked) => {
              onCheckedChange(checked);
            }
          : undefined
      }
      {...props}
    >
      <BaseSwitch.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-surface shadow-none",
          "transition-transform duration-150 ease-out will-change-transform",
          "translate-x-0",
          dims.thumb,
        )}
      />
    </BaseSwitch.Root>
  );
}
