import type * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Icon,
  Info,
  Warning,
  WarningCircle,
  WarningOctagon,
} from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  InboxUnreadRail,
  inboxMetaClass,
  inboxPrimaryTitleClass,
  inboxSecondaryLineClass,
  inboxRowDataAttrs,
} from "@/components/kit/inbox-read-cue";

/** Shared with the column header so checkbox clicks shift 0 pixels. */
export const ISSUE_ROW_GRID =
  "grid-cols-[16px_minmax(0,1fr)_5.25rem_4.25rem_4.5rem_4rem_4rem_2rem] gap-x-3";

/** Locked feed row height — matches title + subtitle + lifecycle cue (snoozed / came back line). */
export const ISSUE_FEED_ROW_HEIGHT_CLASS =
  "h-[4.625rem] max-h-[4.625rem] min-h-[4.625rem] overflow-hidden";

export type IssueRowPriority = "critical" | "high" | "medium" | "low";

const PRIORITY_ICON: Record<
  IssueRowPriority,
  { icon: typeof WarningOctagon; className: string; weight: "fill" | "regular" }
> = {
  critical: { icon: WarningOctagon, className: "text-semantic-danger", weight: "fill" },
  high: { icon: WarningCircle, className: "text-semantic-danger", weight: "fill" },
  medium: { icon: Warning, className: "text-semantic-warning", weight: "regular" },
  low: { icon: Info, className: "text-fg-muted", weight: "regular" },
};

const PRIORITY_LABEL: Record<IssueRowPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function IssueRowPriorityIcon({ priority }: { priority: IssueRowPriority }) {
  const { icon, className, weight } = PRIORITY_ICON[priority];
  return (
    <span
      className="inline-flex items-center justify-end"
      title={`${PRIORITY_LABEL[priority]} priority`}
    >
      <Icon icon={icon} size={16} weight={weight} className={className} aria-hidden />
      <span className="sr-only">{PRIORITY_LABEL[priority]} priority</span>
    </span>
  );
}

export interface IssueRowShellProps {
  id: string;
  bulkSelected?: boolean;
  focused?: boolean;
  detailActive?: boolean;
  onSelectChange?: (selected: boolean) => void;
  escalating?: boolean;
  priority?: IssueRowPriority;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  lifecycle?: React.ReactNode;
  eventsCount?: number | string;
  usersCount?: number | string;
  timeAgo?: string;
  age?: string;
  rowActions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  tourAnchor?: boolean;
  unread?: boolean;
  /** Any issue in the list is bulk-selected — show checkboxes on every row. */
  selectionActive?: boolean;
}

export function IssueRowShell({
  id: _id,
  bulkSelected = false,
  focused = false,
  detailActive = false,
  onSelectChange,
  escalating = false,
  priority = "low",
  title,
  subtitle,
  lifecycle,
  eventsCount,
  usersCount,
  timeAgo,
  age,
  rowActions,
  onClick,
  className,
  tourAnchor = false,
  unread = false,
  selectionActive = false,
}: IssueRowShellProps) {
  const tone = escalating ? "critical" : priority;
  const checkboxChecked = bulkSelected;

  return (
    <div
      data-slot="issue-row-shell"
      data-escalating={escalating}
      data-focused={focused}
      data-detail-active={detailActive}
      data-priority={tone}
      data-tour={tourAnchor ? "issue-row-sample" : undefined}
      {...inboxRowDataAttrs(unread)}
      onClick={onClick}
      className={cn(
        "epure-feed-row group relative grid w-full items-center border-b border-border-subtle px-3 text-xs transition-colors duration-100 cursor-pointer select-none",
        ISSUE_FEED_ROW_HEIGHT_CLASS,
        ISSUE_ROW_GRID,
        detailActive && "bg-accent-muted",
        bulkSelected && !detailActive && "bg-accent-muted/70",
        className,
      )}
    >
      <InboxUnreadRail unread={unread} />
      <div
        className="flex size-4 shrink-0 items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <Checkbox
          checked={checkboxChecked}
          onCheckedChange={(value) => onSelectChange?.(Boolean(value))}
          aria-label={checkboxChecked ? "Deselect issue" : "Select issue"}
          className={cn(
            "transition-opacity duration-75",
            bulkSelected || selectionActive
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
          )}
        />
      </div>

      <div className="flex min-h-0 min-w-0 items-center self-stretch overflow-hidden pr-2">
        <div className="flex min-w-0 flex-col justify-center gap-0.5">
          <span className={inboxPrimaryTitleClass(unread, "block truncate leading-tight")}>{title}</span>
          {unread ? <span className="sr-only">Unread. </span> : null}
          {subtitle ? (
            <p
              className={inboxSecondaryLineClass(
                unread,
                "truncate font-mono text-[11px] leading-tight",
              )}
            >
              {subtitle}
            </p>
          ) : null}
          {lifecycle}
        </div>
      </div>

      <div className={inboxMetaClass(unread, "flex items-center justify-end text-right")}>{timeAgo}</div>
      <div className={inboxMetaClass(unread, "flex items-center justify-end text-right")}>{age ?? "—"}</div>

      <div className={inboxMetaClass(unread, "flex items-center justify-end text-right")}>
        {eventsCount !== undefined ? <span>{eventsCount}</span> : null}
      </div>
      <div className={inboxMetaClass(unread, "flex items-center justify-end text-right")}>
        {usersCount !== undefined ? <span>{usersCount}</span> : null}
      </div>

      <div className="flex items-center justify-end">
        <IssueRowPriorityIcon priority={tone} />
      </div>

      <div className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
        {rowActions}
      </div>
    </div>
  );
}
