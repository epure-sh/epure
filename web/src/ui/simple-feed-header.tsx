import { type ReactNode } from "react";

export interface SimpleFeedHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  stats?: ReactNode;
}

/** Page chrome for secondary feeds (alerts, releases) — matches Issues feed header rhythm. */
export function SimpleFeedHeader({ title, description, actions, stats }: SimpleFeedHeaderProps) {
  return (
    <header className="epure-issues-feed-header shrink-0 border-b border-border bg-bg">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 md:px-6">
        <div className="min-w-0">
          <h1 className="epure-page-title font-medium tracking-ui text-ink">{title}</h1>
          {description ? (
            <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-ink-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {stats ? (
        <div
          className="flex flex-wrap items-center gap-x-0.5 border-t border-border px-4 py-2 text-xs leading-snug md:px-6"
          aria-live="polite"
        >
          {stats}
        </div>
      ) : null}
    </header>
  );
}

export function FeedHeaderStatDot() {
  return <span className="px-1.5 text-ink-muted/40" aria-hidden>·</span>;
}

export interface FeedHeaderStatProps {
  label: string;
  value?: number | string;
  loading?: boolean;
}

export function FeedHeaderStat({ label, value, loading = false }: FeedHeaderStatProps) {
  const display = loading ? "—" : value;

  return (
    <span className="text-ink-muted">
      <span className="font-mono tabular-nums text-ink">{display}</span> {label}
    </span>
  );
}
