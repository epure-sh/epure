import { type ReactNode, useMemo } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "../lib/cn";
import {
  EPURE_DOCS_MIGRATION_URL,
  EPURE_DOCS_QUICKSTART_URL,
  EPURE_DOCS_URL,
} from "../lib/docs-url";
import { buildSetupAiPrompt, type SetupPhase } from "../lib/setup-ai-prompt";
import { ApplyWithAiButton } from "./apply-with-ai-button";
import { Button } from "./button";

export interface SetupConnectGuideProps {
  dsn: string;
  phase: SetupPhase;
  projectName?: string;
  className?: string;
  onAiCopied?: () => void;
  onSendTest?: () => void;
  testBusy?: boolean;
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

export function SetupConnectGuide({
  dsn,
  phase,
  projectName,
  className,
  onAiCopied,
  onSendTest,
  testBusy = false,
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

  if (phase === "verify") {
    return (
      <div className={cn("epure-setup-connect-guide space-y-3", className)}>
        <p className="text-sm text-ink-muted">
          Wire the DSN into your SDK, then trigger any error — it appears here automatically.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {onSendTest ? (
            <Button
              variant="primary"
              size="sm"
              disabled={testBusy}
              onClick={onSendTest}
            >
              {testBusy ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Sending…
                </>
              ) : (
                "Send test error"
              )}
            </Button>
          ) : null}
          <ApplyWithAiButton prompt={aiPrompt} size="toolbar" onCopied={onAiCopied} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {listening ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Listening…
            </span>
          ) : null}
          {listenError ? (
            <span className="text-semantic-danger">Could not send test error</span>
          ) : null}
          <DocsLink href={EPURE_DOCS_QUICKSTART_URL}>Quickstart</DocsLink>
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

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <DocsLink href={EPURE_DOCS_URL}>Full docs</DocsLink>
        <ApplyWithAiButton prompt={aiPrompt} size="toolbar" onCopied={onAiCopied} />
      </div>
    </div>
  );
}
