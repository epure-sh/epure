import { useState } from "react";
import { cn } from "../lib/cn";
import { CopyButton } from "./copy-button";
import { Input } from "./input";

export interface CopyDsnBlockProps {
  dsn: string;
  label?: string;
  hint?: string;
  className?: string;
  onCopied?: () => void;
}

export function CopyDsnBlock({
  dsn,
  label = "Connection string (DSN)",
  hint = "Paste this into your SDK init. One string — copy and go.",
  className,
  onCopied,
}: CopyDsnBlockProps) {
  const [revealed, setRevealed] = useState(true);

  return (
    <div className={cn("epure-copy-dsn space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm text-ink">{label}</p>
        <button
          type="button"
          className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-ring"
          onClick={() => setRevealed((value) => !value)}
        >
          {revealed ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      <div className="epure-code-well flex gap-2 rounded-md border border-border bg-bg-subtle p-2">
        <Input
          readOnly
          value={revealed ? dsn : "••••••••••••••••••••••••••••••••"}
          className="border-0 bg-transparent font-mono text-xs shadow-none focus:bg-transparent"
          aria-label={label}
        />
        <CopyButton
          value={dsn}
          label="Copy"
          onCopied={onCopied}
        />
      </div>
    </div>
  );
}
