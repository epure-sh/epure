import { cn } from "../lib/cn";

export interface CodeLine {
  number: number;
  text: string;
  fault?: boolean;
}

export interface CodeBlockProps {
  lines: CodeLine[];
  className?: string;
}

export function CodeBlock({ lines, className }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "epure-code-block overflow-hidden rounded-sm border border-border bg-bg-subtle font-mono text-xs",
        className,
      )}
    >
      {lines.map((line) => (
        <div
          key={line.number}
          className={cn(
            "flex border-b border-border last:border-b-0",
            line.fault &&
              "border-l-2 border-l-semantic-danger bg-semantic-danger/10 text-semantic-danger",
          )}
        >
          <span className="w-10 shrink-0 border-r border-border px-2 py-1 text-right text-ink-muted">
            {line.number}
          </span>
          <pre className="m-0 flex-1 overflow-x-auto px-3 py-1 whitespace-pre">{line.text}</pre>
        </div>
      ))}
    </div>
  );
}
