import { type ReactNode, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "../lib/cn";
import {
  EPURE_DOCS_MIGRATION_URL,
  EPURE_DOCS_QUICKSTART_URL,
  EPURE_DOCS_URL,
} from "../lib/docs-url";
import { buildSetupAiPrompt, type SetupPhase } from "../lib/setup-ai-prompt";
import { setupPlatformSnippets } from "../lib/setup-platform-snippets";
import { ApplyWithAiButton } from "./apply-with-ai-button";
import { CopyButton } from "./copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

export interface SetupConnectGuideProps {
  dsn: string;
  phase: SetupPhase;
  projectName?: string;
  className?: string;
  onAiCopied?: () => void;
  onAiCopyFailed?: () => void;
  listening?: boolean;
  listenError?: boolean;
}

function DocsLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-accent underline-offset-2 hover:underline focus-ring"
    >
      {children}
      <ExternalLink size={12} className="shrink-0 opacity-70" aria-hidden />
    </a>
  );
}

function SnippetFile({ filename, code }: { filename: string; code: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs text-ink-muted">{filename}</p>
        <CopyButton value={code} label="Copy" className="h-7 px-2" />
      </div>
      <pre className="epure-code-well overflow-x-auto rounded-md border border-border bg-bg-subtle p-2.5 font-mono text-xs text-ink">
        {code}
      </pre>
    </div>
  );
}

export function SetupConnectGuide({
  dsn,
  phase,
  projectName,
  className,
  onAiCopied,
  onAiCopyFailed,
  listening = false,
  listenError = false,
}: SetupConnectGuideProps) {
  const aiPrompt = useMemo(
    () =>
      buildSetupAiPrompt({
        dsn,
        path: "fresh",
        phase,
        projectName,
      }),
    [dsn, phase, projectName],
  );
  const platforms = useMemo(() => setupPlatformSnippets(dsn), [dsn]);

  if (phase === "verify") {
    return (
      <div className={cn("epure-setup-connect-guide space-y-3", className)}>
        <p className="text-sm text-ink-muted">
          Verify the DSN in your app, then throw once.{" "}
          <DocsLink href={EPURE_DOCS_QUICKSTART_URL}>Quickstart</DocsLink>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <ApplyWithAiButton
            prompt={aiPrompt}
            size="toolbar"
            onCopied={onAiCopied}
            onCopyFailed={onAiCopyFailed}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {listening ? <span>Listening for the first exception…</span> : null}
          {listenError ? (
            <span className="text-semantic-danger">Could not reach the ingest endpoint</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("epure-setup-connect-guide space-y-3", className)}>
      <p className="text-sm text-ink-muted">
        Paste the DSN into your SDK init.{" "}
        <DocsLink href={EPURE_DOCS_QUICKSTART_URL}>Quickstart</DocsLink>
        {" · "}
        <DocsLink href={EPURE_DOCS_MIGRATION_URL}>From Sentry</DocsLink>
      </p>

      <Tabs defaultValue={platforms[0]?.id}>
        <TabsList className="w-full">
          {platforms.map((platform) => (
            <TabsTrigger key={platform.id} value={platform.id} className="px-3 py-2 text-xs">
              {platform.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {platforms.map((platform) => (
          <TabsContent key={platform.id} value={platform.id} className="space-y-3 pt-3">
            {platform.files.map((file) => (
              <SnippetFile key={file.filename} filename={file.filename} code={file.code} />
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <DocsLink href={EPURE_DOCS_URL}>Full docs</DocsLink>
        <ApplyWithAiButton
          prompt={aiPrompt}
          size="toolbar"
          onCopied={onAiCopied}
          onCopyFailed={onAiCopyFailed}
        />
      </div>
    </div>
  );
}
