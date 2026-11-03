// src/components/ui/dropdown-menu.tsx
import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, CaretRight, Circle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MENU_ITEM_RADIUS_FORCE, MENU_SURFACE } from "@/lib/menu-chrome";
import { makeForwardRef } from "@/lib/forward-ref";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuSubTrigger = makeForwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(function DropdownMenuSubTrigger({ className, inset, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      data-slot="dropdown-menu-sub-trigger"
      className={cn(
        `flex cursor-pointer select-none items-center gap-2 ${MENU_ITEM_RADIUS_FORCE} px-2 py-1.5 text-xs text-fg-secondary outline-none`,
        "transition-colors hover:bg-surface-2 hover:text-fg-primary focus:bg-surface-2 focus:text-fg-primary",
        "data-[state=open]:bg-surface-2 data-[state=open]:text-fg-primary",
        inset && "pl-7",
        className
      )}
      {...props}
    >
      {children}
      <CaretRight className="ml-auto size-3 text-fg-muted" weight="bold" />
    </DropdownMenuPrimitive.SubTrigger>
  );
});
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

export const DropdownMenuSubContent = makeForwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "epure-popover-content z-[1000000003] min-w-[8rem]",
        MENU_SURFACE,
        "[transform-origin:var(--radix-popper-transform-origin,center)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "duration-150 ease-[var(--ease-out,cubic-bezier(0.23,1,0.32,1))]",
        className
      )}
      {...props}
    />
  );
});
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

export const DropdownMenuContent = makeForwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 4, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "epure-popover-content z-[1000000003] min-w-[10rem]",
          MENU_SURFACE,
          "[transform-origin:var(--radix-popper-transform-origin,center)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "duration-150 ease-[var(--ease-out,cubic-bezier(0.23,1,0.32,1))]",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = makeForwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(function DropdownMenuItem({ className, inset, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      data-slot="dropdown-menu-item"
      className={cn(
        `relative flex cursor-pointer select-none items-center gap-2 ${MENU_ITEM_RADIUS_FORCE} px-2 py-1.5 text-xs text-fg-secondary outline-none transition-colors`,
        "hover:bg-surface-2 hover:text-fg-primary focus:bg-surface-2 focus:text-fg-primary",
        "data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg-primary",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        inset && "pl-7",
        className
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export const DropdownMenuCheckboxItem = makeForwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, checked, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        `relative flex cursor-pointer select-none items-center ${MENU_ITEM_RADIUS_FORCE} py-1.5 pl-7 pr-2 text-xs text-fg-secondary outline-none transition-colors`,
        "hover:bg-surface-2 hover:text-fg-primary focus:bg-surface-2 focus:text-fg-primary",
        "data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg-primary",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-3 text-fg-primary" weight="bold" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
});
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

export const DropdownMenuRadioItem = makeForwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      data-slot="dropdown-menu-radio-item"
      className={cn(
        `relative flex cursor-pointer select-none items-center ${MENU_ITEM_RADIUS_FORCE} py-1.5 pl-7 pr-2 text-xs text-fg-secondary outline-none transition-colors`,
        "hover:bg-surface-2 hover:text-fg-primary focus:bg-surface-2 focus:text-fg-primary",
        "data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg-primary",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current text-fg-primary" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
});
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

export const DropdownMenuLabel = makeForwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(function DropdownMenuLabel({ className, inset, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2 py-1.5 text-[11px] font-semibold text-fg-muted",
        inset && "pl-7",
        className
      )}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

export const DropdownMenuSeparator = makeForwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px bg-border-subtle", className)}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto font-mono text-[10px] tracking-widest text-fg-muted tabular-nums",
        className
      )}
      {...props}
    />
  );
}
