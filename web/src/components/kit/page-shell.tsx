// src/components/kit/page-shell.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageShellProps {
  title?: string;
  description?: string;
  /** Renders after the title on the left (e.g. section tabs). */
  leadingActions?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  density?: "standard" | "full-bleed";
  className?: string;
}

export function PageShell({
  leadingActions,
  actions,
  children,
  density = "standard",
  className,
}: PageShellProps) {
  const showHeader = Boolean(leadingActions || actions);

  return (
    <div data-slot="page-shell" className={cn("flex h-full min-h-0 flex-1 flex-col bg-canvas", className)}>
      {showHeader ? (
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-1/60 px-6">
          {leadingActions ? (
            <div className="flex min-w-0 flex-1 items-center">{leadingActions}</div>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}

      <main
        className={
          density === "full-bleed"
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-auto px-6 py-6"
        }
      >
        {children}
      </main>
    </div>
  );
}
