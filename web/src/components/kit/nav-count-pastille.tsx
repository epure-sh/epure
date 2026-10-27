import { cn } from "@/lib/utils";
import { formatCompactCount } from "@/lib/format-count";

export interface NavCountPastilleProps {
  /** Omit or zero hides the pastille. */
  count?: number | null;
  /** Accent wash when the nav item needs attention (e.g. unread alerts). */
  tone?: "neutral" | "accent";
  className?: string;
  /** Defaults to "{count} items". */
  ariaLabel?: string;
}

/** Compact sidebar / rail count chip (6px radius, mono tabular). */
export function NavCountPastille({
  count,
  tone = "neutral",
  className,
  ariaLabel,
}: NavCountPastilleProps) {
  if (count == null || count <= 0) {
    return null;
  }

  const label = formatCompactCount(count);

  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-sm border px-1 font-mono text-[10px] font-medium tabular-nums leading-none",
        tone === "accent"
          ? "border-badge-accent-border bg-badge-accent-bg text-badge-accent-fg"
          : "border-border-subtle bg-surface-2 text-fg-secondary",
        className,
      )}
      aria-label={ariaLabel ?? `${count}`}
      title={String(count)}
    >
      {label}
    </span>
  );
}
