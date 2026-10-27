import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SectionProps {
  children: ReactNode;
  /** Visual envelope */
  variant?: "plain" | "inset" | "band";
  /** Vertical spacing tier */
  density?: "compact" | "default";
  className?: string;
}

export function Section({
  children,
  variant = "plain",
  density = "default",
  className,
}: SectionProps) {
  return (
    <section
      className={cn(
        variant === "plain" && "border-b border-border px-4",
        variant === "plain" && (density === "compact" ? "py-2" : "py-row"),
        variant === "band" && "border-b border-border bg-surface-elevated px-4 py-2.5",
        variant === "inset" && "rounded-lg border border-border bg-surface-inset p-3",
        "epure-overview-section",
        className,
      )}
    >
      {children}
    </section>
  );
}

export type SectionMarkerTone = "signal" | "danger" | "healthy" | "muted";

const MARKER_TONE_CLASS: Record<SectionMarkerTone, string> = {
  signal: "bg-signal",
  danger: "bg-semantic-danger",
  healthy: "bg-healthy",
  muted: "bg-fg-muted/40",
};

export interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Status dot before title (defaults to accent signal). */
  markerTone?: SectionMarkerTone;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
  markerTone = "signal",
}: SectionHeaderProps) {
  return (
    <div className={cn("epure-section-header mb-2 flex flex-wrap items-baseline justify-between gap-2", className)}>
      <h3 className="epure-section-header-title flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-ink-muted">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", MARKER_TONE_CLASS[markerTone])} aria-hidden />
        {title}
      </h3>
      {description || actions ? (
        <div className="flex flex-wrap items-center gap-2">
          {description ? <p className="text-xs text-ink-muted">{description}</p> : null}
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
