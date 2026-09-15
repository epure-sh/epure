import { Link, useParams } from "react-router-dom";
import { projectPath, projectSettingsPath } from "../lib/paths";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { StepIndicator, type StepIndicatorItem } from "./step-indicator";

export interface SetupChecklistProps {
  projectNamed: boolean;
  dsnCopied: boolean;
  testSent: boolean;
  firstIssueSeen: boolean;
  complete: boolean;
  className?: string;
  onResumeSetup?: () => void;
}

export function SetupChecklist({
  projectNamed,
  dsnCopied,
  testSent,
  firstIssueSeen,
  complete,
  className,
  onResumeSetup,
}: SetupChecklistProps) {
  const { projectId } = useParams<{ projectId: string }>();

  if (complete) {
    return null;
  }

  const waitingForIssue = projectNamed && dsnCopied && !firstIssueSeen;

  const steps: StepIndicatorItem[] = [
    { id: "project", label: "Project", complete: projectNamed },
    { id: "dsn", label: "DSN copied", complete: dsnCopied },
    {
      id: "test",
      label: "Test error sent",
      complete: testSent || firstIssueSeen,
      active: waitingForIssue && !testSent,
    },
    {
      id: "first",
      label: "First issue",
      complete: firstIssueSeen,
      active: waitingForIssue && testSent,
    },
  ];

  const needsResume = !projectNamed || !dsnCopied;

  return (
    <div
      className={cn(
        "epure-setup-checklist border-b border-border bg-bg px-4 py-2.5",
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Setup progress</p>
        {needsResume ? (
          onResumeSetup ? (
            <Button variant="secondary" className="text-xs" onClick={onResumeSetup}>
              Resume setup
            </Button>
          ) : (
            <Link to={projectId ? projectPath(projectId, "setup") : "/setup"}>
              <Button variant="secondary" className="text-xs">Resume setup</Button>
            </Link>
          )
        ) : null}
      </div>
      <StepIndicator steps={steps} />
      {waitingForIssue ? (
        <p className="mt-2 text-sm text-ink-muted">
          {testSent
            ? "Almost there — your issue should appear in a few seconds."
            : "Send a test error below, or wire your SDK. Filter is set to production."}
          {" "}
          <Link
            to={projectId ? projectSettingsPath(projectId, "dsn") : "/"}
            className="text-ink underline-offset-2 hover:underline"
          >
            DSN settings
          </Link>
        </p>
      ) : null}
    </div>
  );
}
