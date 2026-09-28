import { useMemo } from "react";
import { buildSetupAiPrompt, type SetupPath, type SetupPhase } from "../lib/setup-ai-prompt";
import { EPURE_DOCS_URL } from "../lib/docs-url";
import {
  setupPlatformSnippets,
  setupPlatformById,
  type SetupPlatformId,
} from "../lib/setup-platform-snippets";
import { cn } from "../lib/cn";
import { ApplyWithAiButton } from "./apply-with-ai-button";
import { SetupConnectPanel } from "./setup-connect-panel";
import { SetupDocsLink } from "./setup-docs-link";

export interface SetupConnectGuideProps {
  dsn: string;
  phase: SetupPhase;
  path?: SetupPath;
  projectName?: string;
  platformId?: SetupPlatformId;
  className?: string;
  onAiCopied?: () => void;
  onAiCopyFailed?: () => void;
  listening?: boolean;
  listenError?: boolean;
}

export function SetupConnectGuide({
  dsn,
  phase,
  path = "fresh",
  projectName,
  platformId,
  className,
  onAiCopied,
  onAiCopyFailed,
  listening = false,
  listenError = false,
}: SetupConnectGuideProps) {
  const platform = useMemo(() => {
    const id = platformId ?? setupPlatformSnippets(dsn)[0]?.id;
    return id ? setupPlatformById(dsn, id) : undefined;
  }, [dsn, platformId]);

  const aiPromptConnect = useMemo(
    () =>
      buildSetupAiPrompt({
        dsn,
        path,
        phase: "connect",
        projectName,
        platformId: platform?.id,
        platformLabel: platform?.label,
        packageName: platform?.packageName,
        installCommand: platform?.installCommand,
      }),
    [dsn, path, platform, projectName],
  );

  if (phase === "verify") {
    return (
      <div className={cn("epure-setup-connect-guide space-y-2 text-center", className)}>
        <p className="text-sm text-ink-muted">Break something. We&apos;re listening.</p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {listening ? <span>Listening…</span> : null}
          {listenError ? (
            <span className="text-semantic-danger">Could not reach ingest</span>
          ) : null}
        </div>
      </div>
    );
  }

  if (!platform) {
    return null;
  }

  return (
    <div className={cn("epure-setup-connect-guide flex flex-col gap-2", className)}>
      <SetupConnectPanel
        dsn={dsn}
        platform={platform}
        setupPath={path}
        onCopied={onAiCopied}
        onCopyFailed={onAiCopyFailed}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <SetupDocsLink href={`${EPURE_DOCS_URL}/platforms`} className="text-2xs">
          All platforms
        </SetupDocsLink>
        <ApplyWithAiButton
          prompt={aiPromptConnect}
          prominence="main"
          onCopied={onAiCopied}
          onCopyFailed={onAiCopyFailed}
        />
      </div>
    </div>
  );
}
