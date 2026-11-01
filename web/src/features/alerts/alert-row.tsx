import { useRef } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { AlertRow } from "../../lib/api";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PolarCard } from "@/components/kit/polar-card";
import { InboxUnreadRail, inboxRowDataAttrs } from "@/components/kit/inbox-read-cue";
import { cn } from "../../lib/cn";
import { formatRelativeTime } from "@/lib/format-time";
import {
  getAlertKindBadgeLabel,
  getAlertKindBadgeVariant,
} from "./alert-kind-visual";
import { getAlertListRuleName, getAlertPayload } from "./alert-utils";

export interface AlertListRowProps {
  alert: AlertRow;
  detailActive?: boolean;
  /** Inbox unread (view state), not API resolved. */
  unread?: boolean;
  bulkSelected?: boolean;
  /** @deprecated Checkboxes are always visible. */
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
  onBulkSelectChange,
  onActivate,
}: AlertListRowProps) {
  if (!alert) {
    return null;
  }

  const ruleName = getAlertListRuleName(alert);
  const firedAt = alert.fired_at ? formatRelativeTime(alert.fired_at) : "-";
  const shiftKeyRef = useRef(false);
  const payload = getAlertPayload(alert);
  const kindForBadge =
    alert.kind === "custom" && typeof payload.rule_kind === "string"
      ? payload.rule_kind
      : alert.kind;
  const kindLabel = getAlertKindBadgeLabel(kindForBadge);
  const kindVariant = getAlertKindBadgeVariant(kindForBadge);

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
                <Box alignItems="center" columnGap="s" minWidth={0} flex={1}>
                  <p
                    className={cn(
                      "min-w-0 truncate text-base leading-snug tracking-ui",
                      unread
                        ? "font-semibold text-accent"
                        : "font-medium text-accent/80",
                    )}
                  >
                    {ruleName}
                    {unread ? <span className="sr-only"> (unread)</span> : null}
                  </p>
                  <Badge
                    variant={kindVariant}
                    size="sm"
                    className="shrink-0"
                  >
                    {kindLabel}
                  </Badge>
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
