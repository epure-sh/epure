// web/src/ui/components/code-block.tsx
// Tier 2 Component: Consolidated Code Block & Syntax Frame (Cluster 3)
// Consolidates code-block, source-code-block, and code-frame.

import * as React from "react";
import { codeToHtml } from "shiki";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { cn } from "@/lib/cn";
import { CopyButton } from "./copy-button";

export interface CodeLineItem {
  number: number;
  text: string;
  fault?: boolean;
}

/** Legacy type aliases */
export type CodeLine = CodeLineItem;
export type SourceCodeLine = CodeLineItem;

export type CodeBlockVariant = "lines" | "syntax" | "snippet";
export type CodeBlockDensity = "default" | "compact" | "stack";
export type CodeBlockFaultTone = "danger" | "accent" | "neutral";

export interface CodeBlockProps {
  /** Display variant: line numbers with fault gutter, Shiki syntax frame, or inline snippet */
  variant?: CodeBlockVariant;
  /** Array of line items for structured traces */
  lines?: CodeLineItem[];
  /** Raw code string (used for syntax and snippet variants) */
  code?: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** File path displayed in the frame header */
  filename?: string;
  /** Function or method name context */
  functionName?: string;
  /** Line number coordinate */
  lineno?: number;
  /** Column number coordinate */
  colno?: number;
  /** Target line to highlight */
  highlightLine?: number;
  /** Vertical density tier */
  density?: CodeBlockDensity;
  /** Color tone for fault line emphasis */
  faultTone?: CodeBlockFaultTone;
  /** Whether to render the header chrome with location and copy button */
  showHeader?: boolean;
  /** Show copy button */
  copyable?: boolean;
  /** Custom text to copy (defaults to raw code or formatted lines) */
  copyValue?: string;
  /** Max height constraint for scrollable body */
  maxHeight?: string | number;
  /** Alias for maxHeight in code-frame */
  maxBodyHeight?: string;
  className?: string;
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

export function CodeBlock({
  variant,
  lines: linesProp,
  code: codeProp,
  language = "typescript",
  filename,
  functionName,
  lineno,
  colno,
  highlightLine,
  density = "default",
  faultTone = "danger",
  showHeader = true,
  copyable = true,
  copyValue,
  maxHeight,
  maxBodyHeight,
  className,
}: CodeBlockProps) {
  // Infer variant if not explicitly provided
  const resolvedVariant: CodeBlockVariant =
    variant ?? (linesProp && linesProp.length > 0 ? "lines" : codeProp ? "syntax" : "lines");

  // Derive lines and raw code
  const codeString = codeProp ?? linesProp?.map((l) => l.text).join("\n") ?? "";
  const lines: CodeLineItem[] =
    linesProp ??
    codeString.split("\n").map((text, idx) => ({
      number: idx + 1,
      text,
      fault: highlightLine ? highlightLine === idx + 1 : false,
    }));

  const valueToCopy = copyValue ?? codeString;
  const locationHeader = filename ? formatLocation(filename, lineno, colno, functionName) : null;
  const bodyHeightStyle = maxBodyHeight ?? (typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight);

  // Shiki syntax highlight state
  const [highlightedHtml, setHighlightedHtml] = React.useState<string | null>(null);
  const [theme, setTheme] = React.useState<"vitesse-dark" | "vitesse-light">("vitesse-dark");

  React.useEffect(() => {
    if (resolvedVariant !== "syntax") return;
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const resolve = () => {
      const mode =
        root.getAttribute("data-theme") === "light" || root.classList.contains("light")
          ? "vitesse-light"
          : "vitesse-dark";
      setTheme(mode);
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, [resolvedVariant]);

  React.useEffect(() => {
    if (resolvedVariant !== "syntax" || !codeString) {
      setHighlightedHtml(null);
      return;
    }

    let cancelled = false;
    codeToHtml(codeString, {
      lang: language,
      theme,
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
  }, [codeString, language, theme, resolvedVariant]);

  // Syntax Variant (Shiki + Orbit Frame)
  if (resolvedVariant === "syntax") {
    return (
      <Box
        data-slot="code-frame"
        borderRadius="m"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor="background-primary"
        boxShadow="s"
        overflow="hidden"
        flexDirection="column"
        className={className}
      >
        {showHeader && (filename || language || copyable) ? (
          <Box
            alignItems="center"
            justifyContent="between"
            height={32}
            flexShrink={0}
            borderBottomWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            backgroundColor="background-card"
            paddingHorizontal="m"
            userSelect="none"
          >
            <Box alignItems="center" columnGap="s">
              {filename ? (
                <Text as="span" variant="label">
                  {filename}
                </Text>
              ) : null}
              {language ? (
                <Box
                  as="span"
                  borderRadius="s"
                  borderWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                  backgroundColor="background-secondary"
                  paddingHorizontal="xs"
                  paddingVertical="xs"
                >
                  <Text as="span" variant="caption" color="muted" monospace>
                    {language}
                  </Text>
                </Box>
              ) : null}
            </Box>
            {copyable && valueToCopy ? (
              <CopyButton
                value={valueToCopy}
                variant="icon-only"
                size="icon-xs"
                tooltip="Copy snippet"
              />
            ) : null}
          </Box>
        ) : null}

        <Box
          overflowX="auto"
          overflowY={bodyHeightStyle ? "auto" : undefined}
          padding="m"
          style={bodyHeightStyle ? { maxHeight: bodyHeightStyle } : undefined}
        >
          {highlightedHtml ? (
            <Box
              className={
                bodyHeightStyle
                  ? "[&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&>pre]:!overflow-visible [&_code]:font-mono [&_code]:whitespace-pre-wrap [&_code]:break-all text-xs"
                  : "[&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&_code]:font-mono text-xs"
              }
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <Box flexDirection="column" color="text-secondary">
              {lines.map((line, idx) => {
                const isTarget = line.fault || (highlightLine === line.number);
                return (
                  <Box
                    key={idx}
                    alignItems="start"
                    columnGap="m"
                    paddingHorizontal="xs"
                    backgroundColor={isTarget ? "background-danger" : undefined}
                    borderLeftWidth={isTarget ? 2 : 0}
                    borderStyle={isTarget ? "solid" : undefined}
                    borderColor={isTarget ? "border-warning" : undefined}
                  >
                    <Box width={32} flexShrink={0}>
                      <Text
                        as="span"
                        variant="caption"
                        color="muted"
                        monospace
                        tabularNums
                        align="right"
                      >
                        {line.number}
                      </Text>
                    </Box>
                    <Box flex={1}>
                      <Text
                        as="span"
                        variant="caption"
                        monospace
                        wrap={bodyHeightStyle ? "wrap" : "nowrap"}
                      >
                        {line.text || " "}
                      </Text>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // Snippet Variant (clean minimalist code view)
  if (resolvedVariant === "snippet") {
    return (
      <div
        className={cn(
          "epure-code-snippet group relative overflow-hidden rounded-md border border-border bg-surface-1 font-mono text-xs shadow-xs",
          className,
        )}
      >
        {copyable && valueToCopy ? (
          <div className="absolute top-2 right-2 z-10 opacity-70 transition-opacity hover:opacity-100">
            <CopyButton value={valueToCopy} variant="inline" />
          </div>
        ) : null}
        <pre
          className="overflow-x-auto p-3 text-ink leading-relaxed"
          style={bodyHeightStyle ? { maxHeight: bodyHeightStyle } : undefined}
        >
          {codeString}
        </pre>
      </div>
    );
  }

  // Lines Variant (Source code block with fault gutter)
  const compact = density === "compact";
  const stack = density === "stack";
  const faultLineClass =
    faultTone === "accent"
      ? "bg-accent-muted text-fg-primary"
      : faultTone === "neutral"
        ? "border-l-2 border-l-border bg-surface-2/50"
        : "border-l-2 border-l-semantic-danger bg-semantic-danger/10 text-semantic-danger";
  const faultGutterClass =
    faultTone === "accent"
      ? "font-semibold text-accent"
      : faultTone === "neutral"
        ? "font-semibold text-fg-primary"
        : "font-medium text-semantic-danger";

  return (
    <div
      className={cn(
        "epure-source-code-block epure-code-well overflow-hidden font-mono text-fg-primary",
        stack
          ? "text-sm leading-6"
          : compact
            ? "text-xs leading-[1.35rem]"
            : "text-sm leading-5",
        showHeader && locationHeader
          ? "rounded-md border border-border bg-surface-1 shadow-xs"
          : "rounded-sm border border-border bg-surface-1",
        className,
      )}
    >
      {showHeader && locationHeader ? (
        <div
          className={cn(
            "flex items-center gap-2 border-b border-border bg-surface-elevated",
            compact ? "px-3 py-1.5" : "px-4 py-2.5",
          )}
        >
          <span
            className={cn("min-w-0 flex-1 truncate text-fg-muted", compact ? "text-xs" : "text-sm")}
          >
            {locationHeader}
          </span>
          {copyable && valueToCopy ? (
            <CopyButton value={valueToCopy} variant="inline" tooltip="Copy frame location" />
          ) : null}
        </div>
      ) : null}

      <div
        className={cn("overflow-x-auto", stack ? "py-1.5" : compact ? "py-1" : "py-1.5")}
        style={bodyHeightStyle ? { maxHeight: bodyHeightStyle } : undefined}
      >
        {lines.map((line, lineIndex) => (
          <div
            key={`${line.number}-${lineIndex}`}
            className={cn(
              "flex items-start",
              stack ? "min-h-6" : compact ? "min-h-[1.35rem]" : "min-h-5",
              line.fault && faultLineClass,
            )}
          >
            <span
              className={cn(
                "shrink-0 select-none text-right tabular-nums",
                stack
                  ? "w-11 border-r border-border-subtle bg-surface-2/30 pr-2.5 text-xs"
                  : "bg-surface-2/40",
                !stack && (compact ? "w-10 pr-2 text-2xs" : "w-12 pr-3 text-xs"),
                line.fault ? faultGutterClass : "text-fg-muted",
              )}
            >
              {String(line.number).padStart(stack ? 3 : 2, " ")}
            </span>
            <pre
              className={cn(
                "m-0 flex-1 whitespace-pre",
                stack ? "px-3" : compact ? "pr-3" : "pr-4",
                line.fault
                  ? faultTone === "danger"
                    ? "font-medium text-semantic-danger"
                    : "font-medium text-fg-primary"
                  : "text-fg-primary",
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

// ---------------------------------------------------------------------------
// Backwards Compatibility Shims
// ---------------------------------------------------------------------------

export interface SourceCodeBlockProps {
  filename: string;
  functionName?: string;
  lineno?: number;
  colno?: number;
  lines: SourceCodeLine[];
  className?: string;
  showHeader?: boolean;
  density?: "default" | "compact" | "stack";
  copyValue?: string;
  faultTone?: "danger" | "accent" | "neutral";
}

export function SourceCodeBlock(props: SourceCodeBlockProps) {
  return <CodeBlock variant="lines" {...props} />;
}

export interface CodeFrameProps {
  code: string;
  language?: string;
  filename?: string;
  highlightLine?: number;
  maxBodyHeight?: string;
  className?: string;
}

export function CodeFrame(props: CodeFrameProps) {
  return <CodeBlock variant="syntax" {...props} />;
}
