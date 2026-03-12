import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface FairUseBannerProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
}

export function FairUseBanner({ className, message, ...props }: FairUseBannerProps) {
  return (
    <div
      className={cn(
        "epure-fair-use-banner border border-border border-l-[3px] border-l-semantic-warning bg-surface p-3 text-sm text-ink",
        className,
      )}
      {...props}
    >
      {message}
    </div>
  );
}
