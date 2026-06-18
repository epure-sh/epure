import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface EmptyProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  /** `inset` drops the dashed frame for use inside bordered containers. */
  variant?: "default" | "inset";
}

export function Empty({
  className,
  title = "0 UNRESOLVED EXCEPTIONS",
  description,
  variant = "default",
  children,
  ...props
}: EmptyProps) {
  return (
    <div
      className={cn(
        "epure-empty flex flex-col items-center justify-center text-center",
        variant === "default"
          ? "rounded-lg border border-dashed border-border bg-surface p-4"
          : "epure-empty--inset border-0 bg-transparent p-0",
        className,
      )}
      {...props}
    >
      <p className="epure-empty-title text-sm font-medium text-ink-muted">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-xs text-ink-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
