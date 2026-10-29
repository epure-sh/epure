import * as React from 'react';
import { SelectContent as SelectContentPrimitive, SelectItem as SelectItemPrimitive, SelectLabel as SelectLabelPrimitive, SelectSeparator as SelectSeparatorPrimitive, SelectTrigger as SelectTriggerPrimitive, SelectValue as SelectValuePrimitive } from './ui/select';
import { Trigger as SelectTriggerBase } from '@radix-ui/react-select';
declare const Select: React.FC<import("@radix-ui/react-select").SelectProps>;
declare const SelectGroup: React.ForwardRefExoticComponent<import("@radix-ui/react-select").SelectGroupProps & React.RefAttributes<HTMLDivElement>>;
declare const SelectValue: {
    ({ ...props }: React.ComponentProps<typeof SelectValuePrimitive>): React.JSX.Element;
    displayName: string;
};
declare const SelectTrigger: {
    ({ ref, className, children, ...props }: React.ComponentProps<typeof SelectTriggerPrimitive>): React.JSX.Element;
    displayName: string;
};
declare const SelectContent: {
    ({ ref, className, children, position, ...props }: React.ComponentProps<typeof SelectContentPrimitive>): React.JSX.Element;
    displayName: string;
};
declare const SelectLabel: {
    ({ ref, className, ...props }: React.ComponentProps<typeof SelectLabelPrimitive>): React.JSX.Element;
    displayName: string;
};
declare const SelectItem: {
    ({ ref, className, children, ...props }: React.ComponentProps<typeof SelectItemPrimitive>): React.JSX.Element;
    displayName: string;
};
declare const SelectSeparator: {
    ({ ref, className, ...props }: React.ComponentProps<typeof SelectSeparatorPrimitive>): React.JSX.Element;
    displayName: string;
};
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectTriggerBase, SelectValue, };
