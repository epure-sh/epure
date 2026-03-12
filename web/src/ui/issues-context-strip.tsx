import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

const HINT_STORAGE_KEY = "epure.dismiss.issues-no-chart-hint";

export interface IssuesContextStripProps {
  regressionCount?: number;
  showHint?: boolean;
  onViewRegressions?: () => void;
  className?: string;
}

export function IssuesContextStrip({
  regressionCount = 0,
  showHint = false,
  onViewRegressions,
  className,
}: IssuesContextStripProps) {
  const [hintDismissed, setHintDismissed] = useState(true);

  useEffect(() => {
    setHintDismissed(localStorage.getItem(HINT_STORAGE_KEY) === "1");
  }, []);

  const showRegression = regressionCount > 0 && Boolean(onViewRegressions);
  const showHintRow = showHint && !hintDismissed;

  if (!showHintRow && !showRegression) {
    return null;
  }

  const regressionLabel =
    regressionCount === 1
      ? "1 exception came back"
      : `${regressionCount} exceptions came back`;

  const handleDismissHint = () => {
    localStorage.setItem(HINT_STORAGE_KEY, "1");
    setHintDismissed(true);
  };

  return (
    <div
      className={cn(
        "epure-context-strip flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border bg-bg-subtle/30 px-4 py-1.5 md:px-6",
        showRegression && "border-l-[3px] border-l-semantic-danger pl-[13px] md:pl-[calc(1.5rem+1px)]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        {showHintRow ? (
          <p className="text-xs text-ink-muted">
            Tap a stat to filter. Velocity spikes show on Alerts.
          </p>
        ) : null}
        {showRegression ? (
          <p className="text-xs text-ink">{regressionLabel}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showRegression && onViewRegressions ? (
          <Button variant="secondary" size="toolbar" onClick={onViewRegressions}>
            Show came back
          </Button>
        ) : null}
        {showHintRow ? (
          <Button variant="ghost" size="toolbar" onClick={handleDismissHint}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
