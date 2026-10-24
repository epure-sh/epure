import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageChromeProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  context?: ReactNode;
  className?: string;
}

export function PageChrome({
  title,
  description,
  actions,
  context,
  className,
}: PageChromeProps) {
  return (
    <div className={cn("epure-page-chrome shrink-0", className)}>
      <header
        className="epure-page-chrome-header flex h-12 items-center justify-between border-b border-border-subtle bg-surface-1/60 px-6 select-none"
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-fg-primary truncate">{title}</h1>
          {description ? (
            <p className="text-xs text-fg-muted truncate hidden sm:inline">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </header>
      {context ? (
        <div className="border-b border-border-subtle bg-surface-1 px-6 py-2">{context}</div>
      ) : null}
    </div>
  );
}
