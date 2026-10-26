import { type HTMLAttributes, type ReactNode } from "react";
import { CheckCircle2, ShieldCheck, SearchX } from "lucide-react";
import { cn } from "../lib/cn";

export interface EmptyProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  /**
   * - `zen`: Serene "all caught up / zero unhandled errors" production state
   * - `search`: High-contrast "no search results" filter state
   * - `inset`: Compact padding for nested wells
   * - `default`: Standard centered empty state
   */
  variant?: "default" | "inset" | "zen" | "search";
  action?: ReactNode;
}

export function Empty({
  className,
  title = "No unresolved exceptions",
  description,
  variant = "default",
  action,
  children,
  ...props
}: EmptyProps) {
  if (variant === "zen") {
    return (
      <div
        className={cn(
          "epure-empty epure-empty--zen flex flex-col items-center justify-center py-16 px-4 text-center select-none animate-in fade-in duration-300",
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex size-9 items-center justify-center rounded-control bg-surface-2 text-healthy">
          <ShieldCheck className="size-4" />
        </div>

        <h3 className="text-sm font-semibold tracking-tight text-balance text-fg-primary">
          {title || "Nothing unresolved"}
        </h3>

        <p className="mt-1.5 max-w-sm text-pretty text-[13px] leading-relaxed text-fg-secondary">
          {description || "No unresolved exceptions in this window."}
        </p>

        {action ? <div className="mt-5">{action}</div> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    );
  }

  if (variant === "search") {
    return (
      <div
        className={cn(
          "epure-empty epure-empty--search flex flex-col items-center justify-center py-14 px-4 text-center select-none animate-in fade-in duration-200",
          className,
        )}
        {...props}
      >
        <div className="mb-3 flex size-9 items-center justify-center rounded-control bg-surface-2 text-fg-muted">
          <SearchX className="size-4" />
        </div>
        <h3 className="text-sm font-semibold tracking-tight text-balance text-fg-primary">
          {title || "No matching exceptions"}
        </h3>
        <p className="mt-1 max-w-sm text-pretty text-[13px] leading-relaxed text-fg-secondary">
          {description || "No issues match the active filter criteria. Try adjusting your query keywords or clearing filters."}
        </p>
        {action ? <div className="mt-4">{action}</div> : null}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "epure-empty flex flex-col",
        variant === "default"
          ? "items-center justify-center py-10 text-center"
          : "epure-empty--inset items-start p-0 text-left",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-ink-muted/70" />
        <p className="epure-empty-title text-sm font-medium tracking-ui text-ink">{title}</p>
      </div>
      {description ? (
        <p className="mt-1 max-w-md text-xs text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

