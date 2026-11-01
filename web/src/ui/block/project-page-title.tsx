// Shared project-tab page title.
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ProjectPageTitleProps {
  title: string;
  /** Optional right-side control (e.g. product-tour help). */
  trailing?: ReactNode;
  className?: string;
}

export function ProjectPageTitle({ title, trailing, className }: ProjectPageTitleProps) {
  return (
    <div
      data-slot="project-page-title"
      className={cn(
        "flex w-full min-w-0 shrink-0 items-center justify-between gap-3",
        className,
      )}
    >
      <h2 className="min-w-0 truncate text-3xl font-light tracking-tight text-fg-primary">
        {title}
      </h2>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
