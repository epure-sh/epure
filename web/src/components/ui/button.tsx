// src/components/ui/button.tsx — Phase 2: Orbit Button + Epure product variants
import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Button as OrbitButton,
  type ButtonProps as OrbitButtonProps,
} from "@polar-sh/orbit/Button";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { cn } from "@/lib/utils";

/**
 * Epure product variant / size names. Mapped onto Orbit Button where possible;
 * filter* use Orbit red/amber Tailwind ramps (Phase 3).
 *
 * Exported for `@/ui` re-exports; classes are empty — look comes from Orbit.
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

type EpureVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type EpureSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

const ORBIT_VARIANT: Record<
  EpureVariant,
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

const ORBIT_SIZE: Record<EpureSize, NonNullable<OrbitButtonProps["size"]>> = {
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
 * Orbit Button wraps children in a div, which breaks Radix Slot `asChild`.
 * Mirror Orbit's CVA for the asChild path only (see @polar-sh/orbit Button).
 */
const asChildVariants = cva(
  "relative inline-flex items-center gap-2 cursor-pointer font-display font-[550] tracking-[0.01em] select-none justify-center rounded-full text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white hover:opacity-85 transition-opacity duration-100 hover:bg-black",
        destructive: "bg-red-500 text-white hover:bg-red-400",
        outline:
          "text-black hover:bg-gray-200 border-transparent hover:border-gray-200 border bg-transparent border-gray-100",
        secondary:
          "text-black hover:bg-gray-200 bg-gray-100 border border-black/4",
        underline:
          "text-black bg-transparent border-b hover:border-black border-transparent transition-colors duration-300 p-0! hover:bg-transparent rounded-none!",
        link: "text-blue-400 underline-offset-4 hover:underline bg-transparent hover:bg-transparent",
        ghost: "bg-transparent hover:bg-gray-200 text-black",
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
 * Product-only overlays for filter / compact sizes.
 * Uses theme CSS vars (Orbit values in orbit.css) — no dark: (lint-banned on this file).
 */
const PRODUCT_CLASS: Partial<Record<EpureVariant | EpureSize, string>> = {
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

export function Button({
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
}: ButtonProps) {
  const orbitVariant = ORBIT_VARIANT[variant ?? "secondary"];
  const orbitSize = ORBIT_SIZE[size ?? "sm"];
  const productClass = cn(
    PRODUCT_CLASS[variant ?? "secondary"],
    PRODUCT_CLASS[size ?? "sm"],
    fullWidth ? "w-full" : undefined,
  );

  if (asChild) {
    return (
      <Slot
        data-slot="button"
        className={cn(
          asChildVariants({ variant: orbitVariant, size: orbitSize }),
          productClass,
          className,
        )}
        {...props}
      >
        <Slottable>{children}</Slottable>
        {hotkey ? (
          <Box
            as="span"
            data-slot="kbd"
            aria-hidden="true"
            display="inline-flex"
            alignItems="center"
            height={16}
            marginLeft="xs"
            borderRadius="s"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            backgroundColor="background-secondary"
            paddingHorizontal="xs">
            <Text as="span" variant="caption" color="muted" monospace>
              {hotkey}
            </Text>
          </Box>
        ) : null}
      </Slot>
    );
  }

  // Prefer Orbit classes; only layer product overlays (filter*/compact sizes).
  // Do not re-skin rounded/bg — spacing scale must stay Tailwind-default for Orbit.
  return (
    <OrbitButton
      data-slot="button"
      type={type}
      variant={orbitVariant}
      size={orbitSize}
      loading={loading}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      className={cn(productClass || undefined, className)}
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
      {hotkey ? (
        <kbd
          data-slot="kbd"
          aria-hidden="true"
          className={cn(
            "ml-1 inline-flex h-4 items-center rounded-full border px-1.5 font-mono text-[10px] font-normal",
            variant === "primary" || variant === "signal"
              ? "border-white/20 bg-white/20 text-white"
              : "border-gray-200 bg-gray-100 text-gray-500",
          )}
        >
          {hotkey}
        </kbd>
      ) : null}
    </OrbitButton>
  );
}
