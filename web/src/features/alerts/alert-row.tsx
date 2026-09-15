import {
  ChevronRight,
  Gauge,
  Sparkles,
  TrendingUp,
  Undo2,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { AlertRow } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format-time";
import { cn } from "../../lib/cn";
import { Badge } from "../../ui/badge";
import { ListRow } from "../../ui/list-row";
import {
  getAlertDetail,
  getAlertRuleName,
  getAlertSeverityForAlert,
  getAlertTitle,
  getIssueLink,
} from "./alert-utils";

export interface AlertListRowProps {
  alert: AlertRow;
  projectId: string;
  compact?: boolean;
}

function AlertKindIcon({ kind }: { kind: string }) {
  const normalizedKind = kind === "velocity" ? "velocity_spike" : kind;
  switch (normalizedKind) {
    case "regression":
      return <Undo2 size={14} strokeWidth={1.75} className="text-semantic-danger" aria-hidden />;
    case "new_issue":
      return <Sparkles size={14} strokeWidth={1.75} className="text-accent" aria-hidden />;
    case "event_milestone":
      return <TrendingUp size={14} strokeWidth={1.75} className="text-semantic-warning" aria-hidden />;
    case "users_affected":
      return <Users size={14} strokeWidth={1.75} className="text-semantic-warning" aria-hidden />;
    case "ingest_cap_hit":
      return <Gauge size={14} strokeWidth={1.75} className="text-semantic-danger" aria-hidden />;
    default:
      return <TrendingUp size={14} strokeWidth={1.75} className="text-semantic-warning" aria-hidden />;
  }
}

export function AlertListRow({ alert, projectId, compact = false }: AlertListRowProps) {
  const title = getAlertTitle(alert);
  const detail = getAlertDetail(alert);
  const ruleName = getAlertRuleName(alert.kind);
  const severity = getAlertSeverityForAlert(alert);
  const firedAt = formatRelativeTime(alert.fired_at);
  const to = getIssueLink(alert, projectId);
  const hasIssue = Boolean(alert.issue_id);

  return (
    <li>
      <ListRow
        asChild
        variant="airy"
        accent={severity === "danger" ? "danger" : "none"}
        className={cn(
          "group min-h-row flex-col gap-1 px-4",
          compact ? "py-2" : "py-2.5",
        )}
      >
        <Link to={to}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-bg-subtle",
                  severity === "danger" && "border-semantic-danger/20 bg-semantic-danger/5",
                  severity === "warning" && "border-semantic-warning/20 bg-semantic-warning/5",
                )}
              >
                <AlertKindIcon kind={alert.kind} />
              </span>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{title}</span>
                  <Badge
                    variant={severity === "danger" ? "error" : "warning"}
                    size="compact"
                    className="shrink-0"
                  >
                    {ruleName}
                  </Badge>
                  {hasIssue ? (
                    <Badge variant="secondary" size="compact" className="shrink-0">
                      Linked issue
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{detail}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-ink-muted">Triggered</p>
                <p className="text-xs font-medium tabular-nums text-ink">{firedAt}</p>
              </div>
              <ChevronRight
                size={16}
                strokeWidth={1.5}
                className="text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                aria-hidden
              />
            </div>
          </div>
        </Link>
      </ListRow>
    </li>
  );
}
