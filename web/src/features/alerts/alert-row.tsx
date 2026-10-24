import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { AlertRow } from "../../lib/api";
import { cn } from "../../lib/cn";
import { ActionButton } from "../../ui/action-button";
import { Badge } from "../../ui/badge";
import { ListRow } from "../../ui/list-row";
import {
  formatAlertListTime,
  getAlertDetail,
  getAlertRuleName,
  getAlertSeverityForAlert,
  getAlertTitle,
  getIssueLink,
  isAlertUnread,
} from "./alert-utils";

export interface AlertListRowProps {
  alert: AlertRow;
  projectId: string;
  selected?: boolean;
  onMarkRead: () => void;
  onIgnore: () => void;
  onUnignore: () => void;
}

export function AlertListRow({
  alert,
  projectId,
  selected = false,
  onMarkRead,
  onIgnore,
  onUnignore,
}: AlertListRowProps) {
  const title = getAlertTitle(alert);
  const detail = getAlertDetail(alert);
  const ruleName = getAlertRuleName(alert.kind);
  const severity = getAlertSeverityForAlert(alert);
  const firedAt = formatAlertListTime(alert.fired_at);
  const to = getIssueLink(alert, projectId);
  const unread = isAlertUnread(alert);

  return (
    <li className="border-b border-border-subtle last:border-b-0">
      <ListRow
        variant="flat"
        accent={unread ? "signal" : severity === "danger" ? "danger" : "none"}
        data-alert-id={alert.id}
        className={cn(
          "group items-center gap-3 px-4 py-2.5",
          selected ? "bg-surface-2" : "bg-surface-1 hover:bg-surface-2/60",
          unread && "font-medium",
          alert.ignored && "opacity-60",
        )}
      >
        <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 focus-ring rounded-md">
          <span className="w-16 shrink-0 font-mono text-2xs tabular-nums text-fg-muted">
            {firedAt}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-2xs font-medium uppercase tracking-wide text-fg-muted">{ruleName}</p>
              {alert.ignored && (
                <Badge variant="neutral" size="compact" className="text-[10px] h-4">
                  Ignored
                </Badge>
              )}
            </div>
            <p
              className={cn(
                "truncate font-mono text-sm",
                unread ? "font-semibold text-fg-primary" : "font-medium text-fg-secondary",
              )}
            >
              {title}
            </p>
            <p className="mt-0.5 truncate text-xs text-fg-muted">{detail}</p>
          </div>
          <ChevronRight
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg-primary"
            aria-hidden
          />
        </Link>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 transition-opacity",
            selected
              ? "opacity-100"
              : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-within:opacity-100",
          )}
        >
          {alert.ignored ? (
            <ActionButton variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onUnignore}>
              Unignore
            </ActionButton>
          ) : (
            <>
              {unread ? (
                <ActionButton variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onMarkRead}>
                  Mark read
                </ActionButton>
              ) : null}
              <ActionButton variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onIgnore}>
                Ignore
              </ActionButton>
            </>
          )}
        </div>
      </ListRow>
    </li>
  );
}
