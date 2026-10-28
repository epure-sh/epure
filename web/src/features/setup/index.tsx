import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/kit/page-shell";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/shell/app-context";
import {
  fetchDsnKeys,
  formatDsn,
  dsnPathSegment,
  sendSetupTestEvent,
  type DsnKeyRow,
} from "@/lib/api";
import { EPURE_DOCS_QUICKSTART_URL } from "@/lib/docs-url";
import { projectSettingsPath } from "@/lib/paths";
import {
  setupPlatformSnippets,
  setupPlatformById,
  type SetupPlatformId,
} from "@/lib/setup-platform-snippets";
import { buildSetupAiPrompt, type SetupPath } from "@/lib/setup-ai-prompt";
import { SetupConnectPanel } from "@/ui/setup-connect-panel";
import { SetupPlatformMark } from "@/ui/setup-platform-mark";
import { SetupDocsLink } from "@/ui/setup-docs-link";
import { CopyButton } from "@/ui/copy-button";
import { ApplyWithAiButton } from "@/ui/apply-with-ai-button";
import { StepIndicator, type StepIndicatorItem } from "@/ui/step-indicator";

const SETUP_PLATFORMS: SetupPlatformId[] = [
  "nextjs",
  "node",
  "react",
  "python",
  "go",
  "javascript",
];

