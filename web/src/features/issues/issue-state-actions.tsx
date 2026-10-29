import { BellRing, Check, EyeOff, RotateCcw } from "lucide-react";
import type { IssueSummary, SnoozeMode } from "../../lib/api";
import { Badge } from "../../ui/badge";
import { ActionButton } from "../../ui/action-button";
import { IssuePriorityBadge } from "../../ui/issue-priority";
import { DETAIL_INLINE_ACTION_CLASS } from "../../ui/issue-detail-tabs";
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
  onResolve,
  onReopen,
  onIgnore,
  onSnooze,
  onUnsnooze,
}: {
  issue: IssueSummary;
  disabled?: boolean;
  pending?: boolean;
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
          <Check className="size-4" />
          <span>{saving ?? "Resolve"}</span>
        </ActionButton>
      ) : null}
      {actions.includes("reopen") ? (
        <ActionButton
          variant="ghost"
          size="sm"
          className={DETAIL_INLINE_ACTION_CLASS}
          disabled={disabled}
          tooltip={reopenLabel}
          onClick={() => onReopen(issue.id)}
        >
          <RotateCcw className="size-4" />
          <span>{saving ?? reopenLabel}</span>
        </ActionButton>
      ) : null}
      {actions.includes("ignore") ? (
        <ActionButton
          variant="ghost"
          size="sm"
          className={DETAIL_INLINE_ACTION_CLASS}
          tooltip="Ignore (I)"
          disabled={disabled}
          aria-label="Ignore issue"
          onClick={() => onIgnore(issue.id)}
        >
          <EyeOff className="size-4" aria-hidden />
          <span>Ignore</span>
        </ActionButton>
      ) : null}
      {actions.includes("unsnooze") ? (
        <ActionButton
          variant="ghost"
          size="sm"
          className={DETAIL_INLINE_ACTION_CLASS}
          tooltip="Unsnooze"
          disabled={disabled}
          aria-label="Unsnooze issue"
          onClick={() => onUnsnooze(issue.id)}
        >
          <BellRing className="size-4" aria-hidden />
          <span>{saving ?? "Unsnooze"}</span>
        </ActionButton>
      ) : null}
      {actions.includes("snooze") ? (
        <SnoozeMenu
          issue={issue}
          disabled={disabled}
          variant="ghost"
          className={DETAIL_INLINE_ACTION_CLASS}
          showShortcutHint
          onSnooze={onSnooze}
        />
      ) : null}
    </>
  );
}
