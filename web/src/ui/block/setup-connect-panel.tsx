// web/src/ui/block/setup-connect-panel.tsx
// Tier 3 Block: Setup Connect Panel
// Platform SDK onboarding tabs (Install, DSN, Dual-Send Tee, framework init files).

import { useMemo } from "react";
import type { SetupPath } from "../../lib/setup-ai-prompt";
import { EPURE_DOCS_MIGRATION_URL, EPURE_DOCS_QUICKSTART_URL } from "../../lib/docs-url";
import {
  setupPlatformInitFiles,
  setupPlatformDocUrl,
  setupPlatformSnippets,
  type SetupPlatformSnippet,
} from "../../lib/setup-platform-snippets";
import { CopyButton } from "../components/copy-button";
import { CopyDsnBlock } from "../components/copy-dsn-block";
import { SetupDocsLink } from "../components/setup-docs-link";
import { SetupPlatformMark } from "../components/setup-platform-mark";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../primitives/elements/tabs";
import { Box } from "../primitives/layout/box";

export interface SetupConnectPanelProps {
  dsn: string;
  platform?: SetupPlatformSnippet;
  setupPath?: SetupPath;
  defaultPlatform?: string;
  onCopied?: () => void;
  onCopyFailed?: () => void;
}

export function SetupConnectPanel({
  dsn,
  platform,
  setupPath = "fresh",
  defaultPlatform = "nextjs",
  onCopied,
  onCopyFailed,
}: SetupConnectPanelProps) {
  const snippets = useMemo(() => setupPlatformSnippets(dsn), [dsn]);
  const resolvedPlatform =
    platform ??
    snippets.find((s) => s.id === defaultPlatform) ??
    snippets[0];
  const initFiles = useMemo(
    () => setupPlatformInitFiles(resolvedPlatform),
    [resolvedPlatform],
  );
  const platformDoc = setupPlatformDocUrl(resolvedPlatform);
  const guideHref =
    setupPath === "sentry" ? EPURE_DOCS_MIGRATION_URL : EPURE_DOCS_QUICKSTART_URL;
  const guideLabel = setupPath === "sentry" ? "From Sentry" : "Quickstart";
  const defaultTab = setupPath === "sentry" ? "dsn" : "install";

  const dualSendingSnippet = useMemo(() => {
    let envelopeUrl = dsn;
    try {
      const parsed = new URL(dsn);
      const key = parsed.username;
      const proj = parsed.pathname.replace(/^\//, "");
      envelopeUrl = `${parsed.protocol}//${parsed.host}/api/${proj}/envelope/?sentry_key=${key}&sentry_version=7`;
    } catch {}

    if (resolvedPlatform.id === "python") {
      return `import os, urllib.request, sentry_sdk
from sentry_sdk.transport import HttpTransport

class DualTransport(HttpTransport):
    def capture_envelope(self, envelope):
        try:
            # Fire-and-forget shadow to Epure
            req = urllib.request.Request(
                "${envelopeUrl}",
                data=envelope.serialize(),
                headers={"Content-Type": "application/x-sentry-envelope"}
            )
            urllib.request.urlopen(req, timeout=1.0)
        except Exception:
            pass
        return super().capture_envelope(envelope)

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    transport=DualTransport
)`;
    }

    const pkg = resolvedPlatform.packageName.replace(/@\d+\.\d+\.\d+.*$/, "");
    return `import * as Sentry from "${pkg}";

function makeDualTransport(options: any) {
  const sentryTransport = Sentry.makeFetchTransport ? Sentry.makeFetchTransport(options) : Sentry.makeNodeTransport(options);
  const epureEnvelopeUrl = "${envelopeUrl}";

  return {
    send(envelope: any) {
      // Fire-and-forget shadow copy to Epure (never throws, zero risk)
      fetch(epureEnvelopeUrl, {
        method: "POST",
        body: Sentry.serializeEnvelope(envelope),
        keepalive: true,
      }).catch(() => {});

      return sentryTransport.send(envelope);
    },
    flush: (timeout?: number) => sentryTransport.flush(timeout),
  };
}

Sentry.init({
  dsn: process.env.SENTRY_DSN, // Keep existing Sentry DSN
  transport: makeDualTransport,
});`;
  }, [dsn, resolvedPlatform]);

  return (
    <div data-slot="setup-connect-panel" className="flex h-full w-full flex-col">
      <Box minHeight={0} flexGrow={1} flexDirection="column" gap="s" overflow="hidden">
        <Box flexShrink={0} alignItems="start" justifyContent="between" gap="s">
          <Box minWidth={0} alignItems="center" gap="s">
            <SetupPlatformMark logo={resolvedPlatform.logo} />
            <Box minWidth={0}>
              <p className="truncate text-sm font-medium tracking-ui text-ink">{resolvedPlatform.label}</p>
              <p className="truncate font-mono text-2xs text-ink-muted">{resolvedPlatform.packageName}</p>
            </Box>
          </Box>
          <p className="shrink-0 pt-0.5 text-2xs text-ink-muted">
            <SetupDocsLink href={guideHref}>{guideLabel}</SetupDocsLink>
            {" · "}
            <SetupDocsLink href={platformDoc}>Docs</SetupDocsLink>
          </p>
        </Box>

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
          {setupPath === "sentry" ? (
            <TabsTrigger value="dual-send" className="px-2.5 py-1.5 text-xs text-accent font-medium">
              Dual-Send (Tee)
            </TabsTrigger>
          ) : null}
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
            <Box flexShrink={0} justifyContent="end">
              <CopyButton
                value={resolvedPlatform.installCommand}
                label="Copy for agent"
                className="h-7 px-2"
                onCopied={onCopied}
              />
            </Box>
            <pre className="epure-code-well min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface-1 p-2.5 font-mono text-xs text-ink shadow-xs">
              {resolvedPlatform.installCommand}
            </pre>
          </TabsContent>
        ) : null}

        <TabsContent
          value="dsn"
          forceMount
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

        {setupPath === "sentry" ? (
          <TabsContent
            value="dual-send"
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <Box flexShrink={0} alignItems="center" justifyContent="between">
              <Box as="span">Shadow Sentry traffic to Epure with zero risk:</Box>
              <CopyButton
                value={dualSendingSnippet}
                label="Copy for agent"
                className="h-7 px-2"
                onCopied={onCopied}
              />
            </Box>
            <pre className="epure-code-well min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface-1 p-2.5 font-mono text-xs text-ink shadow-xs leading-relaxed">
              {dualSendingSnippet}
            </pre>
          </TabsContent>
        ) : null}

        {initFiles.map((file) => (
          <TabsContent
            key={file.filename}
            value={file.filename}
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <Box flexShrink={0} justifyContent="end">
              <CopyButton
                value={file.code}
                label="Copy for agent"
                className="h-7 px-2"
                onCopied={onCopied}
              />
            </Box>
            <pre className="epure-code-well min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface-1 p-2.5 font-mono text-xs text-ink shadow-xs">
              {file.code}
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </Box>
    </div>
  );
}