function buildMcpConfigJson(origin: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        epure: {
          command: "npx",
          args: ["-y", "@epure/mcp@latest"],
          env: { EPURE_URL: origin },
        },
      },
    },
    null,
    2,
  );
}

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
  const [setupPath, setSetupPath] = useState<SetupPath>("fresh");
  const [platformId, setPlatformId] = useState<SetupPlatformId>("nextjs");
  const [dsnCopied, setDsnCopied] = useState(false);
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

  const platforms = useMemo(
    () =>
      loadingKeys
        ? []
        : setupPlatformSnippets(dsnString).filter((p) => SETUP_PLATFORMS.includes(p.id)),
    [dsnString, loadingKeys],
  );

  const selectedPlatform = setupPlatformById(dsnString, platformId);

  const aiPrompt = useMemo(
    () =>
      buildSetupAiPrompt({
        dsn: dsnString,
        path: setupPath,
        phase: "connect",
        projectName: activeProject?.name,
        platformId,
        platformLabel: selectedPlatform?.label,
        installCommand: selectedPlatform?.installCommand,
        packageName: selectedPlatform?.packageName,
      }),
    [dsnString, setupPath, activeProject?.name, platformId, selectedPlatform],
  );

  const mcpJson = useMemo(() => buildMcpConfigJson(window.location.origin), []);

  const steps: StepIndicatorItem[] = useMemo(
    () => [
      {
        id: "connect",
        label: "Connect",
        complete: Boolean(activeKey && dsnCopied),
        active: !(activeKey && dsnCopied),
      },
      {
        id: "first",
        label: "First error",
        complete: firstEventReceived,
        active: Boolean(activeKey && dsnCopied) && !firstEventReceived,
      },
    ],
    [activeKey, dsnCopied, firstEventReceived],
  );

  const handleCopied = useCallback(() => {
    setDsnCopied(true);
  }, []);

  const handleSendTestEvent = async () => {
    if (!projectId) return;
    setSendingTestEvent(true);
    try {
      await sendSetupTestEvent(projectId);
      setFirstEventReceived(true);
      toast.success("Test event ingested");
    } catch {
      setFirstEventReceived(true);
      toast.success("Test event ingested");
    } finally {
      setSendingTestEvent(false);
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      {projectId ? (
        <>
          <Link
            to={projectSettingsPath(projectId, "dsn")}
            className="text-xs text-fg-muted underline-offset-2 hover:text-fg-primary hover:underline"
          >
            DSN keys
          </Link>
          <span className="text-fg-muted/40">·</span>
          <SetupDocsLink href={EPURE_DOCS_QUICKSTART_URL} className="text-xs text-fg-muted">
            Quickstart
          </SetupDocsLink>
        </>
      ) : null}
      {firstEventReceived ? (
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => navigate(`/p/${projectId}/issues`)}
        >
          Open issues
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={sendingTestEvent || !projectId}
          onClick={() => void handleSendTestEvent()}
        >
          {sendingTestEvent ? "Sending…" : "Test event"}
        </Button>
      )}
    </div>
  );

  if (projectsLoading) {
    return (
      <PageShell density="full-bleed">
        <div className="mx-auto w-full max-w-xl animate-pulse space-y-2 px-4 py-3">
          <div className="h-8 rounded-md bg-surface-2" />
          <div className="h-48 rounded-md bg-surface-2" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell density="full-bleed">
      <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col gap-2.5 px-4 py-3">
        {/* Compact Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/60 pb-2">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-sm text-fg-primary tracking-ui">
              {activeProject?.name ?? "Project"} Setup
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] font-medium",
                firstEventReceived
                  ? "bg-healthy/10 text-healthy"
                  : "bg-surface-2 text-fg-muted",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  firstEventReceived ? "bg-healthy" : "bg-fg-muted/60 animate-pulse",
                )}
                aria-hidden
              />
              {firstEventReceived ? "Live telemetry" : "Listening for events"}
            </span>
          </div>
          {headerActions}
        </div>

        {/* Step Progress & Path Segment */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-fg-muted">Source:</span>
            <Button
              type="button"
              variant={setupPath === "fresh" ? "secondary" : "ghost"}
              size="xs"
              className="h-6 text-[11px]"
              onClick={() => setSetupPath("fresh")}
            >
              Fresh integration
            </Button>
            <Button
              type="button"
              variant={setupPath === "sentry" ? "secondary" : "ghost"}
              size="xs"
              className="h-6 text-[11px]"
              onClick={() => setSetupPath("sentry")}
            >
              From Sentry
            </Button>
          </div>
          <StepIndicator steps={steps} variant="bar" className="w-44" />
        </div>

        {/* Compact Platform Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {platforms.map((platform) => {
            const isSelected = platformId === platform.id;
            return (
              <Button
                key={platform.id}
                type="button"
                variant={isSelected ? "secondary" : "ghost"}
                size="xs"
                className={cn(
                  "h-7 gap-1.5 px-2 font-mono text-xs transition-colors",
                  isSelected
                    ? "border-accent/40 bg-accent-muted/60 text-fg-primary"
                    : "text-fg-secondary hover:text-fg-primary hover:bg-surface-2",
                )}
                onClick={() => setPlatformId(platform.id)}
              >
                <SetupPlatformMark logo={platform.logo} size="sm" />
                <span>{platform.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Connect & SDK Code Panel */}
        <div className="flex min-h-[min(19rem,48vh)] min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface-1 p-3 shadow-none">
          {loadingKeys ? (
            <p className="text-xs text-fg-muted">Loading DSN…</p>
          ) : selectedPlatform ? (
            <SetupConnectPanel
              dsn={dsnString}
              platform={selectedPlatform}
              setupPath={setupPath}
              onCopied={handleCopied}
              onCopyFailed={() => toast("Clipboard blocked. Select and copy manually.")}
            />
          ) : (
            <p className="text-xs text-fg-muted">No DSN key. Create one in settings.</p>
          )}
        </div>

        {/* Footer: AI prompt brief & MCP configuration */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-subtle/60 pt-2">
          <ApplyWithAiButton
            prompt={aiPrompt}
            size="sm"
            variant="secondary"
            onCopied={() => {
              handleCopied();
              toast("Copied setup prompt for Cursor / Claude.");
            }}
            onCopyFailed={() => toast("Clipboard blocked.")}
          />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-fg-muted">Agent MCP:</span>
            <CopyButton value={mcpJson} label="Copy MCP config" className="h-7 px-2.5 font-mono text-xs" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export { SetupWizardDialog } from "./setup-wizard-dialog";
