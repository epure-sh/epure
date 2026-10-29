// src/components/ui/select.tsx — Phase 2: Orbit Select + Epure size API
import * as React from "react";
import { createPortal } from "react-dom";
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
import { Box } from "@polar-sh/orbit/Box";
import { cn } from "@/lib/utils";

const selectClosers = new Set<() => void>();

function isSelectMenuOpen(): boolean {
  return document.querySelector('[data-slot="select-content"][data-state="open"]') instanceof HTMLElement;
}

/** Close every open select without sending Escape, which also dismisses a dialog. */
export function closeOpenSelects() {
  for (const close of [...selectClosers]) close();
}

/** Radix modal layers from different packages can leave the page unable to receive clicks. */
export function restorePagePointerEvents() {
  window.setTimeout(() => {
    const dialogOpen = document.querySelector('[data-slot="dialog-content"][data-state="open"]');
    if (!isSelectMenuOpen() && !dialogOpen && document.body.style.pointerEvents === "none") {
      document.body.style.pointerEvents = "";
    }
  }, 0);
}

function installSelectOutsideClose() {
  if (typeof document === "undefined") return;
  const win = window as Window & { __epureSelectOutside?: boolean };
  if (win.__epureSelectOutside) return;
  win.__epureSelectOutside = true;

  let swallowClick = false;
  document.addEventListener(
    "pointerdown",
    (event) => {
      const content = document.querySelector('[data-slot="select-content"][data-state="open"]');
      if (!(content instanceof HTMLElement)) return;
      const target = event.target;
      if (!(target instanceof Node) || content.contains(target)) return;
      const trigger = document.querySelector('[data-slot="select-trigger"][data-state="open"]');
      if (trigger instanceof Node && trigger.contains(target)) return;
      swallowClick = true;
      event.preventDefault();
      event.stopPropagation();
      closeOpenSelects();
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}

export function Select({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof OrbitSelect>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpen = React.useCallback((next: boolean) => {
    onOpenChangeRef.current?.(next);
    if (openProp === undefined) setUncontrolled(next);
  }, [openProp]);

  React.useEffect(() => {
    installSelectOutsideClose();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    selectClosers.add(close);
    return () => {
      selectClosers.delete(close);
      restorePagePointerEvents();
    };
  }, [open, setOpen]);

  return (
    <>
      {/*
        Cast: Orbit's Select typings omit Radix `modal`. Keep non-modal so body
        pointer-events stay usable inside the issue-detail overlay (z-70).
      */}
      <OrbitSelect
        open={open}
        onOpenChange={setOpen}
        {...props}
        {...({ modal: false } as object)}
      />
      {open && typeof document !== "undefined"
        ? createPortal(
            <Box
              data-slot="select-backdrop"
              position="fixed"
              inset={0}
              // Above issue-detail overlay (z-70); below select content (z-[80]).
              zIndex={75}
              pointerEvents="auto"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
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
        // Orbit defaults to [&>span]:line-clamp-1 — keep full label visible.
        "w-fit max-w-none [&>span]:line-clamp-none [&>span]:overflow-visible [&>span]:whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {children}
    </OrbitSelectTrigger>
  );
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
      // Above issue-detail overlay (z-70) + select backdrop (z-75).
      className={cn("z-[80]", className)}
      {...props}
    >
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
