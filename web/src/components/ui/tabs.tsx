// src/components/ui/tabs.tsx
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export type TabsVariant = "default" | "line";

interface TabsContextValue {
  variant: TabsVariant;
}

const TabsContext = React.createContext<TabsContextValue>({ variant: "default" });

export interface TabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {
  variant?: TabsVariant;
}

export function Tabs({
  variant = "default",
  className,
  ...props
}: TabsProps) {
  return (
    <TabsContext.Provider value={{ variant }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn(className)}
        {...props}
      />
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.ComponentProps<typeof TabsPrimitive.List> {
  variant?: TabsVariant;
}

export function TabsList({
  className,
  variant: variantProp,
  ...props
}: TabsListProps) {
  const context = React.useContext(TabsContext);
  const variant = variantProp ?? context.variant;

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        variant === "line"
          ? "inline-flex items-center gap-1 border-b border-border/80 bg-transparent p-0 text-fg-muted"
          : "inline-flex h-8 items-center justify-center rounded-control bg-surface-2 p-0.5 text-fg-muted",
        className
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends React.ComponentProps<typeof TabsPrimitive.Trigger> {
  variant?: TabsVariant;
}

export function TabsTrigger({
  className,
  variant: variantProp,
  ...props
}: TabsTriggerProps) {
  const context = React.useContext(TabsContext);
  const variant = variantProp ?? context.variant;

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong disabled:pointer-events-none disabled:opacity-40",
        variant === "line"
          ? "rounded-none border-b-2 border-transparent px-3 py-1.5 text-fg-muted hover:text-fg-primary data-[state=active]:border-accent data-[state=active]:text-fg-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          : "rounded-xs px-2.5 py-1 text-fg-secondary hover:text-fg-primary data-[state=active]:bg-surface-1 data-[state=active]:text-fg-primary data-[state=active]:shadow-tactile",
        className
      )}
      {...props}
    />
  );
}

export interface TabsContentProps extends React.ComponentProps<typeof TabsPrimitive.Content> {}

export function TabsContent({
  className,
  ...props
}: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "min-h-0 flex-1 outline-none focus-visible:outline-none data-[state=inactive]:hidden data-[state=inactive]:!hidden",
        className
      )}
      {...props}
    />
  );
}
