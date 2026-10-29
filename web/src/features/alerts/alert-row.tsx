import { useRef } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { AlertRow } from "../../lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { PolarCard } from "@/components/kit/polar-card";
import { InboxUnreadRail, inboxRowDataAttrs } from "@/components/kit/inbox-read-cue";
import { cn } from "../../lib/cn";
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
  /** @deprecated Table embed — card list is default. */
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
  onBulkSelectChange,
  onActivate,
}: AlertListRowProps) {
  if (!alert) {
    return null;
  }

  const ruleName = getAlertListRuleName(alert);
  const issueLine = getAlertListIssueLine(alert);
  const firedAt = formatAlertListTime(alert.fired_at);
  const shiftKeyRef = useRef(false);

  const cardVariant =
    detailActive || bulkSelected ? "selected" : onActivate ? "interactive" : "default";

  return (
    <li className="list-none">
      <PolarCard
        padding="m"
        variant={cardVariant}
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
      >
        <div
          className="group relative w-full rounded-xl pl-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-alert-id={alert.id}
          data-focused={detailActive || undefined}
          {...inboxRowDataAttrs(unread)}
        >
          {/* Rail sits in the pl-2.5 gutter so it never overlaps the checkbox. */}
          <InboxUnreadRail unread={unread} />
          <Box alignItems="center" columnGap="m" width="100%">
            {onBulkSelectChange ? (
              <div
                className="relative z-[1] flex size-4 shrink-0 items-center justify-center"
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
              <span className="size-4 shrink-0" aria-hidden />
            )}

            <Box flexDirection="column" rowGap="xs" minWidth={0} flex={1}>
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

            <time dateTime={alert.fired_at ?? undefined} className="shrink-0 text-right">
              <Text as="span" variant="caption" color="muted" monospace tabularNums>
                {firedAt}
              </Text>
            </time>
          </Box>
        </div>
      </PolarCard>
    </li>
  );
}
