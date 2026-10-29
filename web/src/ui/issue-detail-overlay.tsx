import { createPortal } from "react-dom";
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface IssueDetailOverlayProps {
  open: boolean;
  onClose: () => void;
  width: number;
  isFullscreen: boolean;
  isResizing: boolean;
  onToggleFullscreen: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  children: ReactNode;
}

export function IssueDetailOverlay({
  open,
  onClose,
  width,
  isFullscreen,
  isResizing,
  onResizeStart,
  children,
}: IssueDetailOverlayProps) {
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (asideRef.current?.contains(target)) return;
      // Portaled menus (Select / Dropdown) render under document.body — don't
      // treat those clicks as "outside the issue" or the panel closes mid-open.
      if (
        target instanceof Element &&
        target.closest(
          '[data-slot="select-content"], [data-slot="select-backdrop"], [data-slot="select-trigger"], [data-radix-popper-content-wrapper], [role="listbox"], [data-radix-menu-content], [data-slot="dropdown-menu-content"]',
        )
      ) {
        return;
      }
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick);
    }, 50);
    window.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className="epure-issue-detail-backdrop fixed inset-0 z-[60] bg-black/25 dark:bg-black/55 backdrop-blur-[1px] transition-opacity duration-150 cursor-pointer select-none"
        aria-label="Close issue detail"
        onClick={onClose}
      />
      <aside
        ref={asideRef}
        style={{ width: isFullscreen ? "100vw" : `min(100vw, ${width}px)`, maxWidth: "100vw" }}
        className={cn(
          "epure-issue-detail-overlay fixed inset-y-0 right-0 z-[70] flex h-dvh min-h-0 flex-col overflow-hidden border-l border-border bg-canvas max-w-full",
          "shadow-[-8px_0_32px_rgba(0,0,0,0.14)] dark:shadow-[-8px_0_36px_rgba(0,0,0,0.45)]",
          isResizing && "select-none",
        )}
        role="dialog"
        aria-label="Issue detail"
      >
        {!isFullscreen ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize issue detail panel"
            className="absolute inset-y-0 left-0 z-20 w-1.5 -translate-x-1/2 cursor-col-resize touch-none hover:bg-accent/50 transition-colors"
            onPointerDown={onResizeStart}
          />
        ) : null}

        {children}
      </aside>
    </>,
    document.body,
  );
}
