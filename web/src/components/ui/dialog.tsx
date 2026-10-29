// src/components/ui/dialog.tsx
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { closeOpenSelects, restorePagePointerEvents } from "@/components/ui/select";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay backdrop-blur-xs",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

function selectMenuIsOpen(): boolean {
  return document.querySelector('[data-slot="select-content"][data-state="open"]') instanceof HTMLElement;
}

export function DialogContent({
  className,
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  React.useEffect(() => () => restorePagePointerEvents(), []);
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        onEscapeKeyDown={(event) => {
          if (selectMenuIsOpen()) {
            event.preventDefault();
            closeOpenSelects();
          }
          onEscapeKeyDown?.(event);
        }}
        onPointerDownOutside={(event) => {
          if (selectMenuIsOpen()) event.preventDefault();
          onPointerDownOutside?.(event);
        }}
        onInteractOutside={(event) => {
          if (selectMenuIsOpen()) event.preventDefault();
          onInteractOutside?.(event);
        }}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-panel border-2 border-border-strong bg-surface-1 p-5 shadow-float outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="absolute right-3.5 top-3.5 rounded-xs p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
        >
          <X className="size-3.5" weight="bold" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 text-left mb-4", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex items-center justify-end gap-2 pt-4 border-t border-border-subtle", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-sm font-semibold tracking-tight text-fg-primary", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-xs text-fg-muted", className)}
      {...props}
    />
  );
}
