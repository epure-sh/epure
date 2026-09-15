import { cn } from "../lib/cn";
import { formatCompactCount } from "../lib/format-count";
import { getStatBarVariant, useStyleTheme } from "../lib/style-theme";

export interface StatBarItem {
  label: string;
  value: number;
  filterToken?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface StatBarProps {
  items: StatBarItem[];
  className?: string;
  inline?: boolean;
  compact?: boolean;
}

function StatCards({ items }: { items: StatBarItem[] }) {
  return (
    <div className="epure-stat-band grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const content = (
          <>
            <p className="epure-stat-value epure-stat-value-number font-semibold text-ink">
              {formatCompactCount(item.value)}
            </p>
            <p className="epure-stat-value-label mt-1 text-sm text-ink-muted">{item.label}</p>
          </>
        );

        if (!item.onClick) {
          return (
            <div
              key={item.label}
              className="epure-stat-card rounded-xl border border-border bg-surface px-5 py-4 text-center"
            >
              {content}
            </div>
          );
        }

        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={cn(
              "epure-stat-card rounded-xl border bg-surface px-5 py-4 text-center transition-colors duration-fast focus-ring",
              item.active
                ? "border-accent bg-accent-muted/30"
                : "border-border hover:border-border-strong hover:bg-state-hover",
            )}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function StatRulesInline({ items }: { items: StatBarItem[] }) {
  return (
    <div className="epure-stat-rules flex flex-wrap items-baseline">
      {items.map((item) => {
        const content = (
          <>
            <p className="epure-stat-value epure-stat-value-number font-medium text-ink">
              {formatCompactCount(item.value)}
            </p>
            <p className="epure-stat-value-label text-ink-muted">{item.label}</p>
          </>
        );

        if (!item.onClick) {
          return (
            <div key={item.label} className="epure-stat-rule-segment">
              {content}
            </div>
          );
        }

        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={cn(
              "epure-stat-rule-segment text-left transition-colors duration-fast focus-ring",
              item.active && "text-accent",
            )}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function StatInlineStrip({ items }: { items: StatBarItem[] }) {
  return (
    <p className="epure-stat-inline min-w-0 truncate font-mono text-xs tabular-nums text-ink">
      {items.map((item, index) => {
        const segment = `${formatCompactCount(item.value)} ${item.label.toLowerCase()}`;
        if (!item.onClick) {
          return (
            <span key={item.label}>
              {index > 0 ? <span className="text-ink-muted"> · </span> : null}
              <span className={item.active ? "font-medium text-accent" : undefined}>{segment}</span>
            </span>
          );
        }

        return (
          <span key={item.label}>
            {index > 0 ? <span className="text-ink-muted"> · </span> : null}
            <button
              type="button"
              onClick={item.onClick}
              className={cn(
                "focus-ring rounded-sm transition-colors duration-fast hover:text-accent",
                item.active ? "font-medium text-accent" : "text-ink",
              )}
            >
              {segment}
            </button>
          </span>
        );
      })}
    </p>
  );
}

export function StatBar({ items, className, inline = false }: StatBarProps) {
  const theme = useStyleTheme();
  const variant = getStatBarVariant(theme);

  if (variant === "cards" && !inline) {
    return (
      <div className={cn("epure-stat-bar border-b border-border bg-bg px-6 py-5", className)}>
        <StatCards items={items} />
      </div>
    );
  }

  if (variant === "rules" && !inline) {
    return (
      <div className={cn("epure-stat-bar border-b border-border bg-bg", className)}>
        <StatRulesInline items={items} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "epure-stat-bar min-w-0",
        inline ? "flex-1" : "border-b border-border px-6 py-2",
        className,
      )}
    >
      <StatInlineStrip items={items} />
    </div>
  );
}
