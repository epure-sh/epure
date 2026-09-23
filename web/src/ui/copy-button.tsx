import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../lib/cn";
import { copyText } from "../lib/copy-text";
import { Button } from "./button";

export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  onCopied?: () => void;
  onCopyFailed?: () => void;
}

export function CopyButton({
  value,
  label = "Copy",
  className,
  onCopied,
  onCopyFailed,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      onCopied?.();
      return;
    }
    // Still acknowledge the click so gated flows (setup) are not stuck
    // when Clipboard API / execCommand are blocked.
    onCopyFailed?.();
    onCopied?.();
  }, [onCopied, onCopyFailed, value]);

  return (
    <Button
      type="button"
      variant="secondary"
      className={cn("gap-1.5 text-xs", className)}
      onClick={() => void handleCopy()}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : label}
    </Button>
  );
}
