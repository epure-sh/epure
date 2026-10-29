// src/components/ui/tabs.tsx — Phase 2: Orbit Tabs + Epure line/folder variants
import * as React from "react";
import {
  Tabs as OrbitTabs,
  TabsContent as OrbitTabsContent,
  TabsList as OrbitTabsList,
  TabsTrigger as OrbitTabsTrigger,
} from "@polar-sh/orbit/Tabs";
import { cn } from "@/lib/utils";

export type TabsVariant = "default" | "line" | "folder";

interface TabsContextValue {
  variant: TabsVariant;
}

const TabsContext = React.createContext<TabsContextValue>({ variant: "default" });

export interface TabsProps extends React.ComponentProps<typeof OrbitTabs> {
  variant?: TabsVariant;
}

export function Tabs({
  variant = "default",
  className,
  ...props
}: TabsProps) {
  return (
    <TabsContext.Provider value={{ variant }}>
      <OrbitTabs data-slot="tabs" className={cn(className)} {...props} />
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.ComponentProps<typeof OrbitTabsList> {
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
    <OrbitTabsList
      data-slot="tabs-list"
      className={cn(
        variant === "line"
          ? "h-auto gap-1 rounded-none border-b border-border/80 bg-transparent p-0 ring-0"
          : variant === "folder"
            ? "h-9 w-full items-end gap-1 rounded-none border-b border-border-subtle bg-surface-2 px-2 pt-1 ring-0"
            : undefined,
        className,
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps
  extends React.ComponentProps<typeof OrbitTabsTrigger> {
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
    <OrbitTabsTrigger
      data-slot="tabs-trigger"
      size="small"
      className={cn(
        "cursor-pointer",
        variant === "line"
          ? "rounded-none border-b-2 border-transparent px-3 py-1.5 text-fg-muted shadow-none hover:text-fg-primary data-[state=active]:rounded-none data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-fg-primary data-[state=active]:shadow-none"
          : variant === "folder"
            ? "-mb-px rounded-t-md border border-transparent px-3 py-1.5 text-fg-muted shadow-none hover:text-fg-primary data-[state=active]:rounded-t-md data-[state=active]:border-border-subtle data-[state=active]:border-b-surface-1 data-[state=active]:bg-surface-1 data-[state=active]:font-semibold data-[state=active]:text-fg-primary data-[state=active]:shadow-none"
            : undefined,
        className,
      )}
      {...props}
    />
  );
}

export interface TabsContentProps
  extends React.ComponentProps<typeof OrbitTabsContent> {}

export function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <OrbitTabsContent
      data-slot="tabs-content"
      className={cn(
        "min-h-0 flex-1 outline-none focus-visible:outline-none data-[state=inactive]:hidden data-[state=inactive]:!hidden",
        className,
      )}
      {...props}
    />
  );
}
