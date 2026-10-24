// src/components/kit/code-frame.tsx
import * as React from "react";
import { codeToHtml } from "shiki";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface CodeFrameProps {
  code: string;
  language?: string;
  filename?: string;
  highlightLine?: number;
  className?: string;
}

export function CodeFrame({
  code,
  language = "typescript",
  filename,
  highlightLine,
  className,
}: CodeFrameProps) {
  const [highlightedHtml, setHighlightedHtml] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang: language,
      theme: "vitesse-dark",
    })
      .then((html) => {
        if (!cancelled) {
          setHighlightedHtml(html);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlightedHtml(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed
    }
  };

  const lines = React.useMemo(() => code.split("\n"), [code]);

  return (
    <div
      data-slot="code-frame"
      className={cn(
        "rounded-panel border border-border-subtle bg-canvas shadow-tactile overflow-hidden flex flex-col font-mono text-xs",
        className
      )}
    >
      {/* Header with filename/language and copy button */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-1 px-3 text-[11px] text-fg-muted select-none">
        <div className="flex items-center gap-2">
          {filename && <span className="font-medium text-fg-primary">{filename}</span>}
          <span className="rounded-[3px] border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-fg-muted">
            {language}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          title={copied ? "Copied" : "Copy snippet"}
        >
          {copied ? <Check className="size-3 text-healthy" weight="bold" /> : <Copy className="size-3" />}
        </Button>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto p-3 text-xs leading-relaxed tabular-nums">
        {highlightedHtml ? (
          <div
            className="[&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&_code]:font-mono text-xs"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="m-0 p-0 font-mono text-fg-secondary">
            <code>
              {lines.map((line, idx) => {
                const lineNum = idx + 1;
                const isTarget = highlightLine === lineNum;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-3 px-1",
                      isTarget && "bg-escalating/15 text-escalating font-semibold border-l-2 border-escalating -ml-1 pl-2"
                    )}
                  >
                    <span className="w-8 shrink-0 select-none text-right font-mono text-[11px] text-fg-muted">
                      {lineNum}
                    </span>
                    <span className="flex-1 whitespace-pre">{line || " "}</span>
                  </div>
                );
              })}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
