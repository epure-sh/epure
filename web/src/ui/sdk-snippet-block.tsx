import { cn } from "../lib/cn";
import { CopyButton } from "./copy-button";

export interface SdkSnippetBlockProps {
  dsn: string;
  environment?: string;
  className?: string;
}

export function SdkSnippetBlock({
  dsn,
  environment = "production",
  className,
}: SdkSnippetBlockProps) {
  const snippet = `import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${dsn}",
  environment: "${environment}",
});`;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-mono text-sm text-ink">Test error snippet</p>
      <p className="text-sm text-ink-muted">
        Add this to your app, deploy, or run locally — then trigger any uncaught exception.
      </p>
      <pre className="epure-code-well overflow-x-auto rounded-md border border-border bg-bg-subtle p-3 font-mono text-xs text-ink">
        {snippet}
      </pre>
      <CopyButton value={snippet} label="Copy snippet" />
    </div>
  );
}
