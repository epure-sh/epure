import React from 'react';
import { ButtonProps as ShadcnButtonProps } from './ui/button';
export type ButtonProps = ShadcnButtonProps & {
    wrapperClassNames?: string;
    loading?: boolean;
    fullWidth?: boolean;
};
declare const Button: {
    ({ ref, className, wrapperClassNames, variant, size, loading, fullWidth, disabled, children, type, ...props }: ButtonProps & {
        ref?: React.RefObject<HTMLButtonElement>;
    }): React.JSX.Element;
    displayName: string;
};
export { Button };
