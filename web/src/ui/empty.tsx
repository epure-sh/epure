import { type HTMLAttributes, type ReactNode } from "react";
import { CheckCircle2, ShieldCheck, SearchX, Sparkles } from "lucide-react";
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
        {/* Serene concentric radar pulse icon */}
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-healthy/20 bg-healthy/5">
          <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-healthy" />
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-healthy/30 bg-healthy/10 shadow-[0_0_24px_rgba(34,197,94,0.2)]">
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-healthy animate-pulse ring-2 ring-healthy/40" />
            <ShieldCheck className="h-7 w-7 relative z-10 stroke-[1.8] text-healthy" />
          </div>
        </div>

        <h3 className="epure-empty-title text-base font-semibold tracking-tight text-ink">
          {title || "Inbox Zero · Production is Calm"}
        </h3>

        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-muted">
          {description || "Zero unresolved exceptions detected in this time horizon. The Spike Valve is active and guarding against unneeded overage charges."}
        </p>

        {/* Live telemetry tags */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-2xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse" />
            <span>Ingestion: 100% Nominal</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-muted shadow-2xs">
            <Sparkles className="h-3 w-3 text-healthy" />
            <span>Spike Valve: Active · 0 Overages</span>
          </span>
        </div>

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
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-ink-muted ring-1 ring-border">
          <SearchX className="h-6 w-6 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-semibold tracking-tight text-ink">
          {title || "No matching exceptions"}
        </h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
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

