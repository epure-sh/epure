import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function WizardFieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[10px] font-medium uppercase tracking-wider text-fg-muted", className)}>
      {children}
    </p>
  );
}

/** Compact wizard block — uppercase label + tight spacing (Stitch step 2/3). */
export function AlertWizardSection({
  title,
  description,
  children,
  className,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <WizardFieldLabel>{title}</WizardFieldLabel>
          {description ? <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
