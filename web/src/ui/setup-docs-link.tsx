import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function SetupDocsLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-accent underline-offset-2 hover:underline focus-ring",
        className,
      )}
    >
      {children}
      <ExternalLink size={12} className="shrink-0 opacity-70" aria-hidden />
    </a>
  );
}

export function SetupStepSection({
  step,
  title,
  docHref,
  docLabel = "Docs",
  children,
  className,
}: {
  step: number;
  title: string;
  docHref?: string;
  docLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-bg-subtle/40 px-2.5 py-1.5">
        <p className="text-xs font-medium tracking-ui text-ink">
          <span className="mr-1.5 font-mono text-2xs text-ink-muted">{step}.</span>
          {title}
        </p>
        {docHref ? (
          <SetupDocsLink href={docHref} className="shrink-0">
            {docLabel}
          </SetupDocsLink>
        ) : null}
      </div>
      <div className="p-2.5">{children}</div>
    </section>
  );
}
