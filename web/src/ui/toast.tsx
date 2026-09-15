import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
}

export function Toast({ className, message, ...props }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        "epure-toast rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink",
        className,
      )}
      {...props}
    >
      {message}
    </div>
  );
}
