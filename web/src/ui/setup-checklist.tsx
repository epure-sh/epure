import { Link, useParams } from "react-router-dom";
import { projectPath, projectSettingsPath } from "../lib/paths";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { StepIndicator, type StepIndicatorItem } from "./step-indicator";

export interface SetupChecklistProps {
  projectNamed: boolean;
  hasActiveKey: boolean;
  dsnCopied: boolean;
  firstIssueSeen: boolean;
  complete: boolean;
  className?: string;
  onResumeSetup?: () => void;
}

export function SetupChecklist({
  projectNamed,
  hasActiveKey,
  dsnCopied,
  firstIssueSeen,
  complete,
  className,
  onResumeSetup,
}: SetupChecklistProps) {
  const { projectId } = useParams<{ projectId: string }>();

  if (complete) {
    return null;
  }

  const connected = projectNamed && hasActiveKey && dsnCopied;

  const steps: StepIndicatorItem[] = [
    {
      id: "connect",
      label: "Connect",
      complete: connected,
      active: !connected,
    },
    {
      id: "first",
      label: "First error",
      complete: firstIssueSeen,
      active: connected && !firstIssueSeen,
    },
  ];

  return (
    <div
      className={cn(
        "epure-setup-checklist flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-subtle px-4 py-2",
        className,
      )}
    >
      <StepIndicator steps={steps} />
      <div className="flex items-center gap-2">
        {!connected ? (
          onResumeSetup ? (
            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={onResumeSetup}>
              Resume setup
            </Button>
          ) : (
            <Link to={projectId ? projectPath(projectId, "setup") : "/setup"}>
              <Button variant="secondary" size="sm" className="h-7 text-xs">
                Resume setup
              </Button>
            </Link>
          )
        ) : (
          <Link
            to={projectId ? projectSettingsPath(projectId, "dsn") : "/"}
            className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            DSN settings
          </Link>
        )}
      </div>
    </div>
  );
}
