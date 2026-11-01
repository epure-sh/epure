// web/src/ui/primitives/elements/button.tsx
// Orbit Button + Epure product variants, sizes, hotkey, and asChild slotting.

import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Button as OrbitButton,
  type ButtonProps as OrbitButtonProps,
} from "@polar-sh/orbit/Button";
import { cn } from "@/lib/utils";

/**
 * Mechanical active depression classes adhering to R2 and Apple/Emil Kowalski design principles.
 * Composite-only transform scale(0.97) with critically damped mechanical easing and reduced-motion zeroing.
 */
export const TACTILE_BUTTON_CLASS =
  "btn-tactile active:scale-[0.97] transition-transform duration-100 ease-[var(--ease-mechanical,cubic-bezier(0.16,1,0.3,1))] motion-reduce:active:scale-100";

/**
 * Epure product variant and size names mapped onto Orbit Button.
 */
export const buttonVariants = cva("", {
  variants: {
    variant: {
      primary: "",
      secondary: "",
      outline: "",
      ghost: "",
      danger: "",
      signal: "",
      link: "",
      filterEscalating: "",
      filterRegression: "",
    },
    size: {
      xs: "",
      sm: "",
      md: "",
      default: "",
      toolbar: "",
      lg: "",
      icon: "",
      "icon-xs": "",
    },
  },
  defaultVariants: {
    variant: "secondary",
    size: "sm",
  },
});

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

const ORBIT_VARIANT: Record<
  ButtonVariant,
  NonNullable<OrbitButtonProps["variant"]>
> = {
  primary: "default",
  signal: "default",
  danger: "destructive",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  link: "link",
  filterEscalating: "outline",
  filterRegression: "outline",
};

const ORBIT_SIZE: Record<ButtonSize, NonNullable<OrbitButtonProps["size"]>> = {
  xs: "sm",
  sm: "sm",
  md: "default",
  default: "sm",
  toolbar: "sm",
  lg: "lg",
  icon: "icon",
  "icon-xs": "icon",
};

/**
 * Orbit Button wraps children in an internal div, which breaks Radix Slot `asChild`.
 * This CVA mirrors Orbit's styles for the asChild path only, incorporating tactile
 * depression and full upstream Orbit dark-mode variant fidelity.
 */
const asChildVariants = cva(
  cn(
    "relative inline-flex items-center gap-2 cursor-pointer font-display font-[550] tracking-[0.01em] select-none justify-center rounded-full text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
    TACTILE_BUTTON_CLASS,
  ),
  {
    variants: {
      variant: {
        default:
          "bg-black dark:bg-white dark:text-black text-white hover:opacity-85 transition-opacity duration-100 hover:bg-black dark:hover:bg-white",
        destructive:
          "bg-red-500 dark:bg-red-600 text-white hover:bg-red-400 dark:hover:bg-red-500",
        outline:
          "text-black dark:text-white hover:bg-gray-200 dark:bg-transparent dark:hover:bg-polar-700 border-transparent hover:border-gray-200 border dark:border-polar-700 bg-transparent border-gray-100",
        secondary:
          "text-black dark:text-white hover:bg-gray-200 dark:bg-polar-700 dark:hover:bg-polar-600 bg-gray-100 border dark:border-white/5 border-black/4",
        underline:
          "text-black dark:text-white bg-transparent border-b hover:border-black dark:hover:border-white border-transparent transition-colors duration-300 p-0! hover:bg-transparent rounded-none!",
        link: "text-blue-400 underline-offset-4 hover:underline bg-transparent hover:bg-transparent",
        ghost:
          "bg-transparent hover:bg-gray-200 dark:hover:bg-polar-700 dark:bg-transparent text-black dark:text-white",
      },
      size: {
        default: "h-10 px-5 py-3 text-sm",
        sm: "h-8 px-3 py-1.5 text-xs",
        lg: "h-12 px-5 py-4 text-sm",
        icon: "flex items-center justify-center aspect-square p-2 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Product overlays for filter tokens and compact sizes.
 */
const PRODUCT_CLASS: Partial<Record<ButtonVariant | ButtonSize, string>> = {
  filterEscalating:
    "bg-badge-escalating-bg text-escalating border-badge-escalating-border hover:bg-badge-escalating-border/40",
  filterRegression:
    "bg-badge-regression-bg text-regression border-badge-regression-border hover:bg-badge-regression-border/40",
  xs: "h-6 min-h-6 px-2 text-[11px]",
  toolbar: "h-7 min-h-7 px-2 text-xs",
  "icon-xs": "size-6 min-h-6 p-0",
  md: "h-8 min-h-8",
};

export interface ButtonProps
  extends Omit<React.ComponentProps<"button">, "className">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  hotkey?: string;
  loading?: boolean;
  className?: string;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "sm",
    asChild = false,
    hotkey,
    loading = false,
    disabled,
    children,
    className,
    type = "button",
    fullWidth,
    ...props
  },
  ref,
) {
  const orbitVariant = ORBIT_VARIANT[variant ?? "secondary"];
  const orbitSize = ORBIT_SIZE[size ?? "sm"];
  const productClass = cn(
    PRODUCT_CLASS[variant ?? "secondary"],
    PRODUCT_CLASS[size ?? "sm"],
    fullWidth ? "w-full" : undefined,
  );

  const hotkeyElement = hotkey ? (
    <kbd
      data-slot="kbd"
      aria-hidden="true"
      className={cn(
        "ml-1 inline-flex h-4 items-center rounded border px-1.5 font-mono text-[10px] font-normal select-none",
        variant === "primary" || variant === "signal"
          ? "border-white/20 bg-white/20 text-white dark:border-black/20 dark:bg-black/10 dark:text-black"
          : "border-border bg-surface-inset text-fg-muted",
      )}
    >
      {hotkey}
    </kbd>
  ) : null;

  if (asChild) {
    return (
      <Slot
        ref={ref}
        data-slot="button"
        className={cn(
          asChildVariants({ variant: orbitVariant, size: orbitSize }),
          productClass,
          className,
        )}
        {...props}
      >
        <Slottable>{children}</Slottable>
        {hotkeyElement}
      </Slot>
    );
  }

  return (
    <OrbitButton
      ref={ref as React.RefObject<HTMLButtonElement>}
      data-slot="button"
      type={type}
      variant={orbitVariant}
      size={orbitSize}
      loading={loading}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      className={cn(TACTILE_BUTTON_CLASS, productClass || undefined, className)}
      {...(props as Omit<
        OrbitButtonProps,
        | "variant"
        | "size"
        | "loading"
        | "fullWidth"
        | "className"
        | "type"
        | "disabled"
        | "children"
      >)}
    >
      {children}
      {hotkeyElement}
    </OrbitButton>
  );
});
Button.displayName = "Button";
