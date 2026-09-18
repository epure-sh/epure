import { useMemo } from "react";
import { cn } from "../lib/cn";
import {
  setupPlatformSnippets,
  type SetupSnippetOptions,
} from "../lib/setup-platform-snippets";
import { CopyButton } from "./copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const INSTALL_FILENAMES = new Set([
  "package.json",
  "requirements.txt",
  "go.mod",
  "composer.json",
  "Gemfile",
  "install",
]);

export interface SdkSnippetBlockProps extends SetupSnippetOptions {
  dsn: string;
  /** Shown above the platform tabs. Omit when a parent card already titles the block. */
  title?: string;
  description?: string;
  className?: string;
  /** When true, skip install manifests and show only init files. */
  initOnly?: boolean;
}

function SnippetFile({ filename, code }: { filename: string; code: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs text-ink-muted">{filename}</p>
        <CopyButton value={code} label="Copy" className="h-7 px-2" />
      </div>
      <pre className="epure-code-well overflow-x-auto rounded-md border border-border bg-bg-subtle p-3 font-mono text-xs text-ink">
        {code}
      </pre>
    </div>
  );
}

export function SdkSnippetBlock({
  dsn,
  environment,
  release,
  title,
  description,
  className,
  initOnly = false,
}: SdkSnippetBlockProps) {
  const platforms = useMemo(
    () => setupPlatformSnippets(dsn, { environment, release }),
    [dsn, environment, release],
  );

  return (
    <div className={cn("space-y-2", className)}>
      {title ? <p className="font-mono text-sm text-ink">{title}</p> : null}
      {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      <Tabs defaultValue={platforms[0]?.id}>
        <TabsList className="w-full">
          {platforms.map((platform) => (
            <TabsTrigger key={platform.id} value={platform.id} className="px-3 py-2 text-xs">
              {platform.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {platforms.map((platform) => {
          const files = initOnly
            ? platform.files.filter((file) => !INSTALL_FILENAMES.has(file.filename))
            : platform.files;
          return (
            <TabsContent key={platform.id} value={platform.id} className="space-y-3 pt-3">
              {files.map((file) => (
                <SnippetFile key={file.filename} filename={file.filename} code={file.code} />
              ))}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
