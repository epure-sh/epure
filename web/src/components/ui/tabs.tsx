// src/components/ui/tabs.tsx
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-control bg-surface-2 p-0.5 text-fg-muted",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-xs px-2.5 py-1 text-xs font-medium transition-all select-none",
        "text-fg-secondary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
        "data-[state=active]:bg-surface-1 data-[state=active]:text-fg-primary data-[state=active]:shadow-tactile",
        "disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("min-h-0 flex-1 outline-none focus-visible:outline-none", className)}
      {...props}
    />
  );
}
