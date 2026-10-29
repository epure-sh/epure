import { useState } from "react";
import { Clock } from "lucide-react";
import type { IssueSummary, SnoozeMode } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Button, type ButtonProps } from "@/components/ui/button";
import { CaretDown } from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { canSnoozeIssue } from "./issue-triage-utils";

interface SnoozeMenuProps {
  issue: IssueSummary;
  disabled?: boolean;
  buttonSize?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  showShortcutHint?: boolean;
  iconOnly?: boolean;
  iconSize?: Extract<ButtonProps["size"], "icon" | "icon-xs">;
  className?: string;
  onSnooze: (mode: SnoozeMode) => Promise<void>;
}

const TIME_OPTIONS: { mode: SnoozeMode; label: string }[] = [
  { mode: "1h", label: "1 hour" },
  { mode: "4h", label: "4 hours" },
  { mode: "1d", label: "1 day" },
  { mode: "7d", label: "1 week" },
  { mode: "30d", label: "1 month" },
  { mode: "90d", label: "3 months" },
];

const UNTIL_OPTIONS: { mode: SnoozeMode; label: string }[] = [
  { mode: "occurrences", label: "100 more occurrences" },
  { mode: "users", label: "10 more users" },
];

export function SnoozeMenuItems({
  pending = false,
  onSelect,
}: {
  pending?: boolean;
  onSelect: (mode: SnoozeMode) => void;
}) {
  return (
    <>
      {TIME_OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.mode}
          disabled={pending}
          onSelect={() => onSelect(option.mode)}
        >
          {option.label}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      {UNTIL_OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.mode}
          disabled={pending}
          onSelect={() => onSelect(option.mode)}
        >
          {option.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

interface BulkSnoozeMenuProps {
  disabled?: boolean;
  iconOnly?: boolean;
  onSnooze: (mode: SnoozeMode) => Promise<void>;
}

export function BulkSnoozeMenu({
  disabled = false,
  iconOnly = false,
  onSnooze,
}: BulkSnoozeMenuProps) {
  const [pending, setPending] = useState(false);
  const triggerDisabled = disabled || pending;

  async function handleSnooze(mode: SnoozeMode) {
    if (pending || disabled) {
      return;
    }
    setPending(true);
    try {
      await onSnooze(mode);
    } finally {
      setPending(false);
    }
  }

  const label = pending ? "Snoozing…" : "Snooze";
  const tooltip = pending ? "Snoozing…" : disabled ? "Saving changes…" : label;

  const trigger = iconOnly ? (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0"
      disabled={triggerDisabled}
      aria-busy={pending || undefined}
      aria-label={label}
    >
      <Clock className="size-3.5" aria-hidden />
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0"
      disabled={triggerDisabled}
      aria-busy={pending || undefined}
    >
      <Clock className="size-3.5 text-fg-muted" aria-hidden />
      <span>{label}</span>
      <CaretDown className="size-3 text-fg-muted" weight="bold" aria-hidden />
    </Button>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={triggerDisabled}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={triggerDisabled ? "inline-flex cursor-not-allowed" : "inline-flex"}
              tabIndex={triggerDisabled ? 0 : undefined}
            >
              {trigger}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-[14rem]">
        <SnoozeMenuItems pending={pending} onSelect={(mode) => void handleSnooze(mode)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SnoozeMenu({
  issue,
  disabled = false,
  buttonSize = "toolbar",
  variant = "ghost",
  showShortcutHint = false,
  iconOnly = false,
  iconSize = "icon-xs",
  className,
  onSnooze,
}: SnoozeMenuProps) {
  const [pending, setPending] = useState(false);
  const canSnooze = canSnoozeIssue(issue);
  const triggerDisabled = disabled || pending || !canSnooze;

  const tooltip = pending
    ? "Snoozing…"
    : issue.snoozed
      ? "Issue is already snoozed"
      : !canSnooze
        ? "Only open issues can be snoozed"
        : showShortcutHint || iconOnly
          ? "Snooze (S)"
          : undefined;

  async function handleSnooze(mode: SnoozeMode) {
    if (pending || disabled || !canSnooze) {
      return;
    }
    setPending(true);
    try {
      await onSnooze(mode);
    } finally {
      setPending(false);
    }
  }

  const label = pending
    ? "Snoozing…"
    : issue.snoozed
      ? "Snoozed"
      : showShortcutHint || iconOnly
        ? "Snooze (S)"
        : "Snooze";

  const trigger = iconOnly ? (
    <Button
      variant={variant}
      size={iconSize}
      className={cn("shrink-0", className)}
      disabled={triggerDisabled}
      aria-busy={pending || undefined}
      aria-pressed={issue.snoozed || undefined}
      aria-label={label}
    >
      <Clock className="size-3.5 text-fg-muted" aria-hidden />
    </Button>
  ) : (
    <Button
      variant={variant}
      size={buttonSize}
      className={cn("h-control shrink-0", className)}
      disabled={triggerDisabled}
      aria-busy={pending || undefined}
      aria-pressed={issue.snoozed || undefined}
    >
      <Clock className="mr-1.5 h-3.5 w-3.5 text-ink-muted" />
      <span>{label}</span>
    </Button>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={triggerDisabled}>
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={triggerDisabled ? "inline-flex cursor-not-allowed" : "inline-flex"}
                tabIndex={triggerDisabled ? 0 : undefined}
              >
                {trigger}
              </span>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[14rem]">
        <SnoozeMenuItems pending={pending} onSelect={(mode) => void handleSnooze(mode)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
