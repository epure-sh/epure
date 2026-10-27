import type { ReactNode } from "react";
import { Pause, Play, Trash } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface AlertsRulesBulkBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  someSelected: boolean;
  busy?: boolean;
  canManage?: boolean;
  onToggleSelectAll: () => void;
  onClear: () => void;
  onEnable: () => void;
  onPause: () => void;
  onDelete: () => void;
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
  variant?: "primary" | "ghost" | "secondary" | "danger";
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

/** Bulk rule actions — matches Issues / Alerts history bulk bar. */
export function AlertsRulesBulkBar({
  selectedCount,
  totalCount,
  allSelected,
  someSelected,
  busy,
  canManage = true,
  onToggleSelectAll,
  onClear,
  onEnable,
  onPause,
  onDelete,
}: AlertsRulesBulkBarProps) {
  if (selectedCount === 0 || !canManage) {
    return null;
  }

  const busyTip = busy ? "Saving changes…" : undefined;

  return (
    <div
      className="sticky top-0 z-10 shrink-0 border-b border-border-subtle bg-surface-1 px-3 py-1.5"
      role="toolbar"
      aria-label="Bulk rule actions"
      aria-busy={busy || undefined}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={onToggleSelectAll}
          aria-label={allSelected ? "Deselect all rules" : "Select all rules in view"}
          className="mr-0.5"
        />

        <span className="pr-1 text-xs font-medium tabular-nums text-fg-primary">
          {selectedCount} selected
        </span>

        <BarButton disabled={busy} tooltip={busyTip ?? "Enable selected rules"} onClick={onEnable}>
          <Play className="size-3.5" aria-hidden />
          <span>Turn on</span>
        </BarButton>

        <BarButton disabled={busy} tooltip={busyTip ?? "Pause selected rules"} onClick={onPause}>
          <Pause className="size-3.5" aria-hidden />
          <span>Pause</span>
        </BarButton>

        <BarButton
          variant="danger"
          disabled={busy}
          tooltip={busyTip ?? "Delete selected rules"}
          onClick={onDelete}
        >
          <Trash className="size-3.5" aria-hidden />
          <span>{busy ? "Deleting…" : "Delete"}</span>
        </BarButton>

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
