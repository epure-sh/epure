import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

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
        className="epure-page-chrome-header flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg px-4 py-2 md:px-6"
      >
        <div className="min-w-0">
          <h1 className="epure-page-title font-medium tracking-ui text-ink">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-ink-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {context ? (
        <div className="border-b border-border bg-surface px-4 py-2 md:px-6">{context}</div>
      ) : null}
    </div>
  );
}
