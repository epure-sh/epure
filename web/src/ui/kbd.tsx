import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  keys: string;
}

export function Kbd({ keys, className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "epure-kbd inline-flex min-w-[1.25rem] items-center justify-center rounded-sm border border-border bg-bg-subtle px-1.5 py-0.5 font-mono text-2xs font-medium text-ink-muted",
        className,
      )}
      {...props}
    >
      {keys}
    </kbd>
  );
}
