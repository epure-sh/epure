import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface EmptyProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  /** `inset` drops extra padding for use inside bordered containers. */
  variant?: "default" | "inset";
}

export function Empty({
  className,
  title = "No unresolved exceptions",
  description,
  variant = "default",
  children,
  ...props
}: EmptyProps) {
  return (
    <div
      className={cn(
        "epure-empty flex flex-col",
        variant === "default"
          ? "items-center justify-center py-10 text-center"
          : "epure-empty--inset items-start p-0 text-left",
        className,
      )}
      {...props}
    >
      <p className="epure-empty-title text-sm font-medium tracking-ui text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-xs text-ink-muted">{description}</p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
