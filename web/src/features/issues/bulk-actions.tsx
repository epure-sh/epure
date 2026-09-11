import type { SnoozeMode } from "../../lib/api";
import type { BulkTriageAvailability } from "./issue-triage-utils";
import { BulkSnoozeMenu } from "./snooze-menu";
import { ActionButton } from "../../ui/action-button";
import { Button } from "../../ui/button";

export interface BulkActionsProps {
  selectedIds: Set<string>;
  availability: BulkTriageAvailability;
  canMerge: boolean;
  canSplit: boolean;
  onResolve: () => void;
  onIgnore: () => void;
  onResolveWithAi: () => void;
  onReopen: () => void;
  onSnooze: (mode: SnoozeMode) => Promise<void>;
  onDelete: () => void;
  onMerge?: () => void;
  onSplit?: () => void;
  onClear: () => void;
  busy?: boolean;
}

export function BulkActions({
  selectedIds,
  availability,
  canMerge,
  canSplit,
  onResolve,
  onIgnore,
  onResolveWithAi,
  onReopen,
  onSnooze,
  onDelete,
  onMerge,
  onSplit,
  onClear,
  busy = false,
}: BulkActionsProps) {
  const count = selectedIds.size;
  const showBulk = count > 0;
  const showSplit = canSplit && !showBulk;

  if (!showBulk && !showSplit) {
    return null;
  }

  const busyTooltip = busy ? "Saving changes…" : undefined;

  return (
    <div
      className="sticky top-0 z-10 border-b border-border bg-surface-elevated px-3 py-2 epure-filter-panel"
      aria-busy={busy || undefined}
    >
      {showBulk ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink">
            {count} selected
          </span>
          {availability.resolve ? (
            <ActionButton
              variant="primary"
              className="text-xs"
              disabled={busy}
              tooltip={busyTooltip}
              onClick={onResolve}
            >
              {busy ? "Saving…" : "Mark resolved"}
            </ActionButton>
          ) : null}
          {availability.ignore ? (
            <ActionButton
              variant="ghost"
              className="text-xs"
              disabled={busy}
              tooltip={busyTooltip}
              onClick={onIgnore}
            >
              Ignore
            </ActionButton>
          ) : null}
          {availability.ignore ? (
            <ActionButton
              variant="ghost"
              className="text-xs"
              disabled={busy}
              tooltip={
                busy
                  ? busyTooltip
                  : "Copy selected issues for your editor, then mark them ignored"
              }
              onClick={onResolveWithAi}
            >
              Resolve all with AI
            </ActionButton>
          ) : null}
          {availability.reopen ? (
            <ActionButton
              variant="ghost"
              className="text-xs"
              disabled={busy}
              tooltip={busyTooltip}
              onClick={onReopen}
            >
              Unresolve
            </ActionButton>
          ) : null}
          {availability.snooze ? (
            <BulkSnoozeMenu disabled={busy} onSnooze={onSnooze} />
          ) : null}
          {canMerge && onMerge ? (
            <ActionButton
              variant="ghost"
              className="text-xs"
              disabled={busy}
              tooltip={busy ? busyTooltip : "Merge selected issues into the focused issue"}
              onClick={onMerge}
            >
              Merge
            </ActionButton>
          ) : null}
          <ActionButton
            variant="danger"
            className="text-xs"
            disabled={busy}
            tooltip={busyTooltip}
            onClick={onDelete}
          >
            Delete
          </ActionButton>
          <Button variant="ghost" className="ml-auto text-xs" disabled={busy} onClick={onClear}>
            Clear
          </Button>
        </div>
      ) : null}

      {showSplit && onSplit ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Merged issues in view</span>
          <ActionButton
            variant="secondary"
            className="text-xs"
            disabled={busy}
            tooltip={busyTooltip}
            onClick={onSplit}
          >
            Split all merged
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
