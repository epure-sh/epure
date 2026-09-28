import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildSetupAiPrompt, type SetupPath } from "../../lib/setup-ai-prompt";
import {
  createDsnKey,
  createProject,
  fetchSetupDsn,
  fetchSetupProgress,
  formatDsn,
  patchSetupProgress,
  sendSetupTestEvent,
  setupOnboardingDone,
} from "../../lib/api";
import { projectPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import {
  EPURE_DOCS_MIGRATION_URL,
  EPURE_DOCS_QUICKSTART_URL,
  EPURE_DOCS_URL,
} from "../../lib/docs-url";
import {
  setupPlatformById,
  setupPlatformSnippets,
  type SetupPlatformId,
} from "../../lib/setup-platform-snippets";
import { useAppContext } from "../../shell/app-context";
import { ApplyWithAiButton } from "../../ui/apply-with-ai-button";
import { SetupPlatformMark } from "../../ui/setup-platform-mark";
import { Button } from "../../ui/button";
import { SetupConnectPanel } from "../../ui/setup-connect-panel";
import { SetupDocsLink } from "../../ui/setup-docs-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { StepIndicator } from "../../ui/step-indicator";
import { useToast } from "../../ui/toast-provider";

type WizardStep = "name" | "path" | "language" | "connect" | "verify";

export interface SetupWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill / create with this name. Empty → name step first. */
  initialName?: string;
  /** Existing project to finish setup for. */
  projectId?: string | null;
}

const CARD_BASE =
  "flex w-[min(30rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0";

const PATH_OPTIONS: {
  id: SetupPath;
  title: string;
  description: string;
}[] = [
  {
    id: "fresh",
    title: "New integration",
    description: "Install the Sentry SDK and point it at Epure.",
  },
  {
    id: "sentry",
    title: "Already on Sentry",
    description: "Keep your SDK. Swap the DSN and disable tracing/replay.",
  },
];

