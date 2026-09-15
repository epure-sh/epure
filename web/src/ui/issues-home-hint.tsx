import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

const STORAGE_KEY = "epure.dismiss.issues-no-chart-hint";

export interface IssuesHomeHintProps {
  className?: string;
}

export function IssuesHomeHint({ className }: IssuesHomeHintProps) {
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
        "epure-home-hint flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border bg-bg-subtle/40 px-6 py-2",
        className,
      )}
    >
      <p className="text-xs text-ink-muted">
        The list is home — tap a stat to filter. Velocity spikes show up on Alerts.
      </p>
      <Button variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={handleDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
