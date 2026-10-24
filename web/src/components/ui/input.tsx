// src/components/ui/input.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputWrapperVariants = cva(
  [
    "flex w-full items-center gap-2 rounded-control border border-border-subtle bg-surface-1 px-2.5",
    "text-xs text-fg-primary transition-colors duration-100",
    "focus-within:border-border-strong focus-within:bg-surface-2/50",
    "has-[input:disabled]:opacity-40 has-[input:disabled]:pointer-events-none",
  ],
  {
    variants: {
      size: {
        sm: "h-7",
        md: "h-8",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size" | "className">,
    VariantProps<typeof inputWrapperVariants> {
  leadingIcon?: React.ReactNode;
  trailingShortcut?: string;
  className?: string;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      size,
      leadingIcon,
      trailingShortcut,
      className,
      wrapperClassName,
      type = "text",
      ...props
    },
    ref
  ) {
    return (
      <div
        data-slot="input-wrapper"
        className={cn(inputWrapperVariants({ size }), wrapperClassName, className)}
      >
        {leadingIcon && (
          <span className="text-fg-muted [&_svg]:size-3.5 shrink-0 flex items-center justify-center">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          data-slot="input"
          type={type}
          className="w-full bg-transparent text-xs text-fg-primary placeholder:text-fg-muted focus:outline-none tabular-nums"
          {...props}
        />
        {trailingShortcut && (
          <kbd
            data-slot="kbd"
            className="shrink-0 rounded-[3px] border border-border-subtle bg-surface-3/70 px-1 font-mono text-[10px] text-fg-muted"
          >
            {trailingShortcut}
          </kbd>
        )}
      </div>
    );
  }
);
