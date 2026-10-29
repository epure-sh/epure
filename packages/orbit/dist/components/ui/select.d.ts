import * as SelectPrimitive from '@radix-ui/react-select';
import * as React from 'react';
declare const Select: React.FC<SelectPrimitive.SelectProps>;
declare const SelectGroup: React.ForwardRefExoticComponent<SelectPrimitive.SelectGroupProps & React.RefAttributes<HTMLDivElement>>;
declare const SelectValue: React.ForwardRefExoticComponent<SelectPrimitive.SelectValueProps & React.RefAttributes<HTMLSpanElement>>;
declare const SelectTrigger: {
    ({ ref, className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>): React.JSX.Element;
    displayName: string;
};
declare const SelectScrollUpButton: {
    ({ ref, className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>): React.JSX.Element;
    displayName: string;
};
declare const SelectScrollDownButton: {
    ({ ref, className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>): React.JSX.Element;
    displayName: string;
};
declare const SelectContent: {
    ({ ref, className, children, position, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>): React.JSX.Element;
    displayName: string;
};
declare const SelectLabel: {
    ({ ref, className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>): React.JSX.Element;
    displayName: string;
};
declare const SelectItem: {
    ({ ref, className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>): React.JSX.Element;
    displayName: string;
};
declare const SelectSeparator: {
    ({ ref, className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>): React.JSX.Element;
    displayName: string;
};
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue, };
