// web/src/ui/components/api-key-field.tsx
// API-key / secret field — masked by default, reveal toggle, full-value copy.
// Pattern: shadcn-style ApiKeyField / SecretValueField (Vibra, Ballmac, OSCL).

import { useId, useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Button } from "../primitives";
import { CopyButton } from "./copy-button";

function maskSecret(value: string): string {
  const dsnMatch = value.match(/^(https?:\/\/)([^@/]+)(@.+)$/i);
  if (dsnMatch) {
    return `${dsnMatch[1]}${"•".repeat(Math.min(14, Math.max(8, dsnMatch[2].length)))}${dsnMatch[3]}`;
  }
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 6)}${"•".repeat(10)}${value.slice(-4)}`;
}

export interface ApiKeyFieldProps {
  value: string;
  label?: string;
  hint?: string | null;
  /** Start masked (default true). Set false for one-time “copy now” reveals. */
  masked?: boolean;
  /** Allow show/hide toggle (default true). */
  revealAllowed?: boolean;
  compact?: boolean;
  className?: string;
  onCopied?: () => void;
  onCopyFailed?: () => void;
}

export function ApiKeyField({
  value,
  label = "API key",
  hint,
  masked = true,
  revealAllowed = true,
  compact = false,
  className,
  onCopied,
  onCopyFailed,
}: ApiKeyFieldProps) {
  const fieldId = useId();
  const [revealed, setRevealed] = useState(!masked);
  const display = revealed ? value : maskSecret(value);

  return (
    <div
      data-slot="api-key-field"
      data-copy-value={value}
      data-revealed={revealed || undefined}
      role="group"
      aria-labelledby={label && !compact ? fieldId : undefined}
      className={cn("epure-api-key-field w-full min-w-0 space-y-1.5", className)}
    >
      {label && !compact ? (
        <p id={fieldId} className="text-xs font-medium text-fg-primary">
          {label}
        </p>
      ) : null}
      {hint && !compact ? <p className="text-xs text-fg-muted">{hint}</p> : null}

      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-1 rounded-md border border-border-subtle bg-surface-1 shadow-xs",
          compact ? "h-8 px-1.5" : "h-9 px-2",
        )}
      >
        <input
          readOnly
          spellCheck={false}
          autoComplete="off"
          value={display}
          aria-label={revealed ? label : `${label} (masked)`}
          onFocus={(event) => event.currentTarget.select()}
          className={cn(
            "w-full min-w-0 flex-1 border-0 bg-transparent px-1.5 font-mono text-xs text-fg-primary outline-none",
            "[scrollbar-width:none] focus-visible:ring-0",
          )}
        />
        {revealAllowed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 shrink-0 text-fg-muted hover:text-fg-primary"
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            aria-pressed={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? <EyeSlash className="size-3.5" weight="bold" /> : <Eye className="size-3.5" weight="bold" />}
          </Button>
        ) : null}
        <CopyButton
          value={value}
          variant="icon-only"
          size="icon"
          label={`Copy ${label}`}
          className="size-7 shrink-0"
          onCopied={onCopied}
          onCopyFailed={onCopyFailed}
        />
      </div>
    </div>
  );
}
