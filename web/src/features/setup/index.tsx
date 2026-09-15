import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectPath } from "../../lib/paths";
import {
  createDsnKey,
  createProject,
  fetchSetupProgress,
  formatDsn,
  patchSetupProgress,
  type CreatedDsnKey,
} from "../../lib/api";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { CopyDsnBlock } from "../../ui/copy-dsn-block";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { PageChrome } from "../../ui/page-chrome";
import { SdkSnippetBlock } from "../../ui/sdk-snippet-block";
import { StepIndicator } from "../../ui/step-indicator";
import { useToast } from "../../ui/toast-provider";

type SetupStep = "project" | "dsn";

export function SetupPage() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { environment, projects, refreshProjects, projectId, setProjectId } = useAppContext();
  const [step, setStep] = useState<SetupStep>("project");
  const [projectName, setProjectName] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    routeProjectId ?? projectId,
  );
  const [dsnKey, setDsnKey] = useState<CreatedDsnKey | null>(null);
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
      .then(async (progress) => {
        if (progress.complete) {
          navigate(projectPath(activeProjectId, "issues"), { replace: true });
          return;
        }
        if (progress.project_named && progress.dsn_copied_at) {
          navigate(projectPath(activeProjectId, "issues"), { replace: true });
          return;
        }
        if (progress.project_named) {
          setStep("dsn");
          return;
        }
        if (existingProject) {
          await patchSetupProgress({
            project_id: activeProjectId,
            project_named: true,
          });
          setStep("dsn");
        }
      })
      .catch(() => {
        // fresh user — stay on setup
      });
  }, [activeProjectId, existingProject, navigate]);

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

  const handleContinueExistingProject = useCallback(async () => {
    if (!activeProjectId) {
      return;
    }
    setBusy(true);
    try {
      await patchSetupProgress({
        project_id: activeProjectId,
        project_named: true,
      });
      setStep("dsn");
    } catch {
      toast("Failed to save setup progress");
    } finally {
      setBusy(false);
    }
  }, [activeProjectId, toast]);

  const handleCreateDsn = useCallback(async () => {
    if (!activeProjectId) {
      return;
    }
    setBusy(true);
    try {
      const key = await createDsnKey(activeProjectId, "default");
      setDsnKey(key);
    } catch {
      toast("Failed to create DSN key");
    } finally {
      setBusy(false);
    }
  }, [activeProjectId, toast]);

  useEffect(() => {
    if (step === "dsn" && activeProjectId && !dsnKey) {
      void handleCreateDsn();
    }
  }, [activeProjectId, dsnKey, handleCreateDsn, step]);

  const handleDsnCopied = useCallback(async () => {
    if (!activeProjectId) {
      return;
    }
    try {
      await patchSetupProgress({
        project_id: activeProjectId,
        dsn_copied: true,
      });
      navigate(projectPath(activeProjectId, "issues"), { replace: true });
    } catch {
      toast("Failed to save setup progress");
    }
  }, [activeProjectId, navigate, toast]);

  const dsn =
    dsnKey && activeProjectId
      ? formatDsn(dsnKey.public_key, activeProjectId)
      : "";

  const steps = [
    {
      id: "project",
      label: "Project name",
      complete: step === "dsn",
      active: step === "project",
    },
    {
      id: "dsn",
      label: "Copy DSN",
      complete: false,
      active: step === "dsn",
    },
    {
      id: "verify",
      label: "First error",
      complete: false,
      active: false,
    },
  ];

  const showExistingProjectStep = Boolean(existingProject && step === "project");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome
        title="Connect your app"
        description="Three steps: name your project, copy the DSN, send your first error."
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-narrow space-y-8 p-6">
          <StepIndicator steps={steps} />

          {step === "project" ? (
            <Card>
              <CardContent className="space-y-4 p-5 pt-5">
                {showExistingProjectStep ? (
                  <>
                    <Field
                      label="Project"
                      hint="This project is ready — continue to get your connection string."
                    >
                      <Input value={projectName} readOnly />
                    </Field>
                    <Button
                      variant="signal"
                      disabled={busy}
                      onClick={() => void handleContinueExistingProject()}
                    >
                      Continue to DSN
                    </Button>
                  </>
                ) : (
                  <>
                    <Field label="Project name" hint="e.g. My SaaS API or storefront">
                      <Input
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        placeholder="My project"
                        autoFocus
                      />
                    </Field>
                    <Button
                      variant="signal"
                      disabled={busy}
                      onClick={() => void handleCreateProject()}
                    >
                      Continue
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {step === "dsn" && dsn ? (
            <Card>
              <CardContent className="space-y-5 p-5 pt-5">
                <CopyDsnBlock dsn={dsn} onCopied={() => void handleDsnCopied()} />
                <SdkSnippetBlock dsn={dsn} environment={environment} />
                <p className="text-sm text-ink-muted">
                  Next: send a test error from the Issues screen — one click, no README required.
                </p>
                <Button variant="signal" onClick={() => void handleDsnCopied()}>
                  Continue to send first error
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {step === "dsn" && !dsn ? (
            <p className="text-sm text-ink-muted">Preparing your connection string…</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
