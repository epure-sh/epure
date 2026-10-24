// src/components/kit/page-shell.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  density?: "standard" | "full-bleed";
  className?: string;
}

export function PageShell({
  title,
  description,
  actions,
  children,
  density = "standard",
  className,
}: PageShellProps) {
  return (
    <div data-slot="page-shell" className={cn("flex min-h-full flex-col bg-canvas", className)}>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-1/60 px-6">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-fg-primary truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs text-fg-muted truncate hidden sm:inline">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>

      <main
        className={
          density === "full-bleed"
            ? "flex-1 overflow-auto"
            : "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-6"
        }
      >
        {children}
      </main>
    </div>
  );
}
