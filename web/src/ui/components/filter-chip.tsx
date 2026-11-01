// web/src/ui/components/filter-chip.tsx
// Tier 2 Component: Filter Chip for Query Omnibar and Preset Filters

import { X } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  /** Search-bar chip with dismiss control */
  variant?: "preset" | "query";
  filterKey?: string;
  tokenHint?: string;
  onRemove?: () => void;
  /** Optional count pastille (status chips). */
  count?: number;
  children?: ReactNode;
}

export function FilterChip({
  label,
  active = true,
  variant = "preset",
  filterKey,
  tokenHint,
  onRemove,
  count,
  children,
  className,
  onClick,
  title,
  ...props
}: FilterChipProps) {
  if (onRemove) {
    return (
      <span
        title={title ?? tokenHint ?? label}
        className={cn(
          "inline-flex h-6 max-w-full shrink-0 items-center overflow-hidden rounded-full border text-xs",
          variant === "query"
            ? "border-badge-accent-border bg-surface-2 text-fg-primary"
            : "border-border bg-surface-1 text-fg-secondary",
          className,
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-0.5 px-1.5 py-0.5">
          {variant === "query" && filterKey ? (
            <>
              <span className="shrink-0 text-fg-muted">{filterKey}</span>
              <span className="shrink-0 text-fg-muted" aria-hidden>
                :
              </span>
              <span className="min-w-0 truncate">{label}</span>
            </>
          ) : (
            <span className="min-w-0 truncate">{label}</span>
          )}
        </span>
        <button
          type="button"
          className={cn(
            "inline-flex h-full shrink-0 items-center justify-center border-l px-1 cursor-pointer",
            "transition-[background-color,color,transform] duration-150 ease-[var(--ease-mechanical,cubic-bezier(0.16,1,0.3,1))] focus-ring",
            "active:scale-[0.97] motion-reduce:active:scale-100",
            variant === "query"
              ? "border-badge-accent-border text-badge-accent-fg hover:bg-state-hover"
              : "border-border/80 text-ink-muted hover:bg-state-hover hover:text-ink",
          )}
          aria-label={`Remove ${label} filter`}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onRemove();
          }}
        >
          <X size={11} strokeWidth={2.25} aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "epure-filter-chip inline-flex h-8 min-h-8 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs cursor-pointer select-none focus-ring",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-mechanical,cubic-bezier(0.16,1,0.3,1))]",
        "active:scale-[0.97] motion-reduce:active:scale-100",
        active
          ? "border-accent/50 bg-accent-muted font-medium text-fg-primary"
          : "border-border-subtle bg-surface-1 font-normal text-fg-muted hover:border-border hover:bg-state-hover hover:text-fg-primary",
        className,
      )}
      onClick={onClick}
      title={title}
      {...props}
    >
      <span className="min-w-0 truncate">{label}</span>
      {typeof count === "number" ? (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[10px] tabular-nums",
            active
              ? "bg-accent/20 text-fg-primary"
              : "bg-surface-2 text-fg-muted",
          )}
        >
          {count}
        </span>
      ) : null}
      {children}
    </button>
  );
}
