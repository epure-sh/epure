import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export interface AlertsHistoryBulkBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  someSelected: boolean;
  busy?: boolean;
  onToggleSelectAll: () => void;
  onClear: () => void;
  onAcknowledge: () => void;
  onMute: () => void;
  onUnmute?: () => void;
  showUnmute?: boolean;
}

export function AlertsHistoryBulkBar({
  selectedCount,
  totalCount,
  allSelected,
  someSelected,
  busy,
  onToggleSelectAll,
  onClear,
  onAcknowledge,
  onMute,
  onUnmute,
  showUnmute,
}: AlertsHistoryBulkBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border-subtle bg-surface-1/95 px-4 py-2 backdrop-blur-sm md:px-6">
      <Checkbox
        checked={allSelected ? true : someSelected ? "indeterminate" : false}
        onCheckedChange={onToggleSelectAll}
        aria-label={allSelected ? "Deselect all alerts" : "Select all alerts in view"}
      />
      <span className="text-xs font-medium text-fg-primary">
        {selectedCount} selected
        {totalCount > 0 ? (
          <span className="font-normal text-fg-muted"> / {totalCount}</span>
        ) : null}
      </span>
      <Button variant="ghost" size="xs" disabled={busy} onClick={onAcknowledge}>
        Acknowledge
      </Button>
      {showUnmute && onUnmute ? (
        <Button variant="ghost" size="xs" disabled={busy} onClick={onUnmute}>
          Unmute
        </Button>
      ) : (
        <Button variant="ghost" size="xs" disabled={busy} onClick={onMute}>
          Mute
        </Button>
      )}
      <Button variant="ghost" size="xs" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
