import { Copy, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../lib/cn";

export interface SourceCodeLine {
  number: number;
  text: string;
  fault?: boolean;
}

export interface SourceCodeBlockProps {
  filename: string;
  functionName?: string;
  lineno?: number;
  colno?: number;
  lines: SourceCodeLine[];
  className?: string;
  showHeader?: boolean;
  density?: "default" | "compact";
  copyValue?: string;
}

function formatLocation(
  filename: string,
  lineno?: number,
  colno?: number,
  functionName?: string,
): string {
  const shortFile = filename.replace(/^webpack:\/\/\.\//, "").replace(/^app:\/\//, "");
  const location = lineno != null ? `${shortFile}:${lineno}${colno != null ? `:${colno}` : ""}` : shortFile;
  return functionName ? `${location} in ${functionName}` : location;
}

function InlineCopyButton({ value }: { value: string }) {
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
    } catch {
      // ignore clipboard errors
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void handleCopy();
      }}
      className="shrink-0 rounded p-0.5 text-ink-muted transition-colors hover:bg-state-hover hover:text-ink focus-ring"
      aria-label={copied ? "Copied frame location" : "Copy frame location"}
    >
      {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
    </button>
  );
}

export function SourceCodeBlock({
  filename,
  functionName,
  lineno,
  colno,
  lines,
  className,
  showHeader = true,
  density = "default",
  copyValue,
}: SourceCodeBlockProps) {
  const compact = density === "compact";
  const location = formatLocation(filename, lineno, colno, functionName);

  return (
    <div
      className={cn(
        "epure-source-code-block epure-code-well overflow-hidden font-mono text-ink",
        compact ? "text-xs leading-[1.35rem]" : "text-sm leading-5",
        showHeader
          ? "rounded-md border border-border bg-bg-subtle"
          : "border-t border-border/80 bg-surface-inset",
        className,
      )}
    >
      {showHeader ? (
        <div
          className={cn(
            "flex items-center gap-2 border-b border-border bg-surface-elevated",
            compact ? "px-3 py-1.5" : "px-4 py-2.5",
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate text-ink-muted", compact ? "text-xs" : "text-sm")}>
            {location}
          </span>
          {copyValue ? <InlineCopyButton value={copyValue} /> : null}
        </div>
      ) : null}
      <div className={cn("overflow-x-auto", compact ? "py-1" : "py-1.5")}>
        {lines.map((line, lineIndex) => (
          <div
            key={`${line.number}-${lineIndex}`}
            className={cn(
              "flex items-start",
              compact ? "min-h-[1.35rem]" : "min-h-5",
              line.fault && "border-l-2 border-l-semantic-danger bg-semantic-danger/10",
            )}
          >
            <span
              className={cn(
                "shrink-0 select-none text-right tabular-nums",
                compact ? "w-9 pr-2 text-2xs" : "w-12 pr-3 text-xs",
                line.fault ? "font-medium text-semantic-danger" : "text-ink-muted",
              )}
            >
              {line.number}
            </span>
            <pre
              className={cn(
                "m-0 flex-1 whitespace-pre",
                compact ? "pr-3" : "pr-4",
                line.fault ? "font-medium text-semantic-danger" : "text-ink",
              )}
            >
              {line.text || " "}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
