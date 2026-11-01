// src/components/ui/textarea.tsx — Phase 2: Orbit TextArea + Epure accent focus border (no ring)
import { TextArea as OrbitTextArea, type TextAreaProps } from "@polar-sh/orbit/TextArea";
import { cn } from "@/lib/utils";

export type { TextAreaProps };

export function TextArea({ className, ...props }: TextAreaProps) {
  return (
    <OrbitTextArea
      className={cn(
        "focus:border-accent focus:ring-0 focus-visible:border-accent focus-visible:ring-0 dark:focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
