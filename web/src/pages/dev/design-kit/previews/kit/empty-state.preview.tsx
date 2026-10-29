import { EmptyState } from "@/components/kit/empty-state";
import { Button } from "@/components/ui/button";
import { CircleNotch } from "@/components/ui/icon";
import { PreviewBlock, PreviewRow, MatrixCell } from "../../shared";

export default function EmptyStatePreview() {
  return (
    <PreviewBlock
      id="empty-state"
      title="EmptyState"
      description="Quiet · with CTA · loading adjacent — every feed/detail empty path"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MatrixCell label="Quiet (no action)">
          <EmptyState title="No issues" description="Inbox is clear for this window." />
        </MatrixCell>
        <MatrixCell label="With CTA">
          <EmptyState
            title="No matches"
            description="Try clearing filters or widening the time range."
            actionLabel="Clear filters"
            onAction={() => undefined}
          />
        </MatrixCell>
        <MatrixCell label="First-run">
          <EmptyState
            title="Connect a project"
            description="Ship your first event to see triage here."
            actionLabel="View setup"
            onAction={() => undefined}
          />
        </MatrixCell>
        <MatrixCell label="Busy (skeleton stand-in)">
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-border-subtle p-4 text-fg-muted">
            <CircleNotch className="size-5 animate-spin" weight="bold" />
            <p className="font-mono text-[10px] uppercase tracking-wide">Loading…</p>
            <Button variant="ghost" size="xs" disabled>
              Waiting
            </Button>
          </div>
        </MatrixCell>
      </div>
      <PreviewRow label="Compact strip" className="mt-3">
        <EmptyState title="Nothing here" description="Empty row substitute" />
      </PreviewRow>
    </PreviewBlock>
  );
}
