import { Bot, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { copyText } from "../lib/copy-text";
import { Button } from "./button";

export interface ApplyWithAiButtonProps {
  prompt: string;
  className?: string;
  size?: "sm" | "toolbar" | "default";
  variant?: "ghost" | "secondary" | "primary";
  /** Setup footer — primary fill, larger hit target, Bot icon. */
  prominence?: "default" | "main";
  onCopied?: () => void;
  onCopyFailed?: () => void;
}

export function ApplyWithAiButton({
  prompt,
  className,
  size = "sm",
  variant = "ghost",
  prominence = "default",
  onCopied,
  onCopyFailed,
}: ApplyWithAiButtonProps) {
  const [copied, setCopied] = useState(false);
  const isMain = prominence === "main";

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(prompt);
    if (ok) {
      setCopied(true);
      onCopied?.();
      return;
    }
    onCopyFailed?.();
    onCopied?.();
  }, [onCopied, onCopyFailed, prompt]);

  return (
    <Button
      type="button"
      variant={isMain ? "primary" : variant}
      size={isMain ? "lg" : size}
      className={cn(
        !isMain && size === "default" && "text-sm",
        !isMain && size !== "default" && "text-xs",
        className,
      )}
      onClick={() => void handleCopy()}
      aria-label={copied ? "Copied prompt for AI" : "Apply with AI, copy prompt"}
    >
      {copied ? <Check strokeWidth={2.5} aria-hidden /> : <Bot strokeWidth={2} aria-hidden />}
      {copied ? "Copied" : "Apply with AI"}
    </Button>
  );
}
