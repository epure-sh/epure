import React, { PropsWithChildren } from 'react';
export interface ListProps extends PropsWithChildren {
    className?: string;
    size?: 'small' | 'default';
}
export declare const List: ({ children, className, size }: ListProps) => React.JSX.Element;
export interface ListItemProps extends PropsWithChildren {
    className?: string;
    inactiveClassName?: string;
    selectedClassName?: string;
    children: React.ReactNode;
    selected?: boolean;
    onSelect?: (e: React.MouseEvent) => void;
    size?: 'small' | 'default';
    checked?: boolean;
    onCheckedChange?: (checked: boolean, event: React.MouseEvent) => void;
    checkboxVisible?: boolean;
    checkboxLabel?: string;
}
export declare const ListItem: ({ className, inactiveClassName, selectedClassName, children, selected, onSelect, size, checked, onCheckedChange, checkboxVisible, checkboxLabel, }: ListItemProps) => React.JSX.Element;
