// src/components/ui/select.tsx — Phase 2: Orbit Select + Epure size API
import * as React from "react";
import {
  Select as OrbitSelect,
  SelectContent as OrbitSelectContent,
  SelectGroup as OrbitSelectGroup,
  SelectItem as OrbitSelectItem,
  SelectLabel as OrbitSelectLabel,
  SelectSeparator as OrbitSelectSeparator,
  SelectTrigger as OrbitSelectTrigger,
  SelectValue as OrbitSelectValue,
} from "@polar-sh/orbit/Select";
import { cn } from "@/lib/utils";

export const Select = OrbitSelect;
export const SelectGroup = OrbitSelectGroup;
export const SelectValue = OrbitSelectValue;
export const SelectLabel = OrbitSelectLabel;
export const SelectSeparator = OrbitSelectSeparator;

export function SelectTrigger({
  className,
  children,
  size = "sm",
  ...props
}: React.ComponentProps<typeof OrbitSelectTrigger> & {
  size?: "sm" | "md";
}) {
  return (
    <OrbitSelectTrigger
      data-slot="select-trigger"
      className={cn(
        size === "sm" ? "h-8 min-h-8 px-3 text-xs" : "h-10 min-h-10 px-3 text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </OrbitSelectTrigger>
  );
}

function CloseMenuOnOutsidePointer() {
  React.useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const content = document.querySelector('[data-slot="select-content"][data-state="open"]');
      if (!(content instanceof HTMLElement)) return;
      const target = event.target;
      if (target instanceof Node && content.contains(target)) return;
      const trigger = document.querySelector('[data-slot="select-trigger"][data-state="open"]');
      if (target instanceof Node && trigger?.contains(target)) return;
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
  return null;
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof OrbitSelectContent>) {
  return (
    <OrbitSelectContent
      data-slot="select-content"
      position={position}
      className={cn(className)}
      {...props}
    >
      <CloseMenuOnOutsidePointer />
      {children}
    </OrbitSelectContent>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof OrbitSelectItem>) {
  return (
    <OrbitSelectItem
      data-slot="select-item"
      className={cn(
        "text-sm hover:!bg-surface-2 hover:!text-fg-primary focus:!bg-surface-2 focus:!text-fg-primary data-[highlighted]:!bg-surface-2 data-[highlighted]:!text-fg-primary",
        className,
      )}
      {...props}
    >
      {children}
    </OrbitSelectItem>
  );
}
