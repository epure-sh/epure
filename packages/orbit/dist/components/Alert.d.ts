import type { ReactNode } from 'react';
import { type ButtonGroupActions } from './ButtonGroup';
export type AlertVariant = 'info' | 'warning' | 'danger' | 'success';
export interface AlertProps {
    /**
     * Picks the icon, surface tint and accent color in one go. Use it to map the
     * alert to its meaning rather than styling icon and colors by hand.
     */
    variant?: AlertVariant;
    /**
     * The headline of the alert, rendered in the variant's accent color.
     */
    title: string;
    /**
     * Supporting copy shown beneath the title. Accepts inline elements (links,
     * bold text, …), not just a plain string. Omit for a title-only alert.
     */
    description?: ReactNode;
    /**
     * Swaps the variant icon for a spinner, for an alert whose subject is still
     * resolving. Colors and layout are unchanged.
     */
    loading?: boolean;
    /**
     * Called when the dismiss button is pressed. Provide it to render a dismiss
     * button; omit it for a persistent alert.
     */
    onDismiss?: () => void;
    /**
     * One or two call-to-action buttons, rendered bottom-right via ButtonGroup.
     * The first is the primary action, the second a quieter ghost button.
     */
    actions?: ButtonGroupActions;
}
export declare const Alert: ({ variant, title, description, loading, onDismiss, actions, }: AlertProps) => import("react").JSX.Element;
