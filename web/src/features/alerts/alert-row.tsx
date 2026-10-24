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
  onMarkUnread?: () => void;
  onIgnore: () => void;
  onUnignore: () => void;
}

export function AlertListRow({
  alert,
  projectId,
  selected = false,
  onMarkRead,
  onMarkUnread,
  onIgnore,
  onUnignore,
}: AlertListRowProps) {
  if (!alert) {
    return null;
  }

  const title = getAlertTitle(alert);
  const detail = getAlertDetail(alert);
  const ruleName = getAlertRuleName(alert.kind);
  const severity = getAlertSeverityForAlert(alert);
  const firedAt = formatAlertListTime(alert.fired_at);
  const to = getIssueLink(alert, alert.project_id || projectId);
  const unread = isAlertUnread(alert);
  const isIgnored = Boolean(alert.ignored);

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
          isIgnored && "opacity-60",
        )}
      >
        <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 focus-ring rounded-md">
          <span className="w-24 sm:w-28 shrink-0 font-mono text-2xs tabular-nums text-fg-muted whitespace-nowrap">
            {firedAt}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-2xs font-medium uppercase tracking-wide text-fg-muted">{ruleName}</p>
              {isIgnored ? (
                <Badge variant="warning" size="compact" className="text-[10px] h-4">
                  Muted
                </Badge>
              ) : !unread ? (
                <Badge variant="neutral" size="compact" className="text-[10px] h-4">
                  Resolved
                </Badge>
              ) : null}
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
              : "opacity-100 sm:opacity-70 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-within:opacity-100",
          )}
        >
          {isIgnored ? (
            <ActionButton
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-fg-muted hover:text-fg-primary"
              onClick={onUnignore}
              title="Unmute alert rule"
              aria-label="Unmute alert"
            >
              Unmute
            </ActionButton>
          ) : unread ? (
            <>
              <ActionButton
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onMarkRead}
                title="Resolve alert (mark as read)"
                aria-label="Resolve alert"
              >
                Resolve
              </ActionButton>
              <ActionButton
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-fg-muted hover:text-fg-primary"
                onClick={onIgnore}
                title="Mute alert rule for this issue"
                aria-label="Mute alert"
              >
                Mute
              </ActionButton>
            </>
          ) : (
            <>
              {onMarkUnread ? (
                <ActionButton
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-fg-muted hover:text-fg-primary"
                  onClick={onMarkUnread}
                  title="Unresolve alert (mark as unread)"
                  aria-label="Unresolve alert"
                >
                  Unresolve
                </ActionButton>
              ) : null}
              <ActionButton
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-fg-muted hover:text-fg-primary"
                onClick={onIgnore}
                title="Mute alert rule for this issue"
                aria-label="Mute alert"
              >
                Mute
              </ActionButton>
            </>
          )}
        </div>
      </ListRow>
    </li>
  );
}
