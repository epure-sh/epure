import { type ReactNode } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { cn } from "../lib/cn";
import { Button } from "./button";

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

export function ErrorState({
  title,
  description,
  error,
  stack,
  showReload = false,
  backHref,
  backLabel = "Go back",
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  className,
  children,
}: ErrorStateProps) {
  const inRouter = useInRouterContext();
  const technicalDetails = stack || error?.stack || error?.message;

  return (
    <div
      className={cn(
        "epure-error-state flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <p className="text-sm font-semibold text-fg-primary">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-xs text-fg-muted">{description}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {showReload ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => window.location.reload()}
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

export function NotFoundState({
  title = "Page not found",
  description = "This URL does not match anything in your workspace.",
  backHref = "/",
  backLabel = "Back to workspace",
  className,
}: Omit<ErrorStateProps, "onRetry" | "retryLabel" | "retrying">) {
  return (
    <ErrorState
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
    <ErrorState
      title={title}
      description={description}
      backHref={backHref}
      backLabel={backLabel}
      className={className}
    />
  );
}
