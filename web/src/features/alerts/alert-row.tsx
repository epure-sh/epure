import { useRef } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { AlertRow } from "../../lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { PolarCard } from "@/components/kit/polar-card";
import { InboxUnreadRail, inboxRowDataAttrs } from "@/components/kit/inbox-read-cue";
import { cn } from "../../lib/cn";
import { formatRelativeTime } from "@/lib/format-time";
import { getAlertListRuleName } from "./alert-utils";

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
  const firedAt = alert.fired_at ? formatRelativeTime(alert.fired_at) : "—";
  const shiftKeyRef = useRef(false);

  /** Active detail row: accent outline only, no hover lift. */
  const cardVariant = detailActive
    ? "default"
    : bulkSelected
      ? "selected"
      : onActivate
        ? "interactive"
        : "default";

  return (
    <li className="list-none">
      <div
        data-alert-active={detailActive ? "true" : undefined}
        className={cn(
          "rounded-xl transition-[outline-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
          detailActive && "outline outline-2 -outline-offset-2 outline-accent",
        )}
      >
        <PolarCard
          padding="l"
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
            aria-current={detailActive ? "true" : undefined}
            {...inboxRowDataAttrs(unread)}
          >
            <InboxUnreadRail unread={unread} />
            <Box alignItems="center" columnGap="m" width="100%" minHeight={40}>
              {onBulkSelectChange ? (
                <div
                  className="relative z-[1] flex size-4 shrink-0 items-center justify-center self-center"
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
                <span className="size-4 shrink-0 self-center" aria-hidden />
              )}

              <Box alignItems="center" columnGap="s" minWidth={0} flex={1}>
                <Box minWidth={0} flex={1}>
                  <Text
                    as="p"
                    variant={unread ? "title" : "default"}
                    color={unread ? "default" : "muted"}
                    truncate
                  >
                    {ruleName}
                    {unread ? <span className="sr-only"> (unread)</span> : null}
                  </Text>
                </Box>
                <time dateTime={alert.fired_at ?? undefined} className="shrink-0">
                  <Text as="span" variant="caption" color="muted" tabularNums>
                    {firedAt}
                  </Text>
                </time>
              </Box>
            </Box>
          </div>
        </PolarCard>
      </div>
    </li>
  );
}
