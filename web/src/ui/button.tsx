import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

/** shadcn/new-york — colors via Epure tokens; tweak sizes in `size` variants only */
export const buttonVariants = cva(
  "epure-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-contrast hover:bg-accent/90",
        signal: "bg-signal text-signal-contrast hover:bg-signal/90",
        secondary:
          "border border-border/80 bg-transparent text-ink hover:border-border hover:bg-bg-subtle/40",
        ghost: "text-ink-muted hover:bg-bg-subtle/60 hover:text-ink",
        danger:
          "border border-semantic-danger/40 bg-surface text-semantic-danger hover:bg-semantic-danger/5",
        outline: "border border-border bg-surface text-ink hover:bg-bg-subtle",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-control px-3",
        sm: "h-control-sm rounded-md px-2.5 text-xs",
        toolbar: "h-control-sm gap-1 px-2 text-xs",
        lg: "h-control-lg rounded-md px-4",
        icon: "h-control-sm w-control-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        data-variant={variant ?? "primary"}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
