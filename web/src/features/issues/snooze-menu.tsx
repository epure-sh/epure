import { useState } from "react";
import type { IssueSummary, SnoozeMode } from "../../lib/api";
import { Button, type ButtonProps } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { canSnoozeIssue } from "./issue-triage-utils";

interface SnoozeMenuProps {
  issue: IssueSummary;
  disabled?: boolean;
  buttonSize?: ButtonProps["size"];
  onSnooze: (mode: SnoozeMode) => Promise<void>;
}

const OPTIONS: { mode: SnoozeMode; label: string }[] = [
  { mode: "hours", label: "4 hours" },
  { mode: "occurrences", label: "100 more occurrences" },
  { mode: "users", label: "10 more users" },
];

interface BulkSnoozeMenuProps {
  disabled?: boolean;
  onSnooze: (mode: SnoozeMode) => Promise<void>;
}

export function BulkSnoozeMenu({
  disabled = false,
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
  const tooltip = pending ? "Snoozing…" : disabled ? "Saving changes…" : undefined;

  const trigger = (
    <Button
      variant="ghost"
      size="toolbar"
      className="h-control shrink-0 text-xs"
      disabled={triggerDisabled}
      aria-busy={pending || undefined}
    >
      {label}
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
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-[11rem]">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.mode}
            disabled={pending}
            onSelect={() => void handleSnooze(option.mode)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SnoozeMenu({
  issue,
  disabled = false,
  buttonSize = "toolbar",
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

  const label = pending ? "Snoozing…" : issue.snoozed ? "Snoozed" : "Snooze";

  const trigger = (
    <Button
      variant="ghost"
      size={buttonSize}
      className="h-control shrink-0"
      disabled={triggerDisabled}
      aria-busy={pending || undefined}
      aria-pressed={issue.snoozed || undefined}
    >
      {label}
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
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[11rem]">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.mode}
            disabled={pending}
            onSelect={() => void handleSnooze(option.mode)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
