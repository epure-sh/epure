import { cn } from "../lib/cn";
import type { SetupPlatformLogoId } from "../lib/setup-platform-snippets";

export interface SetupPlatformMarkProps {
  logo: SetupPlatformLogoId;
  size?: "sm" | "md";
  className?: string;
}

const sizeClass = {
  sm: "h-7 w-7 [&_img]:h-3.5 [&_img]:w-3.5",
  md: "h-8 w-8 [&_img]:h-4 [&_img]:w-4",
} as const;

export function SetupPlatformMark({ logo, size = "md", className }: SetupPlatformMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-bg-subtle",
        sizeClass[size],
        className,
      )}
      aria-hidden
    >
      <img src={`/frameworks/${logo}.svg`} alt="" className="object-contain" />
    </span>
  );
}
