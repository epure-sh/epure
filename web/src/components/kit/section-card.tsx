// src/components/kit/section-card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  danger?: boolean;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({
  title,
  description,
  headerActions,
  children,
  footer,
  danger = false,
  className,
  contentClassName,
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || headerActions);

  return (
    <section
      data-slot="section-card"
      className={cn(
        "rounded-panel border bg-surface-1 shadow-tactile overflow-hidden",
        danger ? "border-escalating/40" : "border-border-subtle",
        className
      )}
    >
      {hasHeader && (
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5 bg-surface-1/50">
          <div className="space-y-0.5">
            {title && (
              <h3 className="text-sm font-semibold tracking-tight text-fg-primary">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-fg-muted">{description}</p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">{headerActions}</div>
          )}
        </div>
      )}

      <div className={cn("p-5 text-xs text-fg-secondary", contentClassName)}>
        {children}
      </div>

      {footer && (
        <div className="border-t border-border-subtle bg-surface-2/40 px-5 py-3 text-xs text-fg-muted flex items-center justify-between">
          {footer}
        </div>
      )}
    </section>
  );
}
