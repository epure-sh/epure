import { useRef } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { AlertRow } from "../../lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import {
  ALERT_FEED_ROW_HEIGHT_CLASS,
  InboxUnreadRail,
  inboxRowDataAttrs,
} from "@/components/kit/inbox-read-cue";
import { cn } from "../../lib/cn";
import { alertKindIconColorClass, getAlertKindIcon, getAlertKindVisualTone } from "./alert-kind-visual";
import {
  ALERT_FEED_CARD_ROW_GRID,
  ALERT_LIST_INSET_CLASS,
  ALERT_ROW_GRID,
} from "./alert-list-column-header";
import {
  formatAlertListTime,
  getAlertListIssueLine,
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
  const issueLine = getAlertListIssueLine(alert);
  const firedAt = formatAlertListTime(alert.fired_at);
  const embedded = layout === "embedded";
  const shiftKeyRef = useRef(false);
  const KindIcon = getAlertKindIcon(alert.kind);
  const iconTone = getAlertKindVisualTone(alert.kind);
  const rowGrid = embedded ? ALERT_ROW_GRID : ALERT_FEED_CARD_ROW_GRID;

  const row = (
    <Box
      as="article"
      data-alert-id={alert.id}
      data-focused={detailActive || undefined}
      {...inboxRowDataAttrs(unread)}
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={
        onActivate
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
      width="100%"
      alignItems="start"
      transitionProperty="common"
      transitionDuration="fast"
      ease="decelerate"
      backgroundColor={
        detailActive || bulkSelected
          ? "background-secondary"
          : { base: "background-primary", hover: "background-secondary" }
      }
      cursor={onActivate ? { hover: "pointer" } : undefined}
      className={cn(
        "group relative grid w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        ALERT_LIST_INSET_CLASS,
        rowGrid,
        ALERT_FEED_ROW_HEIGHT_CLASS,
        "py-2.5",
        embedded
          ? "epure-feed-row border-b border-border-subtle"
          : cn(
              "epure-feed-row rounded-md border border-border-subtle",
              detailActive && "border-border shadow-sm",
              !unread && !detailActive && "border-border-subtle/90",
            ),
      )}
    >
      <InboxUnreadRail unread={unread} />
      {onBulkSelectChange ? (
        <div
          className="flex size-4 shrink-0 items-center justify-center self-start pt-0.5"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={bulkSelected}
            aria-label={bulkSelected ? "Deselect alert" : "Select alert"}
            className={cn(
              "transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)]",
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
        <span className="size-4 shrink-0 self-start" aria-hidden />
      )}

      {!embedded ? (
        <div
          className={cn(
            "flex size-5 shrink-0 items-center justify-center self-start pt-0.5",
            alertKindIconColorClass[iconTone],
            unread && iconTone === "neutral" && "text-accent",
            !unread && "opacity-80",
          )}
          aria-hidden
        >
          <Icon icon={KindIcon} size={16} weight={unread ? "fill" : "regular"} />
        </div>
      ) : null}

      <Box flexDirection="column" rowGap="xs" minWidth={0} width="100%">
        <Text
          as="p"
          variant={unread ? "title" : "default"}
          color={unread ? "default" : "muted"}
          truncate
        >
          {ruleName}
          {unread ? <span className="sr-only"> (unread)</span> : null}
        </Text>
        {issueLine ? (
          <Text as="p" variant="caption" color="muted" monospace truncate>
            {issueLine}
          </Text>
        ) : null}
      </Box>

      <time
        dateTime={alert.fired_at ?? undefined}
        className="shrink-0 self-start pt-0.5 text-right"
      >
        <Text as="span" variant="caption" color="muted" monospace tabularNums>
          {firedAt}
        </Text>
      </time>
    </Box>
  );

  if (layout === "embedded") {
    return row;
  }

  return <li>{row}</li>;
}
