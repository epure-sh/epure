// src/components/ui/tabs.tsx — Phase 2: Orbit Tabs + Epure line/folder (bookmark) variants
import * as React from "react";
import {
  Tabs as OrbitTabs,
  TabsContent as OrbitTabsContent,
  TabsList as OrbitTabsList,
  TabsTrigger as OrbitTabsTrigger,
} from "@polar-sh/orbit/Tabs";
import { cn } from "@/lib/utils";

/** `folder` = bookmark chrome: inactive tabs sit behind the rail; active merges into the panel. */
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
            ? "h-auto w-full items-end gap-[3px] rounded-none border-b border-border-subtle bg-transparent p-0 ring-0 shadow-none"
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
            ? [
                // Rectangular bookmark tabs (Orbit defaults to pill `rounded-xl` — kill it).
                "-mb-px !rounded-none !rounded-t-[6px] border border-border-subtle bg-surface-2",
                "px-3 py-1.5 text-xs font-medium text-fg-muted shadow-none",
                "hover:bg-[color-mix(in_srgb,var(--surface-2)_85%,var(--fg-muted))] hover:text-fg-primary",
                "data-[state=active]:!rounded-none data-[state=active]:!rounded-t-[6px]",
                // Active merges into the panel canvas (cards sit whiter on top).
                "data-[state=active]:border-border-subtle data-[state=active]:border-b-canvas",
                "data-[state=active]:bg-canvas data-[state=active]:font-semibold data-[state=active]:text-fg-primary",
                "data-[state=active]:shadow-none",
              ].join(" ")
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
