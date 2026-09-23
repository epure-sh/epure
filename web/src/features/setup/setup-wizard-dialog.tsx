import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildSetupAiPrompt } from "../../lib/setup-ai-prompt";
import {
  createDsnKey,
  createProject,
  fetchSetupDsn,
  formatDsn,
  patchSetupProgress,
} from "../../lib/api";
import { projectPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import {
  setupPlatformById,
  setupPlatformSnippets,
  type SetupPlatformId,
} from "../../lib/setup-platform-snippets";
import { useAppContext } from "../../shell/app-context";
import { ApplyWithAiButton } from "../../ui/apply-with-ai-button";
import { Button } from "../../ui/button";
import { CopyButton } from "../../ui/copy-button";
import { CopyDsnBlock } from "../../ui/copy-dsn-block";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { useToast } from "../../ui/toast-provider";

type WizardStep = "name" | "language" | "connect" | "done";

export interface SetupWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill / create with this name. Empty → name step first. */
  initialName?: string;
  /** Existing project to finish setup for. */
  projectId?: string | null;
}

const CARD_SHELL =
  "flex h-[min(34rem,90vh)] w-[min(28rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0";

export function SetupWizardDialog({
  open,
  onOpenChange,
  initialName = "",
  projectId = null,
}: SetupWizardDialogProps) {
  const navigate = useNavigate();
  const { refreshProjects, setProjectId } = useAppContext();
  const { toast } = useToast();

  const [step, setStep] = useState<WizardStep>("language");
  const [projectName, setProjectName] = useState(initialName);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(projectId);
  const [platformId, setPlatformId] = useState<SetupPlatformId | null>(null);
  const [dsnPublicKey, setDsnPublicKey] = useState<string | null>(null);
  const [dsnError, setDsnError] = useState<string | null>(null);
  const [readyToContinue, setReadyToContinue] = useState(false);
  const [busy, setBusy] = useState(false);

  const resetLocal = useCallback(
    (name: string, id: string | null) => {
      const needsName = !id && !name.trim();
      setStep(needsName ? "name" : "language");
      setProjectName(name);
      setActiveProjectId(id);
      setPlatformId(null);
      setDsnPublicKey(null);
      setDsnError(null);
      setReadyToContinue(false);
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

  const aiPrompt = useMemo(
    () =>
      dsn
        ? buildSetupAiPrompt({
            dsn,
            path: "fresh",
            phase: "connect",
            projectName: projectName.trim() || undefined,
          })
        : "",
    [dsn, projectName],
  );

  const markReady = useCallback(async () => {
    setReadyToContinue(true);
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
      setStep("language");
    }
  }, [ensureProject, projectName, toast]);

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

  const handleFinish = useCallback(() => {
    if (!activeProjectId || !readyToContinue) {
      return;
    }
    setStep("done");
  }, [activeProjectId, readyToContinue]);

  const handleOpenIssues = useCallback(() => {
    if (!activeProjectId) {
      return;
    }
    onOpenChange(false);
    navigate(projectPath(activeProjectId, "issues"), { replace: true });
  }, [activeProjectId, navigate, onOpenChange]);

  const handleBack = useCallback(() => {
    if (step === "connect") {
      setStep("language");
      setReadyToContinue(false);
      return;
    }
    if (step === "language" && !projectId && !initialName.trim()) {
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
        id: "language",
        label: "Stack",
        complete: step === "connect" || step === "done",
        active: step === "language",
      },
      {
        id: "connect",
        label: "Connect",
        complete: step === "done" || readyToContinue,
        active: step === "connect",
      },
    );
    return items;
  }, [initialName, projectId, readyToContinue, step]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={CARD_SHELL} aria-describedby={undefined}>
        <DialogHeader className="shrink-0 space-y-3 border-b border-border px-4 py-3 pr-10">
          <DialogTitle className="text-base font-medium tracking-ui">
            {step === "done" ? "Connected" : "New project"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a project and connect your app with a DSN.
          </DialogDescription>
          {step !== "done" ? <StepIndicator steps={stepItems} variant="bar" /> : null}
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
          {step === "name" ? (
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
              <div className="space-y-3">
                <p className="text-sm font-medium tracking-ui text-ink">Project name</p>
                <p className="text-xs text-ink-muted">
                  One app or service. You can rename later.
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
              <div className="flex justify-end border-t border-border pt-3">
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

          {step === "language" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium tracking-ui text-ink">Choose your stack</p>
                <p className="text-xs text-ink-muted">We’ll show the exact files to edit.</p>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="grid grid-cols-3 gap-2">
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleLanguageSelect(platform.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-2 py-3 text-center transition-colors",
                        "hover:border-border-strong hover:bg-state-hover focus-ring",
                        platformId === platform.id && "border-accent bg-accent-muted",
                      )}
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-subtle"
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
              {(!projectId && !initialName.trim()) || step === "language" ? (
                <div className="flex justify-start border-t border-border pt-3">
                  {!projectId && !initialName.trim() ? (
                    <Button type="button" variant="ghost" onClick={handleBack}>
                      Back
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "connect" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
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
                  <div className="space-y-2 shrink-0">
                    <p className="text-sm font-medium tracking-ui text-ink">Your DSN</p>
                    <CopyDsnBlock
                      dsn={dsn}
                      compact
                      hint={null}
                      onCopied={() => void markReady()}
                      onCopyFailed={() =>
                        toast("Clipboard blocked — select the DSN and copy manually")
                      }
                    />
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                    <p className="shrink-0 text-xs text-ink-muted">
                      {selectedPlatform.label} — copy each file diff
                    </p>
                    <Tabs defaultValue={selectedPlatform.files[0]?.filename} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <TabsList className="h-auto w-full shrink-0 flex-wrap justify-start gap-0">
                        {selectedPlatform.files.map((file) => (
                          <TabsTrigger
                            key={file.filename}
                            value={file.filename}
                            className="px-2.5 py-1.5 text-xs"
                          >
                            {file.filename}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {selectedPlatform.files.map((file) => (
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
                              onCopied={() => void markReady()}
                            />
                          </div>
                          <pre className="epure-code-well min-h-0 flex-1 overflow-auto rounded-md border border-border bg-bg-subtle p-2.5 font-mono text-xs text-ink">
                            {file.code}
                          </pre>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3">
                    <Button type="button" variant="ghost" onClick={handleBack}>
                      Back
                    </Button>
                    <div className="flex items-center gap-2">
                      <ApplyWithAiButton
                        prompt={aiPrompt}
                        size="toolbar"
                        onCopied={() => {
                          void markReady();
                          toast("Copied — paste into Cursor or your AI assistant");
                        }}
                        onCopyFailed={() =>
                          toast("Clipboard blocked — try Copy on a file tab")
                        }
                      />
                      <Button
                        type="button"
                        variant={readyToContinue ? "primary" : "secondary"}
                        disabled={!readyToContinue}
                        onClick={handleFinish}
                      >
                        {readyToContinue ? "Continue" : "Copy to continue"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {step === "done" ? (
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
              <div className="space-y-2 pt-6">
                <p className="text-sm font-medium tracking-ui text-ink">You’re set</p>
                <p className="text-xs text-ink-muted">
                  Throw once in your app — the issue will show up here.
                </p>
              </div>
              <div className="flex justify-end border-t border-border pt-3">
                <Button type="button" variant="primary" onClick={handleOpenIssues}>
                  Open issues
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
