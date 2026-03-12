import { forwardRef, type ReactElement } from "react";
import { Button, type ButtonProps } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export interface ActionButtonProps extends ButtonProps {
  tooltip?: string;
}

/**
 * Button that can show a tooltip when disabled (native disabled buttons block hover).
 */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton({ tooltip, disabled, children, ...props }, ref): ReactElement {
    const button = (
      <Button ref={ref} disabled={disabled} aria-disabled={disabled || undefined} {...props}>
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
