import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * Full-bleed content frame with the shared page gutter (`--epure-page-gutter`).
 * TopStrip + PageShell share this so left/right edges stay aligned.
 */
export function ShellContentFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="shell-content-frame"
      className={cn("flex w-full epure-page-gutter-x", className)}
    >
      {children}
    </div>
  );
}
