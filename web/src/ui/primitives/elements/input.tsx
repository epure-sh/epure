// web/src/ui/primitives/elements/input.tsx
// Orbit Input + Epure leading/trailing slots and size variants.

import * as React from "react";
import { type VariantProps, cva } from "class-variance-authority";
import { Input as OrbitInput } from "@polar-sh/orbit/Input";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { cn } from "@/lib/utils";

const inputSizeVariants = cva("", {
  variants: {
    variant: {
      default:
        "focus:border-accent focus:ring-0 focus-visible:border-accent focus-visible:ring-0 dark:focus:border-accent",
      ghost:
        "border-transparent bg-transparent shadow-none focus:border-transparent focus:ring-0 focus-visible:ring-0",
    },
    size: {
      sm: "h-8! min-h-8 py-0 text-xs rounded-full!",
      md: "h-10! min-h-10 py-0 text-sm rounded-xl!",
      auto: "h-auto min-h-8",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "sm",
  },
});

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size" | "className">,
    VariantProps<typeof inputSizeVariants> {
  leadingIcon?: React.ReactNode;
  trailingShortcut?: string;
  className?: string;
  /** Merged onto the Orbit input control (wrapper is Orbit-owned). */
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      variant = "default",
      size = "sm",
      leadingIcon,
      trailingShortcut,
      className,
      wrapperClassName,
      type = "text",
      ...props
    },
    ref,
  ) {
    const sizeClass = inputSizeVariants({ variant, size });

    return (
      <OrbitInput
        ref={ref}
        data-slot="input"
        type={type}
        className={cn(sizeClass, wrapperClassName, className)}
        preSlot={leadingIcon ?? undefined}
        postSlot={
          trailingShortcut ? (
            <Box as="span" data-slot="kbd">
              <Text as="span" variant="caption" color="muted" monospace>
                {trailingShortcut}
              </Text>
            </Box>
          ) : undefined
        }
        {...props}
      />
    );
  },
);
