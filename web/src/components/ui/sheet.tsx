// src/components/ui/sheet.tsx
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay backdrop-blur-xs",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  "fixed z-50 gap-4 border-border-strong bg-surface-1 p-6 shadow-float transition ease-in-out data-[state=closed]:duration-150 data-[state=open]:duration-200 outline-none",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b-2 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t-2 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r-2 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-md",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l-2 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

export interface SheetContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

export function SheetContent({
  side = "right",
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          data-slot="sheet-close"
          className="absolute right-4 top-4 rounded-xs p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
        >
          <X className="size-3.5" weight="bold" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 text-left mb-4", className)}
      {...props}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex items-center justify-end gap-2 pt-4 border-t border-border-subtle", className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-sm font-semibold tracking-tight text-fg-primary", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-xs text-fg-muted", className)}
      {...props}
    />
  );
}
