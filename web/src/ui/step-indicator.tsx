import { Check } from "lucide-react";
import { cn } from "../lib/cn";

export interface StepIndicatorItem {
  id: string;
  label: string;
  complete?: boolean;
  active?: boolean;
}

export interface StepIndicatorProps {
  steps: StepIndicatorItem[];
  className?: string;
  /** Compact progress bar for embedding inside a card. */
  variant?: "pills" | "bar";
}

export function StepIndicator({
  steps,
  className,
  variant = "pills",
}: StepIndicatorProps) {
  if (variant === "bar") {
    const activeIndex = Math.max(
      0,
      steps.findIndex((step) => step.active),
    );
    const completedCount = steps.filter((step) => step.complete).length;
    const progressIndex = Math.max(activeIndex, completedCount);
    const ratio =
      steps.length === 0
        ? 0
        : (progressIndex + (steps[activeIndex]?.complete ? 1 : 0.45)) / steps.length;
    const clamped = Math.min(1, Math.max(0.12, ratio));
    const active = steps[activeIndex];
    const label = active
      ? `Step ${activeIndex + 1} of ${steps.length} · ${active.label}`
      : `${completedCount} of ${steps.length} complete`;

    return (
      <div className={cn("epure-step-indicator epure-step-indicator-bar space-y-2", className)}>
        <p className="text-xs tracking-ui text-ink-muted">{label}</p>
        <div
          className="h-1 overflow-hidden rounded-sm bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={progressIndex + 1}
          aria-label={label}
        >
          <div
            className="h-full rounded-sm bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${clamped * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <ol className={cn("epure-step-indicator flex flex-wrap items-center gap-1", className)}>
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-1">
          {index > 0 ? (
            <span aria-hidden className="mx-1 text-ink-muted/40">
              ·
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
              step.complete
                ? "text-ink-muted"
                : step.active
                  ? "border border-border-strong bg-state-selected font-medium text-ink"
                  : "text-ink-muted",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-sm text-2xs",
                step.complete
                  ? "bg-accent/15 text-accent"
                  : step.active
                    ? "bg-accent text-accent-contrast"
                    : "bg-bg-subtle text-ink-muted",
              )}
              aria-hidden
            >
              {step.complete ? <Check size={10} strokeWidth={2.5} /> : index + 1}
            </span>
            <span>{step.label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
