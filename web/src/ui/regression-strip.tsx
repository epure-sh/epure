import { cn } from "../lib/cn";
import { Button } from "./button";

export interface RegressionStripProps {
  count: number;
  onViewRegressions: () => void;
  className?: string;
}

export function RegressionStrip({
  count,
  onViewRegressions,
  className,
}: RegressionStripProps) {
  if (count <= 0) {
    return null;
  }

  const label =
    count === 1
      ? "1 exception came back after you resolved it."
      : `${count} exceptions came back after you resolved them.`;

  return (
    <div
      className={cn(
        "epure-regression-strip flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border border-l-[3px] border-l-semantic-danger bg-surface px-6 py-2.5",
        className,
      )}
    >
      <p className="text-sm text-ink">{label}</p>
      <Button variant="secondary" className="h-7 shrink-0 text-xs" onClick={onViewRegressions}>
        Show came back
      </Button>
    </div>
  );
}
