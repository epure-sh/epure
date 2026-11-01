import type { ReactNode } from "react";
import { BellRing, Check, EyeOff, RotateCcw } from "lucide-react";
import type { IssueSummary, SnoozeMode } from "../../lib/api";
import { Badge } from "@/ui/primitives";
import { ActionButton } from "@/ui/components";
import { IssuePriorityBadge } from "@/ui/components";
import { DETAIL_INLINE_ACTION_CLASS, DETAIL_INLINE_ICON_ACTION_CLASS } from "@/ui/block";
import { SnoozeMenu } from "./snooze-menu";
import { issueStateBadge, issueWorkflowActions } from "./issue-triage-utils";

export function IssueStateBadge({
  issue,
  size = "md",
}: {
  issue: Pick<IssueSummary, "status" | "snoozed" | "level" | "priority" | "priority_score">;
  /** Detail header uses `md`; feed rows can pass `compact`. */
  size?: "compact" | "sm" | "md";
}) {
  const badge = issueStateBadge(issue);
  return (
    <>
      <IssuePriorityBadge
        level={issue.level}
        status={issue.status}
        priority={issue.priority}
        priorityScore={issue.priority_score}
        compact={size === "compact"}
        className={size === "md" ? "h-6 min-h-6 px-2 text-xs" : undefined}
      />
      <Badge size={size} variant={badge.variant}>
        {badge.label}
      </Badge>
    </>
  );
}

export function IssueStateActions({
  issue,
  disabled = false,
  pending = false,
  afterResolve,
  onResolve,
  onReopen,
  onIgnore,
  onSnooze,
  onUnsnooze,
}: {
  issue: IssueSummary;
  disabled?: boolean;
  pending?: boolean;
  /** Slot after Resolve/Unresolve — typically Copy for agent. */
  afterResolve?: ReactNode;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onIgnore: (id: string) => void;
  onSnooze: (mode: SnoozeMode, id?: string) => Promise<void>;
  onUnsnooze: (id: string) => void;
}) {
  const actions = issueWorkflowActions(issue);
  const saving = pending ? "Saving…" : null;
  const reopenLabel = issue.status === "ignored" ? "Reopen" : "Unresolve";

  return (
    <>
      {actions.includes("resolve") ? (
        <ActionButton
          variant="primary"
          size="sm"
          className={DETAIL_INLINE_ACTION_CLASS}
          disabled={disabled}
          tooltip="Resolve (E)"
          onClick={() => onResolve(issue.id)}
        >
          <Check className="size-3.5" aria-hidden />
          <span>{saving ?? "Resolve"}</span>
        </ActionButton>
      ) : null}
      {actions.includes("reopen") ? (
        <ActionButton
          variant="outline"
          size="sm"
          className={`${DETAIL_INLINE_ACTION_CLASS} border-border`}
          disabled={disabled}
          tooltip={reopenLabel}
          onClick={() => onReopen(issue.id)}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          <span>{saving ?? reopenLabel}</span>
        </ActionButton>
      ) : null}
      {afterResolve}
      {actions.includes("ignore") ? (
        <ActionButton
          variant="ghost"
          size="icon"
          className={DETAIL_INLINE_ICON_ACTION_CLASS}
          tooltip="Ignore (I)"
          disabled={disabled}
          aria-label="Ignore issue"
          onClick={() => onIgnore(issue.id)}
        >
          <EyeOff className="size-3.5" aria-hidden />
        </ActionButton>
      ) : null}
      {actions.includes("unsnooze") ? (
        <ActionButton
          variant="ghost"
          size="icon"
          className={DETAIL_INLINE_ICON_ACTION_CLASS}
          tooltip="Unsnooze"
          disabled={disabled}
          aria-label="Unsnooze issue"
          onClick={() => onUnsnooze(issue.id)}
        >
          <BellRing className="size-3.5" aria-hidden />
        </ActionButton>
      ) : null}
      {actions.includes("snooze") ? (
        <SnoozeMenu
          issue={issue}
          disabled={disabled}
          variant="ghost"
          iconOnly
          iconSize="icon"
          className={DETAIL_INLINE_ICON_ACTION_CLASS}
          showShortcutHint
          onSnooze={onSnooze}
        />
      ) : null}
    </>
  );
}
