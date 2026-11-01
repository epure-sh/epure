// web/src/ui/block/page-chrome.tsx
// Tier 3 Block: Unified Page Chrome & Header
// Consolidates PageChrome, PageHeader, and SimpleFeedHeader with variant-driven layouts.

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageChromeVariant = "standard" | "compact" | "feed" | "toolbar";

export interface FeedHeaderStatProps {
  label: string;
  value?: number | string;
  loading?: boolean;
  className?: string;
}

export function FeedHeaderStat({
  label,
  value,
  loading = false,
  className,
}: FeedHeaderStatProps) {
  const display = loading ? "-" : (value ?? "-");

  return (
    <span className={cn("text-fg-muted", className)}>
      <span className="font-mono font-medium tabular-nums text-fg-primary">{display}</span>{" "}
      {label}
    </span>
  );
}

export function FeedHeaderStatDot() {
  return (
    <span className="px-1 text-fg-muted/40" aria-hidden>
      ·
    </span>
  );
}

export interface PageChromeProps {
  variant?: PageChromeVariant;
  title?: ReactNode;
  description?: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: ReactNode;
  leading?: ReactNode;
  stats?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  context?: ReactNode;
  className?: string;
  borderBottom?: boolean;
}

export function PageChrome({
  variant = "standard",
  title,
  description: descriptionProp,
  subtitle,
  breadcrumbs,
  leading,
  stats,
  search,
  filters,
  actions,
  context,
  className,
  borderBottom = true,
}: PageChromeProps) {
  const description = descriptionProp ?? subtitle;
  const isFeed = variant === "feed" || variant === "compact";
  const isToolbar = variant === "toolbar";

  // Feed variant: compact stats and actions header
  if (isFeed) {
    if (!actions && !stats) {
      return null;
    }

    return (
      <header
        data-slot="page-chrome"
        data-variant="feed"
        className={cn(
          "epure-issues-feed-header epure-page-chrome shrink-0 bg-bg-subtle select-none",
          borderBottom && "border-b border-border-subtle",
          className,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 epure-page-gutter-x py-1.5">
          {stats ? (
            <div
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 text-[11px] leading-snug text-fg-muted"
              aria-live="polite"
            >
              {stats}
            </div>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </header>
    );
  }

  // Toolbar variant: with search and filter controls
  if (isToolbar) {
    return (
      <div
        data-slot="page-chrome"
        data-variant="toolbar"
        className={cn("epure-page-chrome shrink-0 select-none", className)}
      >
        <header
          className={cn(
            "epure-page-chrome-header flex min-h-12 flex-wrap items-center justify-between gap-3 bg-surface-1/60 epure-page-gutter-x py-2",
            borderBottom && "border-b border-border-subtle",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {leading}
            {breadcrumbs}
            {title ? (
              <h1 className="truncate text-sm font-semibold tracking-ui text-fg-primary">
                {title}
              </h1>
            ) : null}
            {search ? <div className="min-w-48 max-w-sm flex-1">{search}</div> : null}
            {filters ? <div className="flex items-center gap-1.5">{filters}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
        {context ? (
          <div className="border-b border-border-subtle bg-surface-1 epure-page-gutter-x py-2">
            {context}
          </div>
        ) : null}
      </div>
    );
  }

  // Standard variant
  const showHeader = Boolean(title || leading || breadcrumbs || actions);

  if (!showHeader && !context) {
    return null;
  }

  return (
    <div
      data-slot="page-chrome"
      data-variant="standard"
      className={cn("epure-page-chrome shrink-0 select-none", className)}
    >
      {showHeader ? (
        <header
          className={cn(
            "epure-page-chrome-header flex h-12 items-center justify-between bg-surface-1/60 epure-page-gutter-x",
            borderBottom && "border-b border-border-subtle",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {leading}
            {breadcrumbs}
            {title ? (
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold tracking-ui text-fg-primary">
                  {title}
                </h1>
                {description ? (
                  <p className="truncate text-xs text-fg-muted">{description}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {context ? (
        <div className="border-b border-border-subtle bg-surface-1 epure-page-gutter-x py-2">
          {context}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backwards-Compatible Drop-In Wrappers
// ---------------------------------------------------------------------------

export type PageHeaderProps = PageChromeProps;

export function PageHeader(props: PageHeaderProps) {
  return <PageChrome {...props} />;
}

export interface SimpleFeedHeaderProps {
  /** @deprecated Page titles removed — use stats/actions only. */
  title?: string;
  /** @deprecated */
  description?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  className?: string;
}

export function SimpleFeedHeader({ actions, stats, className }: SimpleFeedHeaderProps) {
  return <PageChrome variant="feed" stats={stats} actions={actions} className={className} />;
}
