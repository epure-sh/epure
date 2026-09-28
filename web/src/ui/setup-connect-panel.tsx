import { useMemo } from "react";
import type { SetupPath } from "../lib/setup-ai-prompt";
import { EPURE_DOCS_MIGRATION_URL, EPURE_DOCS_QUICKSTART_URL } from "../lib/docs-url";
import {
  setupPlatformInitFiles,
  setupPlatformDocUrl,
  type SetupPlatformSnippet,
} from "../lib/setup-platform-snippets";
import { CopyButton } from "./copy-button";
import { CopyDsnBlock } from "./copy-dsn-block";
import { SetupDocsLink } from "./setup-docs-link";
import { SetupPlatformMark } from "./setup-platform-mark";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

export interface SetupConnectPanelProps {
  dsn: string;
  platform: SetupPlatformSnippet;
  setupPath: SetupPath;
  onCopied?: () => void;
  onCopyFailed?: () => void;
}

export function SetupConnectPanel({
  dsn,
  platform,
  setupPath,
  onCopied,
  onCopyFailed,
}: SetupConnectPanelProps) {
  const initFiles = useMemo(() => setupPlatformInitFiles(platform), [platform]);
  const platformDoc = setupPlatformDocUrl(platform);
  const guideHref =
    setupPath === "sentry" ? EPURE_DOCS_MIGRATION_URL : EPURE_DOCS_QUICKSTART_URL;
  const guideLabel = setupPath === "sentry" ? "From Sentry" : "Quickstart";
  const defaultTab = setupPath === "sentry" ? "dsn" : "install";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SetupPlatformMark logo={platform.logo} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-ui text-ink">{platform.label}</p>
            <p className="truncate font-mono text-2xs text-ink-muted">{platform.packageName}</p>
          </div>
        </div>
        <p className="shrink-0 pt-0.5 text-2xs text-ink-muted">
          <SetupDocsLink href={guideHref}>{guideLabel}</SetupDocsLink>
          {" · "}
          <SetupDocsLink href={platformDoc}>Docs</SetupDocsLink>
        </p>
      </div>

      <Tabs
        defaultValue={defaultTab}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <TabsList className="h-auto w-full shrink-0 flex-wrap justify-start gap-0">
          {setupPath !== "sentry" ? (
            <TabsTrigger value="install" className="px-2.5 py-1.5 text-xs">
              Install
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="dsn" className="px-2.5 py-1.5 text-xs">
            DSN
          </TabsTrigger>
          {initFiles.map((file) => (
            <TabsTrigger key={file.filename} value={file.filename} className="px-2.5 py-1.5 text-xs">
              {file.filename}
            </TabsTrigger>
          ))}
        </TabsList>

        {setupPath !== "sentry" ? (
          <TabsContent
            value="install"
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <div className="mb-1.5 flex shrink-0 justify-end">
              <CopyButton
                value={platform.installCommand}
                label="Copy"
                className="h-7 px-2"
                onCopied={onCopied}
              />
            </div>
            <pre className="epure-code-well min-h-0 flex-1 overflow-auto rounded-md border border-border bg-bg-subtle p-2.5 font-mono text-xs text-ink">
              {platform.installCommand}
            </pre>
          </TabsContent>
        ) : null}

        <TabsContent
          value="dsn"
          className="mt-2 min-h-0 flex-1 overflow-auto data-[state=inactive]:hidden"
        >
          <CopyDsnBlock
            dsn={dsn}
            compact
            hint={null}
            onCopied={onCopied}
            onCopyFailed={onCopyFailed}
          />
        </TabsContent>

        {initFiles.map((file) => (
          <TabsContent
            key={file.filename}
            value={file.filename}
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <div className="mb-1.5 flex shrink-0 justify-end">
              <CopyButton
                value={file.code}
                label="Copy"
                className="h-7 px-2"
                onCopied={onCopied}
              />
            </div>
            <pre className="epure-code-well min-h-0 flex-1 overflow-auto rounded-md border border-border bg-bg-subtle p-2.5 font-mono text-xs text-ink">
              {file.code}
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
