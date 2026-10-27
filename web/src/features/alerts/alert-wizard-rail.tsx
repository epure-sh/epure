import { Check, Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

const STEPS = [
  { id: 1 as const, label: "Template" },
  { id: 2 as const, label: "Scope" },
  { id: 3 as const, label: "Dispatch" },
];

export function WizardStepBadge({ step }: { step: 1 | 2 | 3 }) {
  return (
    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-fg-muted">
      {step === 3 ? "Final step" : `Step ${step} of 3`}
    </span>
  );
}

/** Stitch-style breadcrumb: done = check pill, active = primary pill, upcoming = muted dot label. */
export function AlertWizardRail({
  step,
  className,
}: {
  step: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <nav
      className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)}
      aria-label="Create alert steps"
    >
      {STEPS.map((item, index) => {
        const done = step > item.id;
        const active = step === item.id;
        return (
          <span key={item.id} className="inline-flex items-center gap-1.5">
            {index > 0 ? (
              <span className="text-[11px] text-fg-muted/40" aria-hidden>
                /
              </span>
            ) : null}
            {done ? (
              <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 font-medium text-fg-secondary">
                <Icon icon={Check} size={12} weight="bold" aria-hidden />
                {item.id}. {item.label}
              </span>
            ) : active ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent-muted px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-fg-primary">
                <span className="size-1.5 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden />
                {item.id}. {item.label === "Scope" ? "Scope & logic" : item.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-fg-muted/70">
                <span className="size-1.5 rounded-full bg-fg-muted/30" aria-hidden />
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
