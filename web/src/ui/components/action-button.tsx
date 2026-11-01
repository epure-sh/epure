// web/src/ui/components/action-button.tsx
// Tier 2 Component: Action Button with Disabled Tooltip Support

import { forwardRef, type ReactElement } from "react";
import { Button, type ButtonProps, Tooltip, TooltipContent, TooltipTrigger } from "../primitives";

export interface ActionButtonProps extends ButtonProps {
  tooltip?: string;
}

/**
 * Button that can show a tooltip when disabled (native disabled buttons block hover).
 */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton({ tooltip, disabled, children, asChild, ...props }, ref): ReactElement {
    const button = (
      <Button ref={ref} disabled={disabled} aria-disabled={disabled || undefined} asChild={asChild} {...props}>
        {children}
      </Button>
    );

    if (!tooltip) {
      return button;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={disabled ? "inline-flex cursor-not-allowed" : "inline-flex"}
            tabIndex={disabled ? 0 : undefined}
          >
            {button}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  },
);

ActionButton.displayName = "ActionButton";
