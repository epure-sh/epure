import { useRef } from "react";
import type { AlertRow } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { AlertInboxLifecycleCue } from "@/components/kit/inbox-lifecycle-cue";
import {
  ALERT_FEED_ROW_HEIGHT_CLASS,
  InboxUnreadRail,
  inboxPrimaryTitleClass,
  inboxRowDataAttrs,
  inboxSecondaryLineClass,
} from "@/components/kit/inbox-read-cue";
import { cn } from "../../lib/cn";
import { alertKindIconColorClass, getAlertKindIcon, getAlertKindVisualTone } from "./alert-kind-visual";
import { ALERT_FEED_CARD_ROW_GRID, ALERT_ROW_GRID } from "./alert-list-column-header";
import { AlertStateBadge } from "./alert-state-badge";
import {
  formatAlertListTime,
  getAlertListIssueLine,
  getAlertListProofSnippet,
  getAlertListRuleName,
} from "./alert-utils";

export interface AlertListRowProps {
  alert: AlertRow;
  detailActive?: boolean;
  /** Inbox unread (view state), not API resolved. */
  unread?: boolean;
  bulkSelected?: boolean;
  /** When any alert is selected, show checkboxes on every row (Issues feed parity). */
  selectionActive?: boolean;
  layout?: "feed" | "embedded";
  onBulkSelectChange?: (selected: boolean, options?: { shiftKey?: boolean }) => void;
  onActivate?: () => void;
}

export function AlertListRow({
  alert,
  bulkSelected = false,
  detailActive = false,
  unread = false,
  selectionActive = false,
  layout = "feed",
  onBulkSelectChange,
  onActivate,
}: AlertListRowProps) {
  if (!alert) {
    return null;
  }

  const ruleName = getAlertListRuleName(alert);
  const issueLine = layout === "embedded" ? getAlertListIssueLine(alert) : null;
  const proofSnippet = layout === "embedded" ? getAlertListProofSnippet(alert) : null;
  const firedAt = formatAlertListTime(alert.fired_at);
  const singleLineFeed = layout === "feed";
  const embedded = layout === "embedded";
  const shiftKeyRef = useRef(false);
  const KindIcon = getAlertKindIcon(alert.kind);
  const iconTone = getAlertKindVisualTone(alert.kind);
  const rowGrid = embedded ? ALERT_ROW_GRID : ALERT_FEED_CARD_ROW_GRID;

  const row = (
    <article
      data-alert-id={alert.id}
      {...inboxRowDataAttrs(unread)}
      className={cn(
        "group relative grid w-full items-center gap-x-3 px-4 py-0 text-left transition-colors sm:gap-x-3.5",
        rowGrid,
        ALERT_FEED_ROW_HEIGHT_CLASS,
        embedded
          ? cn(
              "epure-feed-row border-b border-border-subtle",
              detailActive && "bg-accent-muted",
              !detailActive && bulkSelected && "bg-accent-muted/70",
              !detailActive && !bulkSelected && "hover:bg-state-hover",
            )
          : cn(
              "rounded-md border border-border-subtle bg-surface-1",
              detailActive && "border-border bg-accent-muted shadow-sm",
              !detailActive && bulkSelected && "bg-accent-muted/70",
              !detailActive && !bulkSelected && "hover:border-border hover:bg-state-hover",
              !unread && !detailActive && "border-border-subtle/90",
            ),
      )}
    >
      <InboxUnreadRail unread={unread} />
      {onBulkSelectChange ? (
        <div
          className="flex size-4 shrink-0 items-center justify-center self-center"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={bulkSelected}
            aria-label={bulkSelected ? "Deselect alert" : "Select alert"}
            className={cn(
              "transition-opacity duration-75",
              bulkSelected || selectionActive
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            )}
            onPointerDown={(event) => {
              shiftKeyRef.current = event.shiftKey;
            }}
            onCheckedChange={(value) => {
              onBulkSelectChange?.(value === true, { shiftKey: shiftKeyRef.current });
            }}
          />
        </div>
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}

      {!embedded ? (
        <div
          className={cn(
            "flex size-5 shrink-0 items-center justify-center self-center",
            alertKindIconColorClass[iconTone],
            unread && iconTone === "neutral" && "text-accent",
            !unread && "opacity-80",
          )}
          aria-hidden
        >
          <Icon icon={KindIcon} size={16} weight={unread ? "fill" : "regular"} />
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        onClick={onActivate}
        className={cn(
          "min-h-0 min-w-0 px-0 text-left hover:bg-transparent",
          singleLineFeed
            ? "flex h-full items-center"
            : "h-auto flex-col items-stretch justify-center gap-1 py-0.5",
        )}
      >
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          <p className={inboxPrimaryTitleClass(unread, "min-w-0 flex-1 truncate")}>
            {ruleName}
            {unread ? <span className="sr-only"> (unread)</span> : null}
          </p>
          <time
            dateTime={alert.fired_at ?? undefined}
            className={cn(
              "shrink-0 font-mono text-[11px] tabular-nums",
              unread ? "text-fg-secondary" : "text-fg-muted/80",
            )}
          >
            {firedAt}
          </time>
        </div>
        {issueLine ? (
          <p className={inboxSecondaryLineClass(unread, "font-mono text-[11px] leading-snug")}>
            {issueLine}
          </p>
        ) : null}
        {embedded ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <AlertStateBadge alert={alert} showOpenDuration className="max-w-full truncate" />
            {proofSnippet ? (
              <span className="font-mono text-[11px] tabular-nums text-fg-muted">{proofSnippet}</span>
            ) : null}
          </div>
        ) : null}
        {!singleLineFeed && !embedded ? <AlertInboxLifecycleCue alert={alert} /> : null}
      </Button>
    </article>
  );

  if (layout === "embedded") {
    return row;
  }

  return <li>{row}</li>;
}
