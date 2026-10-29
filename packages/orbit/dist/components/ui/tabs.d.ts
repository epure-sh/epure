import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
declare const Tabs: React.ForwardRefExoticComponent<TabsPrimitive.TabsProps & React.RefAttributes<HTMLDivElement>>;
declare const TabsList: {
    ({ ref, className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>): React.JSX.Element;
    displayName: string;
};
declare const TabsTrigger: {
    ({ ref, className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>): React.JSX.Element;
    displayName: string;
};
declare const TabsContent: {
    ({ ref, className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>): React.JSX.Element;
    displayName: string;
};
export { Tabs, TabsContent, TabsList, TabsTrigger };
