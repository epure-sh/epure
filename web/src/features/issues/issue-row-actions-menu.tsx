import type { IssueSummary, SnoozeMode } from "../../lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  Bell,
  Check,
  Clock,
  DotsThree,
  Eye,
  Icon,
  ArrowCounterClockwise,
  Sparkle,
  Trash,
} from "@/components/ui/icon";
import type { BulkTriageAvailability } from "./issue-triage-utils";
import { bulkTriageAvailability, canSnoozeIssue } from "./issue-triage-utils";
import { SnoozeMenuItems } from "./snooze-menu";

export interface IssueRowActionsMenuProps {
  issue: IssueSummary;
  issues: IssueSummary[];
  selectedIds: Set<string>;
  busy?: boolean;
  canMerge?: boolean;
  canSplit?: boolean;
  onResolve: (ids: string[]) => void;
  onIgnore: (ids: string[]) => void;
  onReopen: (ids: string[]) => void;
  onSnooze: (mode: SnoozeMode, ids: string[]) => void;
  onUnsnooze: (id: string) => void;
  onAskAi: (issues: IssueSummary[]) => void;
  onMarkRead: (ids: string[]) => void;
  onDeleteRequest: (ids: string[]) => void;
  onMerge?: () => void;
  onSplit?: () => void;
  onClearSelection?: () => void;
}

function targetIssues(
  issue: IssueSummary,
  selectedIds: Set<string>,
  allIssues: IssueSummary[],
): { ids: string[]; issues: IssueSummary[]; bulk: boolean } {
  const bulk =
    selectedIds.size > 1 && selectedIds.has(issue.id);
  const ids = bulk ? Array.from(selectedIds) : [issue.id];
  const issues = allIssues.filter((row) => ids.includes(row.id));
  return { ids, issues, bulk };
}

function availabilityFor(issues: IssueSummary[]): BulkTriageAvailability {
  return bulkTriageAvailability(issues);
}

export function IssueRowActionsMenu({
  issue,
  issues: allIssues,
  selectedIds,
  busy = false,
  canMerge = false,
  canSplit = false,
  onResolve,
  onIgnore,
  onReopen,
  onSnooze,
  onUnsnooze,
  onAskAi,
  onMarkRead,
  onDeleteRequest,
  onMerge,
  onSplit,
  onClearSelection,
}: IssueRowActionsMenuProps) {
  const { ids, issues, bulk } = targetIssues(issue, selectedIds, allIssues);
  const availability = availabilityFor(issues.length > 0 ? issues : [issue]);
  const count = ids.length;
  const single = issue;
  const snoozed = single.snoozed || single.status === "snoozed";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={bulk ? `Actions for ${count} issues` : `Actions for issue`}
          disabled={busy}
          onClick={(event) => event.stopPropagation()}
        >
          <Icon icon={DotsThree} size={16} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]" onClick={(e) => e.stopPropagation()}>
        {bulk ? (
          <p className="px-2 py-1.5 text-[11px] font-medium text-fg-muted">
            {count} selected
          </p>
        ) : null}

        {availability.resolve ? (
          <DropdownMenuItem disabled={busy} onSelect={() => onResolve(ids)}>
            <Icon icon={Check} size={14} className="mr-2" />
            {bulk ? "Mark resolved" : "Resolve"}
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem disabled={busy} onSelect={() => onMarkRead(ids)}>
          <Icon icon={Eye} size={14} className="mr-2" />
          Mark read
        </DropdownMenuItem>

        <DropdownMenuItem disabled={busy} onSelect={() => onAskAi(bulk ? issues : [issue])}>
          <Icon icon={Sparkle} size={14} className="mr-2" />
          Ask AI
        </DropdownMenuItem>

        {!bulk && snoozed ? (
          <DropdownMenuItem disabled={busy} onSelect={() => onUnsnooze(single.id)}>
            <Icon icon={Bell} size={14} className="mr-2" />
            Unsnooze
          </DropdownMenuItem>
        ) : null}

        {!bulk && !snoozed && canSnoozeIssue(single) ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={busy} className="gap-0">
              <Icon icon={Clock} size={14} className="mr-2 shrink-0" aria-hidden />
              Snooze
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <SnoozeMenuItems pending={busy} onSelect={(mode) => onSnooze(mode, ids)} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}

        {bulk && availability.snooze ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={busy} className="gap-0">
              <Icon icon={Clock} size={14} className="mr-2 shrink-0" aria-hidden />
              Snooze
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <SnoozeMenuItems pending={busy} onSelect={(mode) => onSnooze(mode, ids)} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}

        {availability.ignore ? (
          <DropdownMenuItem disabled={busy} onSelect={() => onIgnore(ids)}>
            <Icon icon={Archive} size={14} className="mr-2" />
            {bulk ? "Ignore selected" : "Ignore"}
          </DropdownMenuItem>
        ) : null}

        {availability.reopen ? (
          <DropdownMenuItem disabled={busy} onSelect={() => onReopen(ids)}>
            <Icon icon={ArrowCounterClockwise} size={14} className="mr-2" />
            {bulk ? "Unresolve selected" : "Reopen"}
          </DropdownMenuItem>
        ) : null}

        {bulk && canMerge && onMerge ? (
          <DropdownMenuItem disabled={busy} onSelect={() => onMerge()}>
            Merge issues
          </DropdownMenuItem>
        ) : null}

        {!bulk && canSplit && onSplit ? (
          <DropdownMenuItem disabled={busy} onSelect={() => onSplit()}>
            Split merged
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-semantic-danger focus:text-semantic-danger"
          disabled={busy}
          onSelect={() => onDeleteRequest(ids)}
        >
          <Icon icon={Trash} size={14} className="mr-2" />
          {bulk ? `Delete ${count} issues` : "Delete issue"}
        </DropdownMenuItem>

        {bulk && onClearSelection ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onClearSelection()}>Clear selection</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
