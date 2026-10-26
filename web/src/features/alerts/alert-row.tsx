import { useRef } from "react";
import type { AlertRow } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "../../lib/cn";
import { AlertStateBadge } from "./alert-state-badge";
import {
  formatAlertListTime,
  getAlertDetail,
  getAlertRuleDisplayName,
  getAlertSignalState,
  getAlertTitle,
  isAlertUnread,
} from "./alert-utils";

export interface AlertListRowProps {
  alert: AlertRow;
  detailActive?: boolean;
  bulkSelected?: boolean;
  /** `embedded` drops outer list padding (design kit / split panes). */
  layout?: "feed" | "embedded";
  onBulkSelectChange?: (selected: boolean, options?: { shiftKey?: boolean }) => void;
  onActivate?: () => void;
}

function rowTone(state: ReturnType<typeof getAlertSignalState>): string {
  switch (state) {
    case "firing":
      return "border-border-subtle border-l-2 border-l-accent bg-surface-1";
    case "fired":
      return "border-border-subtle border-l-2 border-l-border-strong bg-surface-1";
    case "acknowledged":
      return "border-border-subtle border-l-2 border-l-transparent bg-bg-subtle/30";
    case "muted":
      return "border-border-subtle border-l-2 border-l-transparent bg-transparent opacity-80";
  }
}

export function AlertListRow({
  alert,
  bulkSelected = false,
  detailActive = false,
  layout = "feed",
  onBulkSelectChange,
  onActivate,
}: AlertListRowProps) {
  if (!alert) {
    return null;
  }

  const title = getAlertTitle(alert);
  const detail = getAlertDetail(alert);
  const ruleName = getAlertRuleDisplayName(alert);
  const firedAt = formatAlertListTime(alert.fired_at);
  const unread = isAlertUnread(alert);
  const state = getAlertSignalState(alert);
  const shiftKeyRef = useRef(false);

  const article = (
      <article
        data-alert-id={alert.id}
        className={cn(
          "flex items-stretch gap-2 rounded-md border px-2.5 py-2 transition-colors",
          rowTone(state),
          detailActive && "bg-accent-muted/30 ring-1 ring-accent/25",
          bulkSelected && !detailActive && "bg-accent-muted/20",
        )}
      >
        <div className="flex shrink-0 items-start pt-0.5">
          <Checkbox
            checked={bulkSelected}
            aria-label={`Select alert ${title}`}
            onPointerDown={(event) => {
              shiftKeyRef.current = event.shiftKey;
            }}
            onCheckedChange={(value) => {
              onBulkSelectChange?.(value === true, { shiftKey: shiftKeyRef.current });
            }}
            onClick={(event) => event.stopPropagation()}
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={onActivate}
          className="h-auto min-w-0 flex-1 flex-col items-start gap-0.5 rounded-sm py-0.5 text-left active:translate-y-0"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <AlertStateBadge alert={alert} />
            <span className="font-mono text-2xs tabular-nums text-fg-muted">{firedAt}</span>
            <span className="truncate text-2xs text-fg-muted">{ruleName}</span>
          </div>
          <p
            className={cn(
              "text-sm leading-snug [overflow-wrap:anywhere]",
              unread ? "font-semibold text-fg-primary" : "font-medium text-fg-secondary",
            )}
          >
            {title}
          </p>
          <p className="line-clamp-1 text-xs text-fg-muted">{detail}</p>
        </Button>
      </article>
  );

  if (layout === "embedded") {
    return article;
  }

  return <li className="px-4 md:px-6">{article}</li>;
}
