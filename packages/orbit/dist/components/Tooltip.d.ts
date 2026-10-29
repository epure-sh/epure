import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';
declare const TooltipProvider: React.FC<TooltipPrimitive.TooltipProviderProps>;
declare const Tooltip: React.FC<TooltipPrimitive.TooltipProps>;
declare const TooltipTrigger: React.ForwardRefExoticComponent<TooltipPrimitive.TooltipTriggerProps & React.RefAttributes<HTMLButtonElement>>;
declare const TooltipContent: {
    ({ ref, className, sideOffset, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>): React.JSX.Element;
    displayName: string;
};
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
