import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SimpleFeedHeaderProps {
  /** @deprecated Page titles removed — use stats/actions only. */
  title?: string;
  /** @deprecated */
  description?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  className?: string;
}

/** Compact feed chrome (releases, monitors) — stats and actions only, no page title. */
export function SimpleFeedHeader({ actions, stats, className }: SimpleFeedHeaderProps) {
  if (!actions && !stats) {
    return null;
  }

  return (
    <header
      className={cn(
        "epure-issues-feed-header shrink-0 border-b border-border-subtle bg-bg select-none",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1.5 md:px-5">
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

export function FeedHeaderStatDot() {
  return (
    <span className="px-1 text-fg-muted/40" aria-hidden>
      ·
    </span>
  );
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
      <span className="font-mono font-medium tabular-nums text-fg-primary">{display}</span> {label}
    </span>
  );
}
