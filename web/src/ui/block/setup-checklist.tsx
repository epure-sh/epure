// web/src/ui/block/setup-checklist.tsx
// Tier 3 Block: Setup Checklist Progress Banner
// Tracks setup progress (Connect, First Error) with StepIndicator.

import { Link, useParams } from "react-router-dom";
import { projectPath, projectSettingsPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { Button } from "../primitives/elements/button";
import { StepIndicator, type StepIndicatorItem } from "../components/step-indicator";

export interface SetupChecklistStepInput {
  id: string;
  label?: string;
  title?: string;
  complete?: boolean;
  active?: boolean;
  status?: string;
}

export interface SetupChecklistProps {
  projectNamed?: boolean;
  hasActiveKey?: boolean;
  dsnCopied?: boolean;
  firstIssueSeen?: boolean;
  complete?: boolean;
  className?: string;
  onResumeSetup?: () => void;
  steps?: SetupChecklistStepInput[];
}

export function SetupChecklist({
  projectNamed = false,
  hasActiveKey = false,
  dsnCopied = false,
  firstIssueSeen = false,
  complete = false,
  className,
  onResumeSetup,
  steps: stepsProp,
}: SetupChecklistProps) {
  let projectId: string | undefined;
  try {
    const params = useParams<{ projectId: string }>();
    projectId = params.projectId;
  } catch {}

  if (complete) {
    return null;
  }

  const connected = projectNamed && hasActiveKey && dsnCopied;

  const steps: StepIndicatorItem[] = stepsProp
    ? stepsProp.map((s) => ({
        id: s.id,
        label: s.label ?? s.title ?? s.id,
        complete: s.complete ?? s.status === "completed",
        active: s.active ?? s.status === "current",
      }))
    : [
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
      data-slot="setup-checklist"
      className={cn(
        "epure-setup-checklist flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-subtle epure-page-gutter-x py-2",
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
