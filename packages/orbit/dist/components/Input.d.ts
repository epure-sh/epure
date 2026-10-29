import { Input as ShadInput } from './ui/input';
import { ComponentProps } from 'react';
export type InputProps = ComponentProps<typeof ShadInput> & {
    preSlot?: React.ReactNode;
    postSlot?: React.ReactNode;
};
declare const Input: {
    ({ ref, preSlot, postSlot, className, ...props }: InputProps): import("react").JSX.Element;
    displayName: string;
};
export { Input };
