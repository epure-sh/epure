import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { AlertRow } from "../../lib/api";
import { cn } from "../../lib/cn";
import { ActionButton } from "../../ui/action-button";
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
    <li>
      <ListRow
        variant="flat"
        accent={unread ? "signal" : severity === "danger" ? "danger" : "none"}
        data-alert-id={alert.id}
        className={cn(
          "group items-center gap-3 px-4 py-2.5",
          selected && "bg-accent-muted",
          unread && "epure-issue-row--unread",
        )}
      >
        <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 focus-ring rounded-md">
          <span className="w-14 shrink-0 font-mono text-2xs tabular-nums text-ink-muted">
            {firedAt}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">{ruleName}</p>
            <p
              className={cn(
                "truncate font-mono text-sm",
                unread ? "font-semibold text-ink" : "font-medium text-ink-muted",
              )}
            >
              {title}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{detail}</p>
          </div>
          <ChevronRight
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
            aria-hidden
          />
        </Link>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
