import { type VariantProps } from 'class-variance-authority';
import * as React from 'react';
declare const buttonVariants: (props?: {
    variant?: "default" | "outline" | "link" | "destructive" | "secondary" | "ghost";
    size?: "default" | "sm" | "lg" | "icon";
} & import("class-variance-authority/types").ClassProp) => string;
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}
declare const Button: {
    ({ ref, className, variant, size, asChild, ...props }: ButtonProps & {
        ref?: React.RefObject<HTMLButtonElement>;
    }): React.JSX.Element;
    displayName: string;
};
export { Button, buttonVariants };
