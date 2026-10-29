import { useState } from "react";
import { ShieldCheck, Zap } from "lucide-react";
import { Badge } from "./badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { CopyButton } from "./copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

export interface DualSendingCardProps {
  publicKey: string;
  dsnSegment: string;
}

export function DualSendingCard({ publicKey, dsnSegment }: DualSendingCardProps) {
  const [selectedLang, setSelectedLang] = useState<"nextjs" | "node" | "browser" | "python">("nextjs");
  const host = typeof window !== "undefined" ? window.location.host : "ingest.epure.sh";
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http";
  const envelopeUrl = `${protocol}://${host}/api/${dsnSegment}/envelope/?sentry_key=${publicKey}&sentry_version=7`;

  const nextJsSnippet = `import * as Sentry from "@sentry/nextjs";

// Custom dual transport: Tee envelopes to Epure without affecting Sentry
function makeDualTransport(options: any) {
  const sentryTransport = Sentry.makeFetchTransport(options);
  const epureEnvelopeUrl = "${envelopeUrl}";

  return {
    send(envelope: any) {
      // Fire-and-forget shadow copy to Epure (never throws, never delays user response)
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

  const nodeSnippet = `const Sentry = require("@sentry/node");

function makeDualTransport(options) {
  const sentryTransport = Sentry.makeNodeTransport(options);
  const epureEnvelopeUrl = "${envelopeUrl}";

  return {
    send(envelope) {
      fetch(epureEnvelopeUrl, {
        method: "POST",
        body: Sentry.serializeEnvelope(envelope),
        keepalive: true,
      }).catch(() => {});

      return sentryTransport.send(envelope);
    },
    flush: (timeout) => sentryTransport.flush(timeout),
  };
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  transport: makeDualTransport,
});`;

  const browserSnippet = `import * as Sentry from "@sentry/browser";

function makeDualTransport(options) {
  const sentryTransport = Sentry.makeFetchTransport(options);
  const epureEnvelopeUrl = "${envelopeUrl}";

  return {
    send(envelope) {
      fetch(epureEnvelopeUrl, {
        method: "POST",
        body: Sentry.serializeEnvelope(envelope),
        keepalive: true,
      }).catch(() => {});

      return sentryTransport.send(envelope);
    },
    flush: (timeout) => sentryTransport.flush(timeout),
  };
}

Sentry.init({
  dsn: window.SENTRY_DSN,
  transport: makeDualTransport,
});`;

  const pythonSnippet = `import sentry_sdk
from sentry_sdk.transport import HttpTransport
import urllib.request

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

  const currentSnippet =
    selectedLang === "nextjs"
      ? nextJsSnippet
      : selectedLang === "node"
        ? nodeSnippet
        : selectedLang === "browser"
          ? browserSnippet
          : pythonSnippet;

  return (
    <Card className="border-accent/40 bg-accent-muted/10">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-ink flex items-center gap-2">
              <Zap className="size-4 text-accent" />
              <span>Zero-Risk Migration: 6-Line Dual-Sending Tee</span>
            </CardTitle>
            <Badge variant="env">Shadow Traffic</Badge>
          </div>
          <span className="text-2xs font-mono text-ink-muted">100% Sentry Compatible</span>
        </div>
        <CardDescription className="text-xs text-ink-muted leading-relaxed">
          Evaluate Epure in production with zero risk. Send envelopes to both Sentry and Epure simultaneously.
          Shadowing is strictly fire-and-forget — it will never fail a request or interfere with your existing Sentry alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Envelope URL Block */}
        <div className="rounded-md border border-border bg-surface-1 p-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-2xs font-mono uppercase tracking-wider text-ink-subtle">
              Direct Ingest Envelope Endpoint
            </span>
            <CopyButton value={envelopeUrl} label="Copy endpoint" className="h-6 text-2xs px-2" />
          </div>
          <p className="font-mono text-xs text-ink break-all select-all">{envelopeUrl}</p>
        </div>

        {/* Code Tabs */}
        <Tabs value={selectedLang} onValueChange={(val) => setSelectedLang(val as any)}>
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="nextjs" className="text-xs">Next.js</TabsTrigger>
              <TabsTrigger value="node" className="text-xs">Node.js</TabsTrigger>
              <TabsTrigger value="browser" className="text-xs">Browser</TabsTrigger>
              <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
            </TabsList>
            <CopyButton value={currentSnippet} label="Copy snippet" className="h-7 text-xs px-2.5" />
          </div>

          <TabsContent value="nextjs" className="mt-2.5">
            <pre className="epure-code-well overflow-x-auto rounded-md border border-border bg-surface-1 p-3 font-mono text-xs text-ink leading-relaxed shadow-xs">
              {nextJsSnippet}
            </pre>
          </TabsContent>
          <TabsContent value="node" className="mt-2.5">
            <pre className="epure-code-well overflow-x-auto rounded-md border border-border bg-surface-1 p-3 font-mono text-xs text-ink leading-relaxed shadow-xs">
              {nodeSnippet}
            </pre>
          </TabsContent>
          <TabsContent value="browser" className="mt-2.5">
            <pre className="epure-code-well overflow-x-auto rounded-md border border-border bg-surface-1 p-3 font-mono text-xs text-ink leading-relaxed shadow-xs">
              {browserSnippet}
            </pre>
          </TabsContent>
          <TabsContent value="python" className="mt-2.5">
            <pre className="epure-code-well overflow-x-auto rounded-md border border-border bg-surface-1 p-3 font-mono text-xs text-ink leading-relaxed shadow-xs">
              {pythonSnippet}
            </pre>
          </TabsContent>
        </Tabs>

        <div className="flex items-start gap-2 rounded-md border border-healthy/20 bg-healthy/5 p-2.5 text-2xs text-ink-muted">
          <ShieldCheck className="size-4 shrink-0 text-healthy mt-0.5" />
          <span>
            Once verified in your Epure dashboard, you can remove the custom transport and simply swap{" "}
            <code className="font-mono text-ink">SENTRY_DSN</code> for a 60-second complete cutover.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
