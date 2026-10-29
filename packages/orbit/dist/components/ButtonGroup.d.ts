import { type ButtonProps } from './Button';
export type ButtonGroupAction = ButtonProps & {
    text: string;
};
export type ButtonGroupActions = readonly [ButtonGroupAction] | readonly [ButtonGroupAction, ButtonGroupAction];
export interface ButtonGroupProps {
    /**
     * One or two actions. The first renders as the primary (default) button, the
     * second as a quieter ghost button.
     */
    actions: ButtonGroupActions;
    /**
     * Button size applied to every action in the group.
     */
    size?: ButtonProps['size'];
}
export declare const ButtonGroup: ({ actions, size, }: ButtonGroupProps) => import("react").JSX.Element;
