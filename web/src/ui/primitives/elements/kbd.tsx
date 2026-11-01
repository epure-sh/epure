// web/src/ui/primitives/elements/kbd.tsx
// Tokenized keyboard shortcut pastille.

import * as React from "react";
import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  keys?: string;
  children?: React.ReactNode;
}

export function Kbd({ keys, children, className, ...props }: KbdProps) {
  const content = keys ?? children;
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "epure-kbd inline-flex h-4 min-w-[1.25rem] items-center justify-center rounded-[4px] border border-border bg-surface-inset px-1.5 font-mono text-[10px] font-medium text-fg-muted select-none",
        className,
      )}
      {...props}
    >
      {content}
    </kbd>
  );
}
