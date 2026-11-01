import { EmptyState } from "@/components/kit/empty-state";
import { Button } from "@/components/ui/button";
import { CircleNotch } from "@/components/ui/icon";
import { Empty } from "@/ui/components";
import { ErrorState } from "@/ui/components";
import { IssueRowSkeleton, Skeleton } from "@/ui";
import {
  ComponentPlaygroundControls,
  useEmptyStatePlayground,
} from "../../component-playground-controls";
import { PreviewBlock, MatrixCell } from "../../shared";

export default function EmptyPreview() {
  const playground = useEmptyStatePlayground();

  const effectiveVariant =
    playground.error
      ? "error"
      : playground.loading
        ? "loading-spinner"
        : playground.variant;

  return (
    <PreviewBlock
      id="empty"
      title="Empty"
      description="Quiet · with action · error · loading — one family, four states with interactive controls."
      controls={
        <ComponentPlaygroundControls
          axes={playground.axes}
          flags={playground.flags}
        />
      }
    >
      <div className="mb-4">
        <MatrixCell label={`Live Interactive Empty State · ${effectiveVariant}`}>
          {effectiveVariant === "error" ? (
            <ErrorState
              title="Failed to Load Issue Telemetry"
              description="A network timeout occurred while fetching issue occurrences. Try refreshing."
              onRetry={() => undefined}
            />
          ) : effectiveVariant === "loading-spinner" ? (
            <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-border-subtle p-6 text-fg-muted">
              <CircleNotch className="size-6 animate-spin text-accent" weight="bold" />
              <p className="font-mono text-[11px] uppercase tracking-wide">Syncing occurrences…</p>
              <Button variant="ghost" size="xs" disabled>
                Connecting
              </Button>
            </div>
          ) : effectiveVariant === "loading-skeleton" ? (
            <div className="space-y-3 rounded-panel border border-border-subtle bg-surface-1/50 p-4">
              <Skeleton className="h-4 w-1/3" />
              <IssueRowSkeleton />
              <IssueRowSkeleton />
            </div>
          ) : effectiveVariant === "with-action" ? (
            <EmptyState
              title="No Filter Matches Found"
              description="No active issues match query 'is:unresolved priority:critical'. Reset filter criteria to continue."
              actionLabel="Clear filter omnibar"
              onAction={() => undefined}
            />
          ) : (
            <EmptyState
              title="All Caught Up · Zero Regressions"
              description="All issues for the current environment have been resolved or snoozed."
            />
          )}
        </MatrixCell>
      </div>

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
