import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectPath } from "../../lib/paths";
import {
  createDsnKey,
  createProject,
  fetchSetupDsn,
  fetchSetupProgress,
  formatDsn,
  patchSetupProgress,
} from "../../lib/api";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { CopyDsnBlock } from "../../ui/copy-dsn-block";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { PageChrome } from "../../ui/page-chrome";
import { SetupConnectGuide } from "../../ui/setup-connect-guide";
import { StepIndicator } from "../../ui/step-indicator";
import { useToast } from "../../ui/toast-provider";

type SetupStep = "project" | "dsn";

export function SetupPage() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { projects, refreshProjects, projectId, setProjectId } = useAppContext();
  const [step, setStep] = useState<SetupStep>("project");
  const [projectName, setProjectName] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    routeProjectId ?? projectId,
  );
  const [dsnPublicKey, setDsnPublicKey] = useState<string | null>(null);
  const [dsnCopied, setDsnCopied] = useState(false);
  const [dsnError, setDsnError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const existingProject = useMemo(
    () => projects.find((row) => row.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  );

  useEffect(() => {
    if (routeProjectId) {
      setActiveProjectId(routeProjectId);
      setProjectId(routeProjectId);
    }
  }, [routeProjectId, setProjectId]);

  useEffect(() => {
    if (existingProject && !projectName) {
      setProjectName(existingProject.name);
    }
  }, [existingProject, projectName]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }
    void fetchSetupProgress(activeProjectId)
      .then((progress) => {
        if (progress.complete) {
          navigate(projectPath(activeProjectId, "issues"), { replace: true });
          return;
        }
        if (progress.dsn_copied_at) {
          navigate(projectPath(activeProjectId, "issues"), { replace: true });
          return;
        }
        if (progress.project_named) {
          setStep("dsn");
        }
      })
      .catch(() => {
        // fresh user — stay on setup
      });
  }, [activeProjectId, navigate]);

  useEffect(() => {
    if (!activeProjectId || step !== "project" || busy) {
      return;
    }
    if (!existingProject && !routeProjectId) {
      return;
    }
    let cancelled = false;
    setBusy(true);
    void patchSetupProgress({
      project_id: activeProjectId,
      project_named: true,
    })
      .then(() => {
        if (!cancelled) {
          setStep("dsn");
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast("Failed to save setup progress");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, busy, existingProject, routeProjectId, step, toast]);

  const loadOrCreateDsn = useCallback(async () => {
    if (!activeProjectId) {
      return;
    }
    setDsnError(null);
    setBusy(true);
    try {
      const info = await fetchSetupDsn(activeProjectId);
      if (info.public_key) {
        setDsnPublicKey(info.public_key);
        return;
      }
      const key = await createDsnKey(activeProjectId, "default");
      setDsnPublicKey(key.public_key);
    } catch {
      setDsnError("Could not create a DSN key.");
      setDsnPublicKey(null);
    } finally {
      setBusy(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (step === "dsn" && activeProjectId && !dsnPublicKey && !dsnError) {
      void loadOrCreateDsn();
    }
  }, [activeProjectId, dsnError, dsnPublicKey, loadOrCreateDsn, step]);

  const handleCreateProject = useCallback(async () => {
    const name = projectName.trim();
    if (!name) {
      toast("Enter a project name");
      return;
    }
    setBusy(true);
    try {
      const project = await createProject(name);
      setActiveProjectId(project.id);
      setProjectId(project.id);
      await refreshProjects();
      await patchSetupProgress({ project_id: project.id, project_named: true });
      setStep("dsn");
    } catch {
      toast("Failed to create project");
    } finally {
      setBusy(false);
    }
  }, [projectName, refreshProjects, setProjectId, toast]);

  const handleDsnCopied = useCallback(async () => {
    if (!activeProjectId || !dsnPublicKey || dsnCopied) {
      return;
    }
    setDsnCopied(true);
    try {
      await patchSetupProgress({
        project_id: activeProjectId,
        dsn_copied: true,
      });
      navigate(projectPath(activeProjectId, "issues"), { replace: true });
    } catch {
      toast("Copy the DSN before continuing.");
      setDsnCopied(false);
    }
  }, [activeProjectId, dsnCopied, dsnPublicKey, navigate, toast]);

  const dsn =
    dsnPublicKey && activeProjectId
      ? formatDsn(dsnPublicKey, activeProjectId)
      : "";

  const steps = [
    {
      id: "project",
      label: "Project",
      complete: step === "dsn",
      active: step === "project",
    },
    {
      id: "dsn",
      label: "Connect",
      complete: dsnCopied,
      active: step === "dsn",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome title="Get started" context={<StepIndicator steps={steps} />} />

      <div className="flex flex-1 min-h-0 items-center justify-center bg-bg p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 p-4">
            {step === "project" ? (
              existingProject || routeProjectId ? (
                <p className="text-sm text-ink-muted">Opening connect…</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-ink">Name your project</p>
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleCreateProject();
                    }}
                  >
                    <Field label="Project name" className="min-w-[12rem] flex-1">
                      <Input
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        placeholder="Acme Web"
                        autoFocus
                      />
                    </Field>
                    <Button type="submit" variant="primary" disabled={busy}>
                      {busy ? "Creating…" : "Continue"}
                    </Button>
                  </form>
                </>
              )
            ) : null}

            {step === "dsn" ? (
              <>
                {dsnError ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-semantic-danger">{dsnError}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void loadOrCreateDsn()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}

                {dsn ? (
                  <>
                    <p className="text-sm font-medium text-ink">Copy your DSN</p>
                    <CopyDsnBlock
                      dsn={dsn}
                      compact
                      hint={null}
                      onCopied={() => void handleDsnCopied()}
                    />

                    <SetupConnectGuide
                      dsn={dsn}
                      phase="connect"
                      projectName={projectName || existingProject?.name}
                      onAiCopied={() =>
                        toast("Copied — paste into Cursor or your AI assistant")
                      }
                    />
                  </>
                ) : !dsnError ? (
                  <p className="text-sm text-ink-muted">Preparing DSN…</p>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
