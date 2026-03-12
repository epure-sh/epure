import { X } from "lucide-react";
import { type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  /** Search-bar chip with dismiss control */
  variant?: "preset" | "query";
  filterKey?: string;
  tokenHint?: string;
  onRemove?: () => void;
}

export function FilterChip({
  label,
  active = true,
  variant = "preset",
  filterKey,
  tokenHint,
  onRemove,
  className,
  onClick,
  title,
  ...props
}: FilterChipProps) {
  if (onRemove) {
    return (
      <span
        className={cn(
          "epure-filter-chip epure-filter-chip--query group/chip inline-flex max-w-full items-stretch overflow-hidden border text-xs",
          variant === "query"
            ? "border-accent/30 bg-accent-muted/60 text-accent"
            : active
              ? "border-transparent bg-accent-muted text-accent"
              : "border-border bg-surface text-ink-muted",
          className,
        )}
        title={title ?? tokenHint ?? label}
      >
        <span className="flex min-w-0 items-center gap-1 px-2 py-1">
          {variant === "query" && filterKey ? (
            <>
              <span className="font-mono text-2xs uppercase tracking-wide text-accent/80">
                {filterKey}
              </span>
              <span className="text-ink-muted/50" aria-hidden>:</span>
              <span className="truncate font-medium text-ink">{label}</span>
            </>
          ) : (
            <span className="truncate font-medium">{label}</span>
          )}
        </span>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center justify-center border-l px-1.5 transition-colors duration-fast focus-ring",
            variant === "query"
              ? "border-accent/20 text-accent/70 hover:bg-accent/10 hover:text-accent"
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
          <X size={12} strokeWidth={2.25} aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "epure-filter-chip inline-flex h-control-sm max-w-full items-center gap-1 border px-2.5 text-xs font-medium transition-colors duration-fast focus-ring",
        active
          ? "border-transparent bg-accent-muted text-accent"
          : "border-border bg-surface text-ink-muted hover:bg-state-hover hover:text-ink",
        className,
      )}
      onClick={onClick}
      title={title}
      {...props}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
