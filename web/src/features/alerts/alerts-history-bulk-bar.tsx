import type { ReactNode } from "react";
import { Check, Clock, Eye, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BulkAlertAvailability } from "./alert-bulk-utils";

export interface AlertsHistoryBulkBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  someSelected: boolean;
  availability: BulkAlertAvailability;
  busy?: boolean;
  canJumpToIssue?: boolean;
  onToggleSelectAll: () => void;
  onClear: () => void;
  onResolve: () => void;
  onMarkRead: () => void;
  onSnooze: () => void;
  onUnsnooze: () => void;
  onReopen: () => void;
  onJumpToIssue?: () => void;
}

function BarButton({
  children,
  tooltip,
  disabled,
  variant = "ghost",
  onClick,
}: {
  children: ReactNode;
  tooltip?: string;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "secondary";
  onClick?: () => void;
}) {
  const button = (
    <Button variant={variant} size="sm" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={disabled ? "inline-flex cursor-not-allowed" : "inline-flex"}>{button}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/** Bulk toolbar — matches Issues `BulkActions` layout and affordances. */
export function AlertsHistoryBulkBar({
  selectedCount,
  totalCount,
  allSelected,
  someSelected,
  availability,
  busy,
  canJumpToIssue,
  onToggleSelectAll,
  onClear,
  onResolve,
  onMarkRead,
  onSnooze,
  onUnsnooze,
  onReopen,
  onJumpToIssue,
}: AlertsHistoryBulkBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  const busyTip = busy ? "Saving changes…" : undefined;

  return (
    <div
      className="sticky top-0 z-10 shrink-0 border-b border-border-subtle bg-surface-1 px-3 py-1.5"
      role="toolbar"
      aria-label="Bulk alert actions"
      aria-busy={busy || undefined}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={onToggleSelectAll}
          aria-label={allSelected ? "Deselect all alerts" : "Select all alerts in view"}
          className="mr-0.5"
        />

        <span className="pr-1 text-xs font-medium tabular-nums text-fg-primary">
          {selectedCount} selected
        </span>

        {availability.resolve ? (
          <BarButton
            variant="primary"
            disabled={busy}
            tooltip={busyTip ?? "Mark resolved"}
            onClick={onResolve}
          >
            <Check className="size-3.5" aria-hidden />
            <span>{busy ? "Saving…" : "Mark resolved"}</span>
          </BarButton>
        ) : null}

        <BarButton disabled={busy} tooltip={busyTip ?? "Mark read"} onClick={onMarkRead}>
          <Eye className="size-3.5" aria-hidden />
          <span>Mark read</span>
        </BarButton>

        {availability.snooze ? (
          <BarButton disabled={busy} tooltip={busyTip ?? "Snooze"} onClick={onSnooze}>
            <Clock className="size-3.5" aria-hidden />
            <span>Snooze</span>
          </BarButton>
        ) : null}

        {availability.unsnooze ? (
          <BarButton disabled={busy} tooltip={busyTip ?? "Unsnooze"} onClick={onUnsnooze}>
            <span>Unsnooze</span>
          </BarButton>
        ) : null}

        {availability.reopen ? (
          <BarButton disabled={busy} tooltip={busyTip ?? "Unresolve"} onClick={onReopen}>
            <RotateCcw className="size-3.5" aria-hidden />
            <span>Unresolve</span>
          </BarButton>
        ) : null}

        {canJumpToIssue && onJumpToIssue ? (
          <BarButton disabled={busy} tooltip="Open linked issue" onClick={onJumpToIssue}>
            <span>Jump to issue</span>
          </BarButton>
        ) : null}

        <Button variant="ghost" size="sm" className={cn("ml-auto")} disabled={busy} onClick={onClear}>
          Clear
        </Button>

        <span className="hidden w-full text-[11px] text-fg-muted lg:block lg:w-auto lg:pl-2">
          {totalCount} in view
        </span>
      </div>
    </div>
  );
}
