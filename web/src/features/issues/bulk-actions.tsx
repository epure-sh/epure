import type { ReactNode } from "react";
import { Archive, Ban, Check, Eye, RotateCcw, Sparkles } from "lucide-react";
import type { SnoozeMode } from "../../lib/api";
import type { BulkTriageAvailability } from "./issue-triage-utils";
import { BulkSnoozeMenu } from "./snooze-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface BulkActionsProps {
  selectedIds: Set<string>;
  availability: BulkTriageAvailability;
  canMerge: boolean;
  canSplit: boolean;
  onResolve: () => void;
  onIgnore: () => void;
  onAskAi: () => void;
  onMarkRead: () => void;
  onReopen: () => void;
  onSnooze: (mode: SnoozeMode) => Promise<void>;
  onMerge?: () => void;
  onSplit?: () => void;
  onClear: () => void;
  busy?: boolean;
  className?: string;
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
        <span className={disabled ? "inline-flex cursor-not-allowed" : "inline-flex"}>
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function BarIconButton({
  label,
  tooltip,
  disabled,
  onClick,
  children,
}: {
  label: string;
  tooltip?: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const tip = tooltip ?? label;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={disabled ? "inline-flex cursor-not-allowed" : "inline-flex"}>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={label}
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

export function BulkActions({
  selectedIds,
  availability,
  canMerge,
  canSplit,
  onResolve,
  onIgnore,
  onAskAi,
  onMarkRead,
  onReopen,
  onSnooze,
  onMerge,
  onSplit,
  onClear,
  busy = false,
  className,
}: BulkActionsProps) {
  const count = selectedIds.size;
  const showBulk = count > 0;
  const showSplit = canSplit && !showBulk;

  if (!showBulk && !showSplit) {
    return null;
  }

  const busyTip = busy ? "Saving changes…" : undefined;

  return (
    <div
      className={cn(
        "sticky top-0 z-10 shrink-0 bg-surface-1 px-3 py-1.5",
        className,
      )}
      aria-busy={busy || undefined}
      role="toolbar"
      aria-label="Bulk issue actions"
    >
      {showBulk ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="pr-1 text-xs font-medium tabular-nums text-fg-primary">
            {count} selected
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

          <BarButton
            disabled={busy}
            tooltip={busyTip ?? "Mark read"}
            onClick={onMarkRead}
          >
            <Eye className="size-3.5" aria-hidden />
            <span>Mark read</span>
          </BarButton>

          <BarButton
            disabled={busy}
            tooltip={busyTip ?? "Ask AI"}
            onClick={onAskAi}
          >
            <Sparkles className="size-3.5" aria-hidden />
            <span>Ask AI</span>
          </BarButton>

          {availability.snooze ? (
            <BulkSnoozeMenu disabled={busy} iconOnly onSnooze={onSnooze} />
          ) : null}

          {availability.ignore ? (
            <BarIconButton
              label="Archive"
              disabled={busy}
              tooltip={busyTip ?? "Archive"}
              onClick={onIgnore}
            >
              <Archive className="size-3.5" aria-hidden />
            </BarIconButton>
          ) : null}

          {availability.ignore ? (
            <BarIconButton
              label="Ignore"
              disabled={busy}
              tooltip={busyTip ?? "Ignore"}
              onClick={onIgnore}
            >
              <Ban className="size-3.5" aria-hidden />
            </BarIconButton>
          ) : null}

          {availability.reopen ? (
            <BarButton
              disabled={busy}
              tooltip={busyTip ?? "Unresolve"}
              onClick={onReopen}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              <span>Unresolve</span>
            </BarButton>
          ) : null}

          {canMerge && onMerge ? (
            <BarButton
              disabled={busy}
              tooltip={busyTip ?? "Merge"}
              onClick={onMerge}
            >
              <span>Merge</span>
            </BarButton>
          ) : null}

          <Button variant="ghost" size="sm" className="ml-auto" disabled={busy} onClick={onClear}>
            Clear
          </Button>
        </div>
      ) : null}

      {showSplit && onSplit ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted">Merged issues in view</span>
          <BarButton variant="secondary" disabled={busy} tooltip={busyTip ?? "Split merged"} onClick={onSplit}>
            <span>Split merged</span>
          </BarButton>
        </div>
      ) : null}
    </div>
  );
}
