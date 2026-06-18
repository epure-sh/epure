import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { Button } from "./button";

export interface ErrorStateProps {
  title: string;
  description?: string;
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
  backHref,
  backLabel = "Go back",
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  className,
  children,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "epure-error-state flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-xs text-ink-muted">{description}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
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
            <Link to={backHref}>{backLabel}</Link>
          </Button>
        ) : null}
      </div>
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
