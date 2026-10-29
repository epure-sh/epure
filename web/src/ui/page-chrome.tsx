import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageChromeProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  context?: ReactNode;
  className?: string;
}

export function PageChrome({ actions, context, className }: PageChromeProps) {
  const showHeader = Boolean(actions);

  if (!showHeader && !context) {
    return null;
  }

  return (
    <div className={cn("epure-page-chrome shrink-0", className)}>
      {showHeader ? (
        <header className="epure-page-chrome-header flex h-12 items-center justify-end border-b border-border-subtle bg-surface-1/60 epure-page-gutter-x select-none">
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {context ? (
        <div className="border-b border-border-subtle bg-surface-1 epure-page-gutter-x py-2">{context}</div>
      ) : null}
    </div>
  );
}
