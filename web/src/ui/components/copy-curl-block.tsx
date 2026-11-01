// web/src/ui/components/copy-curl-block.tsx
// Tier 2 Component: Copyable cURL Command Block for API & Event Testing

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { CopyButton } from "./copy-button";

export interface CopyCurlBlockProps {
  /** Preformatted cURL command string */
  curlCommand?: string;
  /** Request URL */
  url?: string;
  /** HTTP Method */
  method?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: string | Record<string, unknown> | null;
  /** Header label (default: "cURL Command") */
  label?: string;
  /** Explanatory hint */
  hint?: string | null;
  /** Single-line compact presentation */
  compact?: boolean;
  className?: string;
  onCopied?: () => void;
  onCopyFailed?: () => void;
}

export function buildCurlFromRequest(
  url: string,
  method = "GET",
  headers?: Record<string, string>,
  body?: string | Record<string, unknown> | null,
): string {
  const parts = [`curl -X ${method.toUpperCase()} ${JSON.stringify(url)}`];
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (value != null) {
        parts.push(`  -H ${JSON.stringify(`${key}: ${value}`)}`);
      }
    }
  }
  if (body) {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body, null, 2);
    parts.push(`  -d ${JSON.stringify(bodyStr)}`);
  }
  return parts.join(" \\\n");
}

export function CopyCurlBlock({
  curlCommand,
  url,
  method = "POST",
  headers,
  body,
  label = "cURL Command",
  hint,
  compact = false,
  className,
  onCopied,
  onCopyFailed,
}: CopyCurlBlockProps) {
  const command = useMemo(() => {
    if (curlCommand) return curlCommand;
    if (url) return buildCurlFromRequest(url, method, headers, body);
    return "curl";
  }, [curlCommand, url, method, headers, body]);

  if (compact) {
    return (
      <div className={cn("epure-copy-curl flex min-w-0 items-center gap-2", className)}>
        <code className="min-w-0 flex-1 truncate rounded bg-surface-1 px-2 py-1 font-mono text-xs text-ink border border-border">
          {command.replace(/\s+/g, " ")}
        </code>
        <CopyButton
          value={command}
          label="Copy cURL"
          onCopied={onCopied}
          onCopyFailed={onCopyFailed}
        />
      </div>
    );
  }

  return (
    <div className={cn("epure-copy-curl space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm text-ink">{label}</p>
        <CopyButton
          value={command}
          label="Copy cURL"
          size="sm"
          onCopied={onCopied}
          onCopyFailed={onCopyFailed}
        />
      </div>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      <div className="epure-code-well relative overflow-hidden rounded-md border border-border bg-surface-1 p-3 shadow-xs">
        <pre className="overflow-x-auto font-mono text-xs text-ink leading-relaxed whitespace-pre">
          {command}
        </pre>
      </div>
    </div>
  );
}
