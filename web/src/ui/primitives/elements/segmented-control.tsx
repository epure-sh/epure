// web/src/ui/primitives/elements/segmented-control.tsx
// Orbit SegmentedControl compound primitive enhanced with accessible radiogroup semantics,
// WAI-ARIA arrow key navigation, roving tabindex, and tactile feedback.

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const segmentedControlVariants = cva("flex items-center gap-x-1 p-1", {
  variants: {
    size: {
      sm: "rounded-full",
      md: "rounded-full",
      lg: "rounded-full",
    },
    variant: {
      default: "dark:bg-polar-800 bg-gray-50",
      tabs: "dark:bg-polar-950 w-full bg-gray-100",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
  },
});

export const segmentedControlItemVariants = cva(
  "relative inline-flex items-center justify-center cursor-pointer font-medium select-none transition-all duration-150 ease-[var(--ease-mechanical,cubic-bezier(0.16,1,0.3,1))] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "px-2.5 py-1 text-xs",
        md: "px-3 py-1.5 text-xs",
        lg: "px-4 py-2 text-sm",
      },
      variant: {
        default: "rounded-full",
        tabs: "grow rounded-full",
      },
      active: {
        true: "",
        false:
          "dark:text-polar-500 text-gray-500 hover:text-gray-900 dark:hover:text-white",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        active: true,
        className:
          "dark:bg-polar-700 bg-white text-black shadow-lg dark:text-white",
      },
      {
        variant: "tabs",
        active: true,
        className:
          "dark:bg-polar-800 bg-white text-black shadow-lg dark:text-white",
      },
    ],
    defaultVariants: {
      size: "md",
      variant: "default",
      active: false,
    },
  },
);

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: VariantProps<typeof segmentedControlVariants>["size"];
  variant?: VariantProps<typeof segmentedControlVariants>["variant"];
  className?: string;
  name?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  variant = "default",
  className,
  name: _name,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SegmentedControlProps<T>) {
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (disabled || options.length === 0) return;

    let targetIndex = -1;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown": {
        e.preventDefault();
        for (let step = 1; step <= options.length; step++) {
          const idx = (currentIndex + step) % options.length;
          if (!options[idx].disabled) {
            targetIndex = idx;
            break;
          }
        }
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        e.preventDefault();
        for (let step = 1; step <= options.length; step++) {
          const idx = (currentIndex - step + options.length) % options.length;
          if (!options[idx].disabled) {
            targetIndex = idx;
            break;
          }
        }
        break;
      }
      case "Home": {
        e.preventDefault();
        const first = options.findIndex((opt) => !opt.disabled);
        if (first !== -1) targetIndex = first;
        break;
      }
      case "End": {
        e.preventDefault();
        for (let i = options.length - 1; i >= 0; i--) {
          if (!options[i].disabled) {
            targetIndex = i;
            break;
          }
        }
        break;
      }
    }

    if (targetIndex !== -1 && targetIndex !== currentIndex) {
      const nextOpt = options[targetIndex];
      onChange(nextOpt.value);
      itemRefs.current[targetIndex]?.focus();
    }
  };

  const activeIndex = options.findIndex((o) => o.value === value);

  return (
    <div
      role="radiogroup"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-slot="segmented-control"
      className={cn(segmentedControlVariants({ size, variant }), className)}
    >
      {options.map((option, idx) => {
        const isSelected = value === option.value;
        const isItemDisabled = Boolean(disabled || option.disabled);
        const isFirstEnabled = options.findIndex((o) => !o.disabled) === idx;
        const isTabbable = isSelected || (activeIndex === -1 && isFirstEnabled);

        return (
          <button
            key={option.value}
            ref={(el) => {
              itemRefs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isItemDisabled}
            tabIndex={isTabbable ? 0 : -1}
            data-slot="segmented-control-item"
            data-state={isSelected ? "checked" : "unchecked"}
            onClick={() => {
              if (!isItemDisabled && !isSelected) {
                onChange(option.value);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              segmentedControlItemVariants({
                size,
                variant,
                active: isSelected,
              }),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
