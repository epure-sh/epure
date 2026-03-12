import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  onCopied?: () => void;
}

export function CopyButton({ value, label = "Copy", className, onCopied }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
    } catch {
      // ignore clipboard errors
    }
  }, [onCopied, value]);

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
