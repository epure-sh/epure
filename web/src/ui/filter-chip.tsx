import { X } from "lucide-react";
import { type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { Box } from "@polar-sh/orbit/Box";

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
      <Box as="span"
       
        title={title ?? tokenHint ?? label}>
        <Box as="span" minWidth={0} alignItems="center" gap="xs" paddingHorizontal="s" paddingVertical="xs">
          {variant === "query" && filterKey ? (
            <>
              <Box as="span">
                {filterKey}
              </Box>
              <Box as="span" aria-hidden>:</Box>
              <Box as="span" overflow="hidden">{label}</Box>
            </>
          ) : (
            <Box as="span" overflow="hidden">{label}</Box>
          )}
        </Box>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center justify-center border-l px-1.5 cursor-pointer",
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
          <X size={12} strokeWidth={2.25} aria-hidden />
        </button>
      </Box>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "epure-filter-chip inline-flex h-control-sm max-w-full items-center gap-1 rounded-md border px-2.5 text-xs font-medium cursor-pointer select-none focus-ring",
        "transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-mechanical,cubic-bezier(0.16,1,0.3,1))]",
        "active:scale-[0.97] motion-reduce:active:scale-100",
        active
          ? "border-transparent bg-accent-muted text-accent"
          : "border-border bg-surface text-ink-muted hover:bg-state-hover hover:text-ink",
        className,
      )}
      onClick={onClick}
      title={title}
      {...props}
    >
      <Box as="span" overflow="hidden">{label}</Box>
    </button>
  );
}
