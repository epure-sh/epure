// src/components/ui/command.tsx
import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "./dialog";

export function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-control bg-surface-1 text-fg-primary",
        className
      )}
      {...props}
    />
  );
}

export interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function CommandDialog({ open, onOpenChange, children }: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-lg shadow-float border-border-strong [&>button]:hidden">
        <Command className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-fg-muted">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex items-center border-b border-border-subtle px-3 h-9"
    >
      <MagnifyingGlass className="mr-2 size-4 shrink-0 text-fg-muted" weight="bold" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-full w-full bg-transparent py-2 text-xs text-fg-primary placeholder:text-fg-muted focus:outline-none",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-72 overflow-y-auto p-1 text-xs", className)}
      {...props}
    />
  );
}

export function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-xs text-fg-muted", className)}
      {...props}
    />
  );
}

export function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-muted",
        className
      )}
      {...props}
    />
  );
}

export function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 my-1 h-px bg-border-subtle", className)}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-xs px-2 py-1.5 text-[13px] text-fg-secondary outline-none",
        "transition-[color,background-color] duration-150 ease-snap",
        "data-[selected=true]:bg-surface-2 data-[selected=true]:text-fg-primary",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function CommandShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto font-mono text-[10px] tracking-widest text-fg-muted tabular-nums",
        className
      )}
      {...props}
    />
  );
}
