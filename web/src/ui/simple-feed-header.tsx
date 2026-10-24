import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SimpleFeedHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  className?: string;
}

/** Page chrome for secondary feeds (alerts, releases) — matches Issues feed header rhythm. */
export function SimpleFeedHeader({ title, description, actions, stats, className }: SimpleFeedHeaderProps) {
  return (
    <header className={cn("epure-issues-feed-header shrink-0 border-b border-border-subtle bg-surface-1/60", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 h-12">
        <div className="min-w-0 flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-tight text-fg-primary truncate">{title}</h1>
          {description ? (
            <p className="text-xs text-fg-muted truncate hidden sm:inline">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
      {stats ? (
        <div
          className="flex flex-wrap items-center gap-x-1 border-t border-border-subtle px-6 py-1.5 text-[11px] text-fg-muted leading-snug"
          aria-live="polite"
        >
          {stats}
        </div>
      ) : null}
    </header>
  );
}

export function FeedHeaderStatDot() {
  return <span className="px-1 text-fg-muted/40" aria-hidden>·</span>;
}

export interface FeedHeaderStatProps {
  label: string;
  value?: number | string;
  loading?: boolean;
}

export function FeedHeaderStat({ label, value, loading = false }: FeedHeaderStatProps) {
  const display = loading ? "—" : value;

  return (
    <span className="text-fg-muted">
      <span className="font-mono tabular-nums text-fg-primary font-medium">{display}</span> {label}
    </span>
  );
}
