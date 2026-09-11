import type { IssueSummary } from "../../lib/api";
import { ActionButton } from "../../ui/action-button";

export interface MergeActionsProps {
  selectedIds: Set<string>;
  primaryId: string | null;
  mergedChildren: IssueSummary[];
  onMerge: () => void;
  onSplit: (splitIds: string[]) => void;
  busy?: boolean;
}

export function MergeActions({
  selectedIds,
  primaryId,
  mergedChildren,
  onMerge,
  onSplit,
  busy = false,
}: MergeActionsProps) {
  const canMerge = selectedIds.size >= 2 && primaryId !== null;
  const canSplit = primaryId !== null && mergedChildren.length > 0;

  if (selectedIds.size < 2 && !canSplit) {
    return null;
  }

  const busyTooltip = busy ? "Saving changes…" : undefined;

  return (
    <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
      {selectedIds.size >= 2 ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-muted">
            {selectedIds.size} selected
          </span>
          <ActionButton
            variant="secondary"
            className="text-xs"
            disabled={!canMerge || busy}
            tooltip={
              busy
                ? busyTooltip
                : !canMerge
                  ? "Select 2+ issues with one focused as the merge target"
                  : undefined
            }
            onClick={onMerge}
          >
            Merge into current
          </ActionButton>
        </div>
      ) : null}

      {canSplit ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-muted">
            {mergedChildren.length} merged
          </span>
          <ActionButton
            variant="secondary"
            className="text-xs"
            disabled={busy}
            tooltip={busyTooltip}
            onClick={() => onSplit(mergedChildren.map((child) => child.id))}
          >
            Split all merged
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
