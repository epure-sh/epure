import { getIssuesListSubtitle, getIssuesListTitle, type TimeWindowValue } from "./query-utils";

export interface IssuesListHeaderProps {
  query: string;
  count: number;
  loading: boolean;
  timeWindow?: TimeWindowValue;
}

/** Title + subtitle for the Issues chrome band. Bulk select-all lives in the list column header. */
export function IssuesListHeader({
  query,
  count,
  loading,
  timeWindow,
}: IssuesListHeaderProps) {
  const title = getIssuesListTitle(query);
  const subtitle = getIssuesListSubtitle(query, count, loading, timeWindow);

  return (
    <div className="min-w-0">
      <p className="epure-section-header-title truncate font-medium tracking-ui text-ink">{title}</p>
      <p className="truncate text-xs text-ink-muted">{subtitle}</p>
    </div>
  );
}
