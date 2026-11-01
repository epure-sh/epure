// web/src/ui/components/empty-state.tsx
// Tier 2 Component: Consolidated Empty, Search, Zen & Error State (Cluster 6)
// Consolidates empty, error-state, and Orbit empty-state.

import { type HTMLAttributes, type ReactNode } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { CheckCircle2, SearchX, ShieldCheck, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "../primitives";

export type EmptyStateStatus = "empty" | "error" | "zen" | "search";
export type EmptyStateVariant = "default" | "inset" | "card";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** High-level feedback state */
  status?: EmptyStateStatus;
  /** Presentation container style */
  variant?: EmptyStateVariant;
  /** Primary headline */
  title?: string;
  /** Explanatory description */
  description?: string;
  /** Custom icon override */
  icon?: ReactNode;
  /** Primary action button label */
  actionLabel?: string;
  /** Primary action callback */
  onAction?: () => void;
  /** Custom action slot */
  action?: ReactNode;
  /** Alias for action */
  actions?: ReactNode;
  /** Error object for status="error" */
  error?: Error | null;
  /** Raw stack trace string for technical details */
  stack?: string;
  /** Show page reload button */
  showReload?: boolean;
  /** Safe fallback navigation path */
  backHref?: string;
  /** Label for back button (default: "Go back") */
  backLabel?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Label for retry button (default: "Try again") */
  retryLabel?: string;
  /** Loading indicator on retry button */
  retrying?: boolean;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  status,
  variant = "default",
  title,
  description,
  icon,
  actionLabel,
  onAction,
  action,
  actions,
  error,
  stack,
  showReload = false,
  backHref,
  backLabel = "Go back",
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  children,
  className,
  ...props
}: EmptyStateProps) {
  // Infer status: if error or stack is supplied, default to "error"
  const resolvedStatus: EmptyStateStatus = status ?? (error || stack ? "error" : "empty");
  const inRouter = useInRouterContext();
  const technicalDetails = stack || error?.stack || error?.message;
  const actionSlot = actions ?? action;

  // -------------------------------------------------------------------------
  // 1. ZEN STATUS: Production is Calm / Inbox Zero
  // -------------------------------------------------------------------------
  if (resolvedStatus === "zen") {
    const zenTitle = title || "Inbox Zero · Production is Calm";
    const zenDescription =
      description ||
      "Zero unresolved exceptions detected in this time horizon. The Spike Valve is active and guarding against unneeded overage charges.";

    return (
      <div
        data-slot="empty-state"
        data-status="zen"
        className={cn(
          "epure-empty epure-empty--zen flex flex-col items-center justify-center py-16 px-4 text-center select-none animate-in fade-in duration-300",
          variant === "card" && "rounded-lg border border-border bg-surface p-8 shadow-xs",
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
          {zenTitle}
        </h3>

        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-muted">
          {zenDescription}
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

        {actionSlot ? <div className="mt-5">{actionSlot}</div> : null}
        {actionLabel && onAction ? (
          <div className="mt-5">
            <Button variant="secondary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. SEARCH STATUS: Zero Search Results
  // -------------------------------------------------------------------------
  if (resolvedStatus === "search") {
    const searchTitle = title || "Nothing matches right now";
    const searchDescription =
      description ||
      "Try different keywords, or clear filters. Your data is still here.";

    return (
      <div
        data-slot="empty-state"
        data-status="search"
        className={cn(
          "epure-empty epure-empty--search flex flex-col items-center justify-center py-12 px-6 text-center select-none animate-in fade-in duration-200",
          variant === "card" && "rounded-lg border border-border-subtle bg-surface-1 p-8",
          className,
        )}
        {...props}
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-fg-muted">
          {icon || <SearchX className="h-[18px] w-[18px] stroke-[1.6]" />}
        </div>
        <h3 className="text-sm font-medium tracking-tight text-fg-primary">{searchTitle}</h3>
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-fg-muted">
          {searchDescription}
        </p>
        {actionSlot ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actionSlot}</div>
        ) : null}
        {actionLabel && onAction ? (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 3. ERROR STATUS: Crash / Failure Boundary
  // -------------------------------------------------------------------------
  if (resolvedStatus === "error") {
    const errorTitle = title || "An unexpected error occurred";

    return (
      <div
        data-slot="empty-state"
        data-status="error"
        className={cn(
          "epure-error-state flex flex-col items-center justify-center px-6 py-12 text-center",
          variant === "card" && "rounded-lg border border-semantic-danger/30 bg-surface p-8 shadow-xs",
          className,
        )}
        {...props}
      >
        {icon ? (
          <div className="mb-3">{icon}</div>
        ) : (
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-semantic-danger/10 text-semantic-danger ring-1 ring-semantic-danger/20">
            <AlertTriangle className="h-6 w-6 stroke-[1.8]" />
          </div>
        )}

        <p className="text-sm font-semibold text-fg-primary">{errorTitle}</p>
        {description ? (
          <p className="mt-2 max-w-md text-xs text-fg-muted">{description}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {showReload ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
            >
              Reload page
            </Button>
          ) : null}
          {onRetry ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={retrying}
              onClick={onRetry}
            >
              {retrying ? "Retrying…" : retryLabel}
            </Button>
          ) : null}
          {backHref ? (
            <Button variant="ghost" size="sm" asChild>
              {inRouter ? (
                <Link to={backHref}>{backLabel}</Link>
              ) : (
                <a href={backHref}>{backLabel}</a>
              )}
            </Button>
          ) : null}
          {actionSlot}
          {actionLabel && onAction ? (
            <Button variant="secondary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>

        {technicalDetails ? (
          <details className="mt-5 w-full max-w-xl text-left border border-border-subtle bg-surface-2/80 rounded-md p-3 text-xs">
            <summary className="cursor-pointer font-medium text-fg-muted hover:text-fg-primary select-none">
              {error?.name ? `${error.name}: ` : "Error details: "}{error?.message || "Technical details"}
            </summary>
            <pre className="mt-2 overflow-auto font-mono text-[11px] leading-relaxed text-fg-secondary max-h-48 whitespace-pre-wrap select-text bg-surface-1 p-2.5 rounded border border-border-subtle">
              {technicalDetails}
            </pre>
          </details>
        ) : null}

        {children}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 4. EMPTY STATUS: Default Clean Empty State
  // -------------------------------------------------------------------------
  const isInset = variant === "inset";
  const defaultTitle = title || "Quiet for now";

  return (
    <div
      data-slot="empty-state"
      data-status="empty"
      className={cn(
        "epure-empty flex flex-col",
        isInset
          ? "epure-empty--inset items-start px-0 py-8 text-left"
          : "items-center justify-center px-6 py-12 text-center",
        variant === "card" && "rounded-lg border border-border-subtle bg-surface-1 p-8",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-fg-muted",
          isInset && "mb-2.5",
        )}
        aria-hidden
      >
        {icon || <CheckCircle2 className="h-[18px] w-[18px] stroke-[1.6]" />}
      </div>
      <p className="epure-empty-title text-sm font-medium tracking-ui text-fg-primary">
        {defaultTitle}
      </p>
      {description ? (
        <p
          className={cn(
            "mt-1.5 max-w-md text-xs leading-relaxed text-fg-muted",
            !isInset && "text-center",
          )}
        >
          {description}
        </p>
      ) : null}
      {actionSlot ? (
        <div className={cn("mt-4 flex flex-wrap items-center gap-2", !isInset && "justify-center")}>
          {actionSlot}
        </div>
      ) : null}
      {actionLabel && onAction ? (
        <div className={cn("mt-4", !isInset && "flex justify-center")}>
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
      {children ? (
        <div className={cn("mt-4", !isInset && "flex justify-center")}>{children}</div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backwards Compatibility Wrappers
// ---------------------------------------------------------------------------

export interface EmptyProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  variant?: "default" | "inset" | "zen" | "search";
  action?: ReactNode;
}

export function Empty({
  title,
  description,
  variant = "default",
  action,
  children,
  className,
  ...props
}: EmptyProps) {
  return (
    <EmptyState
      status={variant === "zen" ? "zen" : variant === "search" ? "search" : "empty"}
      variant={variant === "inset" ? "inset" : "default"}
      title={title}
      description={description}
      action={action}
      className={className}
      {...props}
    >
      {children}
    </EmptyState>
  );
}

export interface ErrorStateProps {
  title: string;
  description?: string;
  error?: Error | null;
  stack?: string;
  showReload?: boolean;
  backHref?: string;
  backLabel?: string;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  className?: string;
  children?: ReactNode;
}

export function ErrorState(props: ErrorStateProps) {
  return <EmptyState status="error" {...props} />;
}

export function NotFoundState({
  title = "Page not found",
  description = "This URL does not match anything in your workspace.",
  backHref = "/",
  backLabel = "Back to workspace",
  className,
}: Omit<ErrorStateProps, "onRetry" | "retryLabel" | "retrying">) {
  return (
    <EmptyState
      status="error"
      title={title}
      description={description}
      backHref={backHref}
      backLabel={backLabel}
      className={className}
    />
  );
}

export function ForbiddenState({
  title = "Access denied",
  description = "You do not have permission to view this page.",
  backHref = "/",
  backLabel = "Back to workspace",
  className,
}: Omit<ErrorStateProps, "onRetry" | "retryLabel" | "retrying">) {
  return (
    <EmptyState
      status="error"
      title={title}
      description={description}
      backHref={backHref}
      backLabel={backLabel}
      className={className}
    />
  );
}
