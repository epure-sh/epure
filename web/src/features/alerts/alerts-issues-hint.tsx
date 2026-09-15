import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { projectPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/button";

const STORAGE_KEY = "epure.dismiss.alerts-issues-hint";

export interface AlertsIssuesHintProps {
  projectId: string;
  className?: string;
}

export function AlertsIssuesHint({ projectId, className }: AlertsIssuesHintProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "epure-context-strip flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border bg-bg-subtle/30 px-4 py-1.5 md:px-6",
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-xs text-ink-muted">
        Came back exceptions also show on{" "}
        <Link
          to={`${projectPath(projectId, "issues")}?q=is:regression`}
          className="text-ink underline-offset-2 hover:underline"
        >
          Issues
        </Link>{" "}
        with a badge. Velocity spikes only appear here.
      </p>
      <Button variant="ghost" size="toolbar" className="shrink-0" onClick={handleDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
