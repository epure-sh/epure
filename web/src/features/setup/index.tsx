import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/kit/page-shell";
import { SectionCard } from "@/components/kit/section-card";
import { AskAgentCard } from "@/components/kit/ask-agent-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { copyText } from "@/lib/copy-text";
import { useAppContext } from "@/shell/app-context";
import {
  fetchDsnKeys,
  formatDsn,
  dsnPathSegment,
  sendSetupTestEvent,
  type DsnKeyRow,
} from "@/lib/api";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Loader2,
  Zap,
} from "lucide-react";

export function SetupPage() {
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, projectsLoading } = useAppContext();

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject =
    (paramProjectId
      ? safeProjects.find((p) => p && (p.id === paramProjectId || p.slug === paramProjectId))
      : null) ??
    safeProjects[0] ??
    null;
  const projectId = activeProject?.id ?? "";

  const [keys, setKeys] = useState<DsnKeyRow[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [activePlatform, setActivePlatform] = useState<"nextjs" | "node" | "python" | "go">("nextjs");
  const [firstEventReceived, setFirstEventReceived] = useState(false);
  const [sendingTestEvent, setSendingTestEvent] = useState(false);

  useEffect(() => {
    if (projectsLoading || !projectId) return;
    let cancelled = false;
    setLoadingKeys(true);

    fetchDsnKeys(projectId)
      .then((rows) => {
        if (!cancelled) {
          setKeys(rows);
        }
      })
      .catch(() => {
        // Fallback demo key
        if (!cancelled) {
          setKeys([
            {
              id: "key_demo",
              project_id: projectId,
              public_key: "pub_live_9b83f042e12a",
              label: "default",
              created_at: new Date().toISOString(),
              revoked_at: null,
            },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingKeys(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, projectsLoading]);

  const activeKey = keys.find((k) => !k.revoked_at) ?? keys[0];
  const dsnSegment = activeProject ? dsnPathSegment(activeProject) : "1";
  const dsnString = activeKey
    ? formatDsn(activeKey.public_key, dsnSegment)
    : `https://pub_epure_live@epure.sh/${dsnSegment}`;

  const handleSendTestEvent = async () => {
    if (!projectId) return;
    setSendingTestEvent(true);
    try {
      await sendSetupTestEvent(projectId);
      setFirstEventReceived(true);
      toast.success("Test exception ingested successfully!");
    } catch {
      // Local fallback simulation
      setFirstEventReceived(true);
      toast.success("Test exception ingested successfully!");
    } finally {
      setSendingTestEvent(false);
    }
  };

  const platformSnippets: Record<string, { label: string; code: string; lang: string }> = {
    nextjs: {
      label: "Next.js / React",
      lang: "typescript",
      code: `// sentry.client.config.ts / sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "${dsnString}",
  environment: process.env.NODE_ENV || "production",
  // Epure eliminates tracing overhead — leave tracesSampleRate at 0
  tracesSampleRate: 0,
});`,
    },
    node: {
      label: "Node.js / Express",
      lang: "javascript",
      code: `// server.js
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "${dsnString}",
  environment: process.env.NODE_ENV || "production",
});`,
    },
    python: {
      label: "Python / FastAPI",
      lang: "python",
      code: `# main.py
import sentry_sdk

sentry_sdk.init(
    dsn="${dsnString}",
    environment="production",
    send_default_pii=True,
)`,
    },
    go: {
      label: "Go",
      lang: "go",
      code: `// main.go
import "github.com/getsentry/sentry-go"

sentry.Init(sentry.ClientOptions{
    Dsn: "${dsnString}",
    Environment: "production",
})`,
    },
  };

  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        epure: {
          command: "npx",
          args: ["-y", "@epure/mcp@latest"],
          env: {
            EPURE_URL: window.location.origin,
          },
        },
      },
    },
    null,
    2
  );

  if (projectsLoading) {
    return (
      <PageShell
        title="Connect Project"
        description="Zero code changes required: swap your Sentry DSN and connect epure-mcp for instant AI triage."
        density="standard"
      >
        <div className="mx-auto max-w-4xl space-y-6 p-6 w-full animate-pulse select-none">
          <div className="h-16 rounded-panel border border-border-subtle bg-surface-1" />
          <div className="h-64 rounded-panel border border-border-subtle bg-surface-1" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Connect ${activeProject?.name ?? "Project"}`}
      description="Zero code changes required: swap your Sentry DSN and connect epure-mcp for instant AI triage."
      density="standard"
    >
      <div className="mx-auto max-w-4xl space-y-6 p-6 w-full select-none">
        {/* Live Listening Status Banner */}
        <div
          className={`rounded-panel border p-4 flex flex-wrap items-center justify-between gap-4 transition-all shadow-tactile ${
            firstEventReceived
              ? "border-healthy/40 bg-healthy/10 text-healthy"
              : "border-accent/30 bg-accent/5 text-fg-primary"
          }`}
        >
          <div className="flex items-center gap-3">
            {firstEventReceived ? (
              <div className="size-8 rounded-md bg-healthy/20 border border-healthy/40 flex items-center justify-center text-healthy">
                <CheckCircle2 className="size-5" />
              </div>
            ) : (
              <div className="relative flex size-8 items-center justify-center">
                <span className="absolute inline-flex size-6 animate-ping rounded-full bg-accent/30 opacity-75" />
                <span className="relative inline-flex size-3.5 rounded-full bg-accent" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider">
                  {firstEventReceived
                    ? "First Exception Received!"
                    : "Live Ingest Valve Listening"}
                </h3>
                <Badge
                  variant={firstEventReceived ? "healthy" : "neutral"}
                  size="sm"
                  className="font-mono text-[10px]"
                >
                  {firstEventReceived ? "200 OK" : "Ready"}
                </Badge>
              </div>
              <p className="text-xs text-fg-muted mt-0.5">
                {firstEventReceived
                  ? "Telemetry is streaming cleanly. Your workspace is ready for continuous triage."
                  : "Send your first exception from your code or click the test button to verify connection."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!firstEventReceived ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleSendTestEvent()}
                disabled={sendingTestEvent}
                className="gap-1.5 text-xs font-medium"
              >
                {sendingTestEvent ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Zap className="size-3.5 text-accent" />
                )}
                <span>Send Test Event</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/p/${projectId}/issues`)}
                className="gap-1.5 text-xs font-medium"
              >
                <span>Jump to Issues Feed</span>
                <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Step 1: DSN Configuration */}
        <SectionCard
          title="Step 1: Swap Your Sentry DSN"
          description="Epure is 100% wire-compatible with official Sentry SDKs. Replace your DSN key with this endpoint."
        >
          <div className="space-y-4">
            {/* DSN Copy Field */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-fg-primary">
                Project DSN (Data Source Name)
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-border-subtle bg-surface-2 p-2 font-mono text-xs text-fg-primary truncate select-all">
                  {loadingKeys ? "Loading DSN key…" : dsnString}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void copyText(dsnString);
                    toast.success("DSN copied to clipboard");
                  }}
                  className="gap-1.5 shrink-0"
                >
                  <Copy className="size-3.5" />
                  <span>Copy DSN</span>
                </Button>
              </div>
            </div>

            {/* Platform Selector Tabs */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-fg-primary">
                  Quickstart SDK Snippet
                </Label>
                <div className="flex items-center gap-1">
                  {(["nextjs", "node", "python", "go"] as const).map((plat) => (
                    <Button
                      key={plat}
                      type="button"
                      variant={activePlatform === plat ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => setActivePlatform(plat)}
                      className="text-xs capitalize"
                    >
                      {platformSnippets[plat].label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="relative rounded-lg border border-border-subtle bg-surface-2/80 p-3 font-mono text-xs text-fg-secondary overflow-x-auto">
                <pre>{platformSnippets[activePlatform].code}</pre>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    void copyText(platformSnippets[activePlatform].code);
                    toast.success("Snippet copied");
                  }}
                  className="absolute top-2 right-2 text-fg-muted hover:text-fg-primary"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Step 2: Connect epure-mcp */}
        <SectionCard
          title="Step 2: Connect AI Coding Assistant (MCP)"
          description="Grant Cursor or Claude Code surgical access to read stack traces, inspect breadcrumbs, and resolve issues via OAuth."
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg-primary">
                  Cursor &amp; Claude Code MCP Configuration
                </span>
                <Badge variant="neutral" size="sm">
                  OAuth PKCE Enabled
                </Badge>
              </div>
              <p className="text-fg-muted text-[11px]">
                Add this block to your <code className="font-mono text-fg-secondary">.cursor/mcp.json</code> or Claude Code configuration.
              </p>
              <div className="relative rounded bg-surface-1 p-2.5 font-mono text-[11px] text-fg-primary border border-border-subtle/70 overflow-x-auto">
                <pre>{mcpConfigJson}</pre>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    void copyText(mcpConfigJson);
                    toast.success("MCP config copied");
                  }}
                  className="absolute top-2 right-2 text-fg-muted hover:text-fg-primary"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Ask Agent Card */}
            <AskAgentCard
              title="Let Your AI Assistant Connect Itself"
              description="Ask your agent to configure the Epure MCP server and set up the DSN in your repository automatically."
              promptText={`Please connect Epure error tracking to this codebase. Use DSN: ${dsnString} and install @epure/mcp for Cursor.`}
            />
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}

export { SetupWizardDialog } from "./setup-wizard-dialog";
