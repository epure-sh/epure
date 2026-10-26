import { cn } from "@/lib/cn";

const STEPS = [
  { id: 1, label: "Name & template" },
  { id: 2, label: "Conditions" },
  { id: 3, label: "Notify" },
] as const;

export function AlertWizardSteps({
  step,
  editing,
  className,
}: {
  step: 1 | 2 | 3;
  editing?: boolean;
  className?: string;
}) {
  if (editing) {
    return (
      <p className={cn("text-xs text-fg-muted", className)}>Edit name and firing conditions.</p>
    );
  }

  return (
    <ol className={cn("flex flex-wrap items-center gap-2", className)} aria-label="Create alert steps">
      {STEPS.map((item, index) => {
        const done = step > item.id;
        const active = step === item.id;
        return (
          <li key={item.id} className="flex items-center gap-2">
            {index > 0 ? <span className="text-fg-muted/40" aria-hidden>·</span> : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                active ? "text-fg-primary" : done ? "text-fg-secondary" : "text-fg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border font-mono text-[10px]",
                  active
                    ? "border-accent bg-accent-muted text-fg-primary"
                    : done
                      ? "border-border-strong bg-surface-2 text-fg-secondary"
                      : "border-border-subtle bg-surface-1 text-fg-muted",
                )}
              >
                {item.id}
              </span>
              {item.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
