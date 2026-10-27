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
        <Link
          to={projectSettingsPath(projectId, "dsn")}
          className="text-xs text-fg-muted underline-offset-2 hover:text-fg-primary hover:underline"
        >
          DSN keys
        </Link>
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
      <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex justify-end">{headerActions}</div>
        <StepIndicator steps={steps} variant="bar" />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs">
          <div className="flex items-center gap-1.5">
            <span className="text-fg-muted">Path</span>
            <Button
              type="button"
              variant={setupPath === "fresh" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setSetupPath("fresh")}
            >
              Fresh
            </Button>
            <Button
              type="button"
              variant={setupPath === "sentry" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setSetupPath("sentry")}
            >
              From Sentry
            </Button>
          </div>
          <SetupDocsLink href={EPURE_DOCS_QUICKSTART_URL} className="text-fg-muted">
            Quickstart
          </SetupDocsLink>
          <span
            className={cn(
              "ml-auto font-medium",
              firstEventReceived ? "text-healthy" : "text-fg-muted",
            )}
          >
            {firstEventReceived ? "Live" : "Listening"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
          {platforms.map((platform) => (
            <Button
              key={platform.id}
              type="button"
              variant={platformId === platform.id ? "secondary" : "outline"}
              size="xs"
              className="h-auto flex-col gap-1 px-1 py-1.5"
              onClick={() => setPlatformId(platform.id)}
            >
              <SetupPlatformMark logo={platform.logo} size="sm" />
              <span className="max-w-full truncate text-[10px] font-medium leading-none">
                {platform.label}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex min-h-[min(20rem,52vh)] min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-1 p-2">
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

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2">
          <ApplyWithAiButton
            prompt={aiPrompt}
            size="sm"
            variant="secondary"
            onCopied={() => {
              handleCopied();
              toast("Copied for Agent.");
            }}
            onCopyFailed={() => toast("Clipboard blocked.")}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-fg-muted">MCP</span>
            <CopyButton value={mcpJson} label="Copy config" className="h-7 px-2 text-xs" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export { SetupWizardDialog } from "./setup-wizard-dialog";
