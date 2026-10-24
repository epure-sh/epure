// src/components/kit/empty-state.tsx
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tray } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center rounded-panel border border-dashed border-border-subtle p-8 text-center",
        className
      )}
    >
      <div className="mb-3 flex size-9 items-center justify-center rounded-control bg-surface-2 text-fg-muted">
        {icon || <Tray className="size-5" weight="regular" />}
      </div>
      <h3 className="text-xs font-semibold text-fg-primary">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-fg-muted">{description}</p>
      )}
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
