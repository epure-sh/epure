import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { AlertRow } from "../../lib/api";
import { ListRow } from "../../ui/list-row";
import {
  formatAlertListTime,
  getAlertDetail,
  getAlertRuleName,
  getAlertSeverityForAlert,
  getAlertTitle,
  getIssueLink,
} from "./alert-utils";

export interface AlertListRowProps {
  alert: AlertRow;
  projectId: string;
}

export function AlertListRow({ alert, projectId }: AlertListRowProps) {
  const title = getAlertTitle(alert);
  const detail = getAlertDetail(alert);
  const ruleName = getAlertRuleName(alert.kind);
  const severity = getAlertSeverityForAlert(alert);
  const firedAt = formatAlertListTime(alert.fired_at);
  const to = getIssueLink(alert, projectId);

  return (
    <li>
      <ListRow
        asChild
        variant="airy"
        accent={severity === "danger" ? "danger" : "none"}
        className="group items-center gap-3 px-4 py-2.5"
      >
        <Link to={to}>
          <span className="w-14 shrink-0 font-mono text-2xs tabular-nums text-ink-muted">
            {firedAt}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">{ruleName}</p>
            <p className="truncate font-mono text-sm font-medium text-ink">{title}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{detail}</p>
          </div>
          <ChevronRight
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
            aria-hidden
          />
        </Link>
      </ListRow>
    </li>
  );
}
