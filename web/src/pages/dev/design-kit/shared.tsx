import * as React from "react";
import { cn } from "@/lib/utils";
import { usePreviewChrome } from "./preview-chrome";

export function PreviewBlock({
  title,
  description,
  children,
  id,
  states,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Optional chips: mock · empty · busy · error */
  states?: readonly string[];
}) {
  const chrome = usePreviewChrome();

  if (!chrome) {
    return (
      <div id={id} data-design-kit-block={id} className="w-full min-w-0">
        {children}
      </div>
    );
  }

  return (
    <section
      id={id}
      data-design-kit-block={id}
      className="rounded-panel border border-border-subtle bg-surface-2/30 p-3"
    >
      <header className="mb-2.5 border-b border-border-subtle pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="font-mono text-xs font-medium text-fg-primary">{title}</h3>
          {states?.map((s) => (
            <span
              key={s}
              className="rounded-control bg-surface-1 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-fg-muted"
            >
              {s}
            </span>
          ))}
        </div>
        {description ? (
          <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function PreviewRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="font-mono text-[10px] uppercase tracking-wide text-fg-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function MatrixCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-control border border-border-subtle bg-surface-2/40 p-2">
      <p className="mb-1.5 font-mono text-[10px] text-fg-muted">{label}</p>
      {children}
    </div>
  );
}
