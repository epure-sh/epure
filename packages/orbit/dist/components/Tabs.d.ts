import * as React from 'react';
import { TabsContent as TabsContentPrimitive, TabsList as TabsListPrimitive, TabsTrigger as TabsTriggerPrimitive } from './ui/tabs';
declare const Tabs: React.ForwardRefExoticComponent<import("@radix-ui/react-tabs").TabsProps & React.RefAttributes<HTMLDivElement>>;
declare const TabsList: {
    ({ ref, className, vertical, ...props }: React.ComponentProps<typeof TabsListPrimitive> & {
        vertical?: boolean;
    }): React.JSX.Element;
    displayName: string;
};
declare const TabsTrigger: {
    ({ ref, className, size, ...props }: React.ComponentProps<typeof TabsTriggerPrimitive> & {
        size?: "default" | "small";
    }): React.JSX.Element;
    displayName: string;
};
declare const TabsContent: {
    ({ ref, className, ...props }: React.ComponentProps<typeof TabsContentPrimitive>): React.JSX.Element;
    displayName: string;
};
export { Tabs, TabsContent, TabsList, TabsTrigger };
