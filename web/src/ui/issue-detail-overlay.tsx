import { ChevronLeft, Maximize2, Minimize2 } from "lucide-react";
import { createPortal } from "react-dom";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

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
  onToggleFullscreen,
  onResizeStart,
  children,
}: IssueDetailOverlayProps) {
  if (!open) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className="epure-issue-detail-backdrop fixed inset-0 z-[80] bg-ink/20"
        aria-label="Close issue detail"
        onClick={onClose}
      />
      <aside
        style={{ width: isFullscreen ? "100vw" : width }}
        className={cn(
          "epure-issue-detail-overlay fixed inset-y-0 right-0 z-[90] flex h-dvh min-h-0 flex-col overflow-hidden border-l border-border bg-surface",
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
            className="absolute inset-y-0 left-0 z-20 w-1 -translate-x-1/2 cursor-col-resize touch-none hover:bg-accent/40"
            onPointerDown={onResizeStart}
          />
        ) : null}

        <div className="epure-issue-detail-toolbar flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-1.5">
          <Button variant="ghost" size="toolbar" className="text-ink-muted" onClick={onClose}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Back to list
          </Button>
          <Button
            variant="ghost"
            size="toolbar"
            className="text-ink-muted"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
        </div>

        {children}
      </aside>
    </>,
    document.body,
  );
}
