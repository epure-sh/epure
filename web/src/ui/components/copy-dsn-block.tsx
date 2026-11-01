// web/src/ui/components/copy-dsn-block.tsx
// Tier 2 Component: Copyable DSN Connection String Block — uses ApiKeyField.

import { cn } from "@/lib/cn";
import { ApiKeyField } from "./api-key-field";

export interface CopyDsnBlockProps {
  dsn: string;
  label?: string;
  hint?: string | null;
  compact?: boolean;
  className?: string;
  onCopied?: () => void;
  onCopyFailed?: () => void;
}

export function CopyDsnBlock({
  dsn,
  label = "Connection string (DSN)",
  hint = "Paste this into your SDK init. One string. Copy and go.",
  compact = false,
  className,
  onCopied,
  onCopyFailed,
}: CopyDsnBlockProps) {
  return (
    <ApiKeyField
      value={dsn}
      label={label}
      hint={compact ? null : hint}
      masked={!compact}
      revealAllowed
      compact={compact}
      className={cn("epure-copy-dsn", className)}
      onCopied={onCopied}
      onCopyFailed={onCopyFailed}
    />
  );
}
