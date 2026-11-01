import type { ComponentPropsWithoutRef } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentVendorAvatars } from "@/ui/components/agent-vendor-avatars";

export interface CopyForAgentsButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof Button>, "children" | "variant" | "size"> {
  copied?: boolean;
  label?: string;
  copiedLabel?: string;
}

export function CopyForAgentsButton({
  copied = false,
  label = "Copy for agent",
  copiedLabel = "Copied",
  className,
  disabled,
  ...props
}: CopyForAgentsButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      aria-label={copied ? copiedLabel : label}
      className={cn(
        "h-8 gap-2 rounded-full border-border bg-surface-1 px-3.5 text-sm font-medium text-fg-primary shadow-none hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {copied ? (
        <Check className="size-3.5 shrink-0 text-healthy" aria-hidden />
      ) : (
        <AgentVendorAvatars size={18} />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </Button>
  );
}