export function SetupWizardDialog({
  open,
  onOpenChange,
  initialName = "",
  projectId = null,
}: SetupWizardDialogProps) {
  const navigate = useNavigate();
  const { refreshProjects, setProjectId } = useAppContext();
  const { toast } = useToast();

  const [step, setStep] = useState<WizardStep>("path");
  const [projectName, setProjectName] = useState(initialName);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(projectId);
  const [setupPath, setSetupPath] = useState<SetupPath | null>(null);
  const [platformId, setPlatformId] = useState<SetupPlatformId | null>(null);
  const [verifyListening, setVerifyListening] = useState(false);
  const [verifyIssueSeen, setVerifyIssueSeen] = useState(false);
  const [dsnPublicKey, setDsnPublicKey] = useState<string | null>(null);
  const [dsnError, setDsnError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetLocal = useCallback(
    (name: string, id: string | null) => {
      const needsName = !id && !name.trim();
      setStep(needsName ? "name" : "path");
      setProjectName(name);
      setActiveProjectId(id);
      setSetupPath(null);
      setPlatformId(null);
      setDsnPublicKey(null);
      setDsnError(null);
      setVerifyListening(false);
      setVerifyIssueSeen(false);
      setBusy(false);
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    resetLocal(initialName, projectId);
  }, [open, initialName, projectId, resetLocal]);

  const ensureProject = useCallback(async (): Promise<string | null> => {
    if (activeProjectId) {
      return activeProjectId;
    }
    const name = projectName.trim();
    if (!name) {
      toast("Enter a project name");
      setStep("name");
      return null;
    }
    setBusy(true);
    try {
      const project = await createProject(name);
      setActiveProjectId(project.id);
      setProjectId(project.id);
      await refreshProjects();
      void patchSetupProgress({
        project_id: project.id,
        project_named: true,
      }).catch(() => undefined);
      return project.id;
    } catch {
      toast("Failed to create project");
      return null;
    } finally {
      setBusy(false);
    }
  }, [
    activeProjectId,
    projectName,
    refreshProjects,
    setProjectId,
    toast,
  ]);

  const loadOrCreateDsn = useCallback(
    async (id: string) => {
      setDsnError(null);
      setBusy(true);
      try {
        const info = await fetchSetupDsn(id);
        if (info.public_key) {
          setDsnPublicKey(info.public_key);
          return;
        }
        const key = await createDsnKey(id, "default");
        setDsnPublicKey(key.public_key);
      } catch {
        setDsnError("Could not create a DSN key.");
        setDsnPublicKey(null);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || step !== "connect" || !activeProjectId || dsnPublicKey || dsnError) {
      return;
    }
    void loadOrCreateDsn(activeProjectId);
  }, [activeProjectId, dsnError, dsnPublicKey, loadOrCreateDsn, open, step]);

  const platforms = useMemo(
    () => setupPlatformSnippets(dsnPublicKey && activeProjectId ? formatDsn(dsnPublicKey, activeProjectId) : "YOUR_DSN"),
    [activeProjectId, dsnPublicKey],
  );

  const dsn =
    dsnPublicKey && activeProjectId
      ? formatDsn(dsnPublicKey, activeProjectId)
      : "";

  const selectedPlatform = platformId && dsn ? setupPlatformById(dsn, platformId) : null;

  const resolvedPath = setupPath ?? "fresh";

  const aiPromptConnect = useMemo(
    () =>
      dsn
        ? buildSetupAiPrompt({
            dsn,
            path: resolvedPath,
            phase: "connect",
            projectName: projectName.trim() || undefined,
            platformId: platformId ?? undefined,
            platformLabel: selectedPlatform?.label,
            packageName: selectedPlatform?.packageName,
            installCommand: selectedPlatform?.installCommand,
          })
        : "",
    [
      dsn,
      platformId,
      projectName,
      resolvedPath,
      selectedPlatform?.installCommand,
      selectedPlatform?.label,
      selectedPlatform?.packageName,
    ],
  );

  useEffect(() => {
    if (!open || step !== "verify" || !activeProjectId || verifyIssueSeen) {
      return;
    }
    setVerifyListening(true);
    let cancelled = false;
    const tick = () => {
      void fetchSetupProgress(activeProjectId)
        .then((progress) => {
          if (cancelled) {
            return;
          }
          if (setupOnboardingDone(progress)) {
            setVerifyIssueSeen(true);
            setVerifyListening(false);
          }
        })
        .catch(() => undefined);
    };
    tick();
    const intervalId = window.setInterval(tick, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      setVerifyListening(false);
    };
  }, [activeProjectId, open, step, verifyIssueSeen]);

  const markReady = useCallback(async () => {
    if (!activeProjectId) {
      return;
    }
    try {
      await patchSetupProgress({
        project_id: activeProjectId,
        dsn_copied: true,
      });
    } catch {
      /* still allow continue */
    }
  }, [activeProjectId]);

  const handleNameContinue = useCallback(async () => {
    if (!projectName.trim()) {
      toast("Enter a project name");
      return;
    }
    const id = await ensureProject();
    if (id) {
      setStep("path");
    }
  }, [ensureProject, projectName, toast]);

  const handlePathSelect = useCallback(
    async (path: SetupPath) => {
      setSetupPath(path);
      const projectIdResolved = await ensureProject();
      if (projectIdResolved) {
        setStep("language");
      }
    },
    [ensureProject],
  );

  const handleLanguageSelect = useCallback(
    async (id: SetupPlatformId) => {
      setPlatformId(id);
      const projectIdResolved = await ensureProject();
      if (!projectIdResolved) {
        return;
      }
      setStep("connect");
    },
    [ensureProject],
  );

  const handleConnectContinue = useCallback(() => {
    if (!activeProjectId || !dsn) {
      return;
    }
    setStep("verify");
  }, [activeProjectId, dsn]);

  const handleSendTestEvent = useCallback(async () => {
    if (!activeProjectId) {
      return;
    }
    setBusy(true);
    try {
      await sendSetupTestEvent(activeProjectId);
      const progress = await fetchSetupProgress(activeProjectId);
      if (setupOnboardingDone(progress)) {
        setVerifyIssueSeen(true);
        toast("Test event accepted. Open Issues to see it.");
      } else {
        toast("Test event sent. Waiting for Issues.");
      }
    } catch {
      toast("Could not send test event");
    } finally {
      setBusy(false);
    }
  }, [activeProjectId, toast]);

  const handleOpenIssues = useCallback(() => {
    if (!activeProjectId) {
      return;
    }
    onOpenChange(false);
    navigate(projectPath(activeProjectId, "issues"), { replace: true });
  }, [activeProjectId, navigate, onOpenChange]);

  const handleBack = useCallback(() => {
    if (step === "verify") {
      setStep("connect");
      return;
    }
    if (step === "connect") {
      setStep("language");
      return;
    }
    if (step === "language") {
      setStep("path");
      return;
    }
    if (step === "path" && !projectId && !initialName.trim()) {
      setStep("name");
    }
  }, [initialName, projectId, step]);

  const stepItems = useMemo(() => {
    const showName = !projectId && !initialName.trim();
    const items = [];
    if (showName || step === "name") {
      items.push({
        id: "name",
        label: "Name",
        complete: step !== "name",
        active: step === "name",
      });
    }
    items.push(
      {
        id: "path",
        label: "Start",
        complete: step !== "name" && step !== "path",
        active: step === "path",
      },
      {
        id: "language",
        label: "Stack",
        complete: step === "connect" || step === "verify",
        active: step === "language",
      },
      {
        id: "connect",
        label: "Connect",
        complete: step === "verify" || Boolean(dsn),
        active: step === "connect",
      },
      {
        id: "verify",
        label: "Verify",
        complete: verifyIssueSeen,
        active: step === "verify",
      },
    );
    return items;
  }, [dsn, initialName, projectId, step, verifyIssueSeen]);

  const dialogSizeClass =
    step === "connect"
      ? "max-h-[min(34rem,90vh)]"
      : step === "language"
        ? "max-h-[min(28rem,90vh)]"
        : "h-auto max-h-[90vh]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(CARD_BASE, dialogSizeClass)}
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b border-border px-3 py-2.5 pr-10">
          <DialogTitle className="flex items-center gap-2 text-base font-medium tracking-ui">
            {step === "connect" && selectedPlatform ? (
              <>
                <SetupPlatformMark logo={selectedPlatform.logo} size="sm" />
                <span>Connect {selectedPlatform.label}</span>
              </>
            ) : step === "verify" ? (
              "Almost there"
            ) : (
              "Set up error tracking"
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a project and connect your app with a DSN.
          </DialogDescription>
          <StepIndicator steps={stepItems} variant="bar" />
        </DialogHeader>

        <div
          className={cn(
            "flex flex-col overflow-hidden px-3 py-3",
            (step === "connect" || step === "language") && "min-h-0 flex-1",
          )}
        >
          {step === "name" ? (
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium tracking-ui text-ink">Project name</p>
                <p className="text-xs text-ink-muted">
                  One app or service. You can rename later.
                </p>
                <p className="text-2xs text-ink-muted">
                  <SetupDocsLink href={EPURE_DOCS_QUICKSTART_URL}>Setup guide</SetupDocsLink>
                </p>
                <Field label="Name">
                  <Input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Checkout Web"
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleNameContinue();
                      }
                    }}
                  />
                </Field>
              </div>
              <div className="flex justify-end border-t border-border pt-2">
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void handleNameContinue()}
                >
                  {busy ? "Creating…" : "Continue"}
                </Button>
              </div>
            </div>
          ) : null}

          {step === "path" ? (
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium tracking-ui text-ink">How are you starting?</p>
                  <p className="text-xs text-ink-muted">
                    Snippets on the next steps.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  {PATH_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePathSelect(option.id)}
                      className={cn(
                        "rounded-lg border border-border bg-surface px-2.5 py-2 text-left transition-colors",
                        "hover:border-border-strong hover:bg-state-hover focus-ring",
                        setupPath === option.id && "border-accent bg-accent-muted",
                      )}
                    >
                      <p className="text-sm font-medium tracking-ui text-ink">{option.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">{option.description}</p>
                    </button>
                  ))}
                </div>
                <p className="text-2xs text-ink-muted">
                  Not sure?{" "}
                  <SetupDocsLink href={EPURE_DOCS_QUICKSTART_URL}>Quickstart</SetupDocsLink>
                  {" · "}
                  <SetupDocsLink href={EPURE_DOCS_MIGRATION_URL}>From Sentry</SetupDocsLink>
                </p>
              </div>
              <div className="flex justify-start border-t border-border pt-2">
                {!projectId && !initialName.trim() ? (
                  <Button type="button" variant="ghost" onClick={handleBack}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            </div>
          ) : null}

          {step === "language" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex shrink-0 items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium tracking-ui text-ink">Choose your stack</p>
                  <p className="text-xs text-ink-muted">Tap one. We show install and init next.</p>
                </div>
                <SetupDocsLink href={`${EPURE_DOCS_URL}/platforms`} className="shrink-0 pt-0.5">
                  All platforms
                </SetupDocsLink>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="grid grid-cols-3 gap-1.5">
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleLanguageSelect(platform.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-1.5 py-2 text-center transition-colors",
                        "hover:border-border-strong hover:bg-state-hover focus-ring",
                        platformId === platform.id && "border-accent bg-accent-muted",
                      )}
                    >
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-subtle"
                        aria-hidden
                      >
                        <img
                          src={`/frameworks/${platform.logo}.svg`}
                          alt=""
                          className="h-5 w-5 object-contain"
                        />
                      </span>
                      <span className="text-xs font-medium tracking-ui text-ink">
                        {platform.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 justify-start border-t border-border pt-2">
                <Button type="button" variant="ghost" onClick={handleBack}>
                  Back
                </Button>
              </div>
            </div>
          ) : null}

          {step === "connect" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {dsnError ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-semantic-danger">{dsnError}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || !activeProjectId}
                    onClick={() => activeProjectId && void loadOrCreateDsn(activeProjectId)}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}

              {!dsn && !dsnError ? (
                <p className="text-sm text-ink-muted">Preparing DSN…</p>
              ) : null}

              {dsn && selectedPlatform ? (
                <>
                  <SetupConnectPanel
                    dsn={dsn}
                    platform={selectedPlatform}
                    setupPath={resolvedPath}
                    onCopied={() => void markReady()}
                    onCopyFailed={() =>
                      toast("Clipboard blocked. Select text and copy manually.")
                    }
                  />
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-2">
                    <Button type="button" variant="ghost" onClick={handleBack}>
                      Back
                    </Button>
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                      <ApplyWithAiButton
                        prompt={aiPromptConnect}
                        prominence="main"
                        onCopied={() => {
                          void markReady();
                          toast("Copied. Paste into Agent chat.");
                        }}
                        onCopyFailed={() =>
                          toast("Clipboard blocked. Copy a tab instead.")
                        }
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        disabled={!dsn || busy}
                        onClick={handleConnectContinue}
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {step === "verify" ? (
            <div className="flex flex-col gap-5">
              <div className="space-y-1.5 py-2 text-center">
                <p className="text-xl font-medium tracking-ui text-ink">You&apos;re wired.</p>
                <p className="text-sm text-ink-muted">
                  Break something on purpose, or wait for the next one. We&apos;re listening.
                </p>
                {verifyIssueSeen ? (
                  <p className="pt-1 text-sm font-medium text-accent">Got it. You&apos;re live.</p>
                ) : verifyListening ? (
                  <p className="pt-1 text-xs text-ink-muted">Listening…</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                <Button type="button" variant="ghost" onClick={handleBack}>
                  Back
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || !activeProjectId}
                    onClick={() => void handleSendTestEvent()}
                  >
                    Send test event
                  </Button>
                  <Button type="button" variant="primary" onClick={handleOpenIssues}>
                    Open issues
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
