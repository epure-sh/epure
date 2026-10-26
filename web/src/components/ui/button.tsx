// src/components/ui/button.tsx
import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control",
    "text-xs font-medium tracking-tight select-none tabular-nums",
    "transition-[background-color,border-color,transform,opacity] duration-100 ease-out",
    "active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-contrast shadow-tactile hover:opacity-90",
        secondary: "bg-accent-muted text-accent border border-transparent shadow-tactile hover:bg-state-hover",
        outline: "bg-transparent text-fg-secondary border border-border-subtle hover:bg-surface-2 hover:text-fg-primary hover:border-border-strong",
        ghost: "bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary active:translate-y-0",
        danger:
          "bg-badge-escalating-bg text-escalating border border-badge-escalating-border hover:bg-badge-escalating-border/40",
        signal: "bg-accent text-accent-contrast shadow-tactile hover:opacity-90",
        link: "bg-transparent text-fg-primary underline-offset-4 hover:underline",
        filterEscalating:
          "bg-badge-escalating-bg text-escalating border border-badge-escalating-border shadow-tactile hover:bg-badge-escalating-border/40",
        filterRegression:
          "bg-badge-regression-bg text-regression border border-badge-regression-border shadow-tactile hover:bg-badge-regression-border/40",
      },
      size: {
        xs: "h-6 px-2 text-[11px] rounded-xs",
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-xs",
        default: "h-7 px-2.5 text-xs",
        toolbar: "h-7 px-2 text-xs",
        lg: "h-8 px-3 text-xs",
        icon: "size-7 p-0",
        "icon-xs": "size-6 p-0 rounded-xs",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "sm",
    },
  }
);

export interface ButtonProps
  extends Omit<React.ComponentProps<"button">, "className">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  hotkey?: string;
  loading?: boolean;
  className?: string;
}

export function Button({
  variant,
  size,
  asChild = false,
  hotkey,
  loading = false,
  disabled,
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <CircleNotch className="animate-spin" weight="bold" /> : null}
      <Slottable>{children}</Slottable>
      {hotkey ? (
        <kbd
          data-slot="kbd"
          className="ml-1 inline-flex h-4 items-center rounded-[3px] border border-border-subtle bg-surface-3/70 px-1 font-mono text-[10px] font-normal text-fg-muted"
        >
          {hotkey}
        </kbd>
      ) : null}
    </Comp>
  );
}
