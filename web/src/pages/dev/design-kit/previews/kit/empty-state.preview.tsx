import { EmptyState } from "@/components/kit/empty-state";
import { MagnifyingGlass, UserPlus } from "@/components/ui/icon";
import { PreviewBlock, PreviewRow, MatrixCell } from "../../shared";

export default function EmptyStatePreview() {
  return (
    <PreviewBlock
      id="empty-state"
      title="EmptyState"
      description="Emotional empties: calm tone, one next step, no dashed circus"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MatrixCell label="First-run">
          <EmptyState
            tone="first-run"
            title="Ready when you are"
            description="Connect a channel so alert rules can reach your team."
            hint="One is enough to start. You can add more later."
            actionLabel="Create channel"
            onAction={() => undefined}
          />
        </MatrixCell>
        <MatrixCell label="Calm / zero">
          <EmptyState
            tone="calm"
            title="Caught up"
            description="Nothing needs review in this window. Enjoy the quiet."
            hint="New signals will show up here as they fire."
          />
        </MatrixCell>
        <MatrixCell label="Search miss">
          <EmptyState
            tone="search"
            icon={MagnifyingGlass}
            title="Nothing matches that filter"
            description="Try another query, or clear filters. Nothing was deleted."
            actionLabel="Clear filters"
            onAction={() => undefined}
          />
        </MatrixCell>
        <MatrixCell label="Blocked">
          <EmptyState
            tone="blocked"
            title="Needs an admin"
            description="Managing this needs an owner or admin. Ask a teammate when you can."
            actionLabel="Back"
            onAction={() => undefined}
            actionVariant="secondary"
          />
        </MatrixCell>
      </div>
      <PreviewRow label="Inset (inside list/card)" className="mt-3">
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
          <EmptyState
            layout="inset"
            tone="first-run"
            icon={UserPlus}
            title="Just you for now"
            description="Invite a teammate when you're ready to triage together."
            hint="You can change roles anytime."
            actionLabel="Invite teammate"
            onAction={() => undefined}
          />
        </div>
      </PreviewRow>
    </PreviewBlock>
  );
}
