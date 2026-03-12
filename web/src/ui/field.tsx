import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Label } from "./label";

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, children, className, ...props }: FieldProps) {
  return (
    <div className={cn("epure-field flex flex-col gap-2", className)} {...props}>
      <Label htmlFor={htmlFor} className={error ? "text-semantic-danger" : undefined}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-semantic-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
