import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as React from 'react';
export interface CheckboxProps extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
    emphasized?: boolean;
    label?: string;
}
declare const Checkbox: {
    ({ ref, className, emphasized, label, ...props }: CheckboxProps): React.JSX.Element;
    displayName: string;
};
export { Checkbox };
