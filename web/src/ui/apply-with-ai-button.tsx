import { Check, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { copyText } from "../lib/copy-text";
import { Button } from "./button";

export interface ApplyWithAiButtonProps {
  prompt: string;
  className?: string;
  size?: "sm" | "toolbar" | "default";
  onCopied?: () => void;
  onCopyFailed?: () => void;
}

export function ApplyWithAiButton({
  prompt,
  className,
  size = "sm",
  onCopied,
  onCopyFailed,
}: ApplyWithAiButtonProps) {
  const [copied, setCopied] = useState(false);

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
      variant="ghost"
      size={size}
      className={cn("gap-1.5 text-xs", className)}
      onClick={() => void handleCopy()}
      aria-label={copied ? "Copied prompt for AI" : "Apply with AI — copy prompt"}
    >
      {copied ? <Check size={14} /> : <Sparkles size={14} />}
      {copied ? "Copied" : "Apply with AI"}
    </Button>
  );
}
