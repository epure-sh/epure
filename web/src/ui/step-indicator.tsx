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
}

export function StepIndicator({ steps, className }: StepIndicatorProps) {
  return (
    <ol className={cn("epure-step-indicator flex flex-wrap items-center gap-1", className)}>
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-1">
          {index > 0 ? (
            <span aria-hidden className="mx-1 text-ink-muted/40">·</span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs",
              step.complete
                ? "text-ink-muted"
                : step.active
                  ? "border-l-2 border-l-signal bg-bg-subtle pl-2 text-ink"
                  : "text-ink-muted",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-sm text-2xs",
                step.complete
                  ? "bg-signal/20 text-ink"
                  : step.active
                    ? "bg-signal text-signal-contrast"
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
