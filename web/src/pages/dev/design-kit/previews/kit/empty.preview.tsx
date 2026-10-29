import { EmptyState } from "@/components/kit/empty-state";
import { Button } from "@/components/ui/button";
import { CircleNotch } from "@/components/ui/icon";
import { Empty } from "@/ui/empty";
import { ErrorState } from "@/ui/error-state";
import { IssueRowSkeleton, Skeleton } from "@/ui/skeleton";
import { PreviewBlock, MatrixCell } from "../../shared";

export default function EmptyPreview() {
  return (
    <PreviewBlock
      id="empty"
      title="Empty"
      description="Quiet · with action · error · loading — one family, four states."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MatrixCell label="Quiet">
          <EmptyState title="No issues" description="Inbox is clear for this window." />
        </MatrixCell>
        <MatrixCell label="With action">
          <EmptyState
            title="No matches"
            description="Try clearing filters."
            actionLabel="Clear filters"
            onAction={() => undefined}
          />
        </MatrixCell>
        <MatrixCell label="Feature Empty">
          <Empty title="Nothing yet" description="Feature-layer quiet state." />
        </MatrixCell>
        <MatrixCell label="Error">
          <ErrorState
            title="Could not load"
            description="Retry in a moment."
            onRetry={() => undefined}
          />
        </MatrixCell>
        <MatrixCell label="Loading · spinner">
          <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-border-subtle p-4 text-fg-muted">
            <CircleNotch className="size-5 animate-spin" weight="bold" />
            <p className="font-mono text-[10px] uppercase tracking-wide">Loading…</p>
            <Button variant="ghost" size="xs" disabled>
              Waiting
            </Button>
          </div>
        </MatrixCell>
        <MatrixCell label="Loading · skeleton">
          <div className="space-y-2 p-2">
            <Skeleton className="h-4 w-3/4" />
            <IssueRowSkeleton />
          </div>
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
