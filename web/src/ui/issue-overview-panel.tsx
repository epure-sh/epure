import type { ReactNode } from "react";
import type { EventDetail, IssueSummary } from "../lib/api";
import { cn } from "../lib/cn";
import { Badge } from "./badge";
import { EventHttpRequest } from "./event-http-request";
import { IssueAiCopilotCard } from "./issue-ai-copilot-card";
import { Section } from "./section";

export interface IssueOverviewPanelProps {
  issue: IssueSummary;
  event: EventDetail | null;
  events: EventDetail[];
  /** @deprecated Timeline lives in the pinned header popover. */
  timeline?: unknown;
  timelineLoading?: boolean;
  timelineWindow?: string;
  onTimelineWindowChange?: (window: string) => void;
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string, event?: EventDetail) => void;
  spacious?: boolean;
}

function formatSnoozeBanner(issue: IssueSummary): string | null {
  if (!issue.snoozed) {
    return null;
  }

  if (issue.snooze_until) {
    return `Snoozed until ${new Date(issue.snooze_until).toLocaleString()}`;
  }

  if (issue.snooze_until_count != null) {
    const remaining = Math.max(0, issue.snooze_until_count - issue.event_count);
    return remaining === 1
      ? "Snoozed — 1 more event before alerts resume"
      : `Snoozed — ${remaining} more events before alerts resume`;
  }

  if (issue.snooze_until_users != null) {
    const remaining = Math.max(0, issue.snooze_until_users - issue.unique_user_count);
    return remaining === 1
      ? "Snoozed — 1 more user before alerts resume"
      : `Snoozed — ${remaining} more users before alerts resume`;
  }

  return "Snoozed";
}

function formatOverviewLead(issue: IssueSummary): string | null {
  if (issue.status === "regression") {
    if (issue.resolved_in_release && issue.release) {
      return `Resolved in ${issue.resolved_in_release}, came back in ${issue.release}`;
    }
    if (issue.release) {
      return `Came back in ${issue.release}`;
    }
    return "This exception returned after resolve";
  }
  if (issue.snoozed) {
    return formatSnoozeBanner(issue) ?? "Snoozed";
  }
  if (issue.status === "resolved") {
    return "Resolved. Reopen it if it is still happening.";
  }
  if (issue.is_escalating_3d) {
    return "Rising fast. Resolve it or snooze it if you already know the cause.";
  }
  return null;
}

function environmentVariant(env: string): "env" | "warning" | "neutral" {
  const value = env.toLowerCase();
  if (value === "production" || value === "prod") {
    return "env";
  }
  if (value === "staging" || value === "preview") {
    return "warning";
  }
  return "neutral";
}

function userLabel(event: EventDetail): string {
  return event.user_email ?? event.user_id ?? "Anonymous";
}

function userHitCount(events: EventDetail[], event: EventDetail | null): number | null {
  if (!event) return null;
  const key = event.user_email ?? event.user_id;
  if (!key) return null;
  const hits = events.filter((row) => (row.user_email ?? row.user_id) === key).length;
  return hits > 0 ? hits : null;
}

function runtimeLabel(event: EventDetail): string {
  const parts = [
    event.runtime_name && event.runtime_version
      ? `${event.runtime_name} ${event.runtime_version}`
      : event.runtime_name,
    event.browser_name,
    event.os_name,
    event.platform,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function eventTags(event: EventDetail | null): string[] {
  if (!event) return [];
  const tags: string[] = [];
  const payload = event.payload_json ?? {};
  const rawTags = payload.tags;

  if (Array.isArray(rawTags)) {
    for (const entry of rawTags) {
      if (Array.isArray(entry) && entry.length >= 2) {
        tags.push(`${String(entry[0])}:${String(entry[1])}`);
      } else if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        if (record.key != null && record.value != null) {
          tags.push(`${String(record.key)}:${String(record.value)}`);
        }
      }
    }
  } else if (rawTags && typeof rawTags === "object") {
    for (const [key, value] of Object.entries(rawTags as Record<string, unknown>)) {
      if (value == null) continue;
      tags.push(`${key}:${String(value)}`);
    }
  }

  const extras = payload.extra;
  if (extras && typeof extras === "object" && !Array.isArray(extras)) {
    for (const [key, value] of Object.entries(extras as Record<string, unknown>)) {
      if (value == null || typeof value === "object") continue;
      tags.push(`${key}:${String(value)}`);
    }
  }

  if (event.browser_name) tags.push(`browser:${event.browser_name}`);
  if (event.os_name) tags.push(`os:${event.os_name}`);
  if (event.platform) tags.push(`platform:${event.platform}`);

  return [...new Set(tags)].slice(0, 24);
}

interface DistributionBucket {
  label: string;
  count: number;
  percent: number;
}

function buildDistribution(
  events: EventDetail[],
  pick: (event: EventDetail) => string | null | undefined,
): DistributionBucket[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const label = pick(event)?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function DistributionBars({
  title,
  buckets,
  emptyHint,
}: {
  title: string;
  buckets: DistributionBucket[];
  emptyHint: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="font-mono text-2xs uppercase tracking-wide text-fg-muted">{title}</h4>
      {buckets.length === 0 ? (
        <p className="text-xs text-fg-muted">{emptyHint}</p>
      ) : (
        <ul className="space-y-1.5">
          {buckets.map((bucket) => (
            <li key={bucket.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-mono text-fg-primary" title={bucket.label}>
                  {bucket.label}
                </span>
                <span className="shrink-0 tabular-nums text-fg-muted">{bucket.percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                <div
                  className="h-full rounded-full bg-fg-muted/45"
                  style={{ width: `${Math.max(bucket.percent, 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OccurrenceCard({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-border-subtle bg-surface-1 px-3 py-2.5 shadow-xs",
        className,
      )}
    >
      <p className="mb-1 font-mono text-2xs uppercase tracking-wide text-fg-muted">{label}</p>
      <div className="text-sm leading-snug text-fg-primary [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

export function IssueOverviewPanel({ issue, event, events }: IssueOverviewPanelProps) {
  const overviewLead = formatOverviewLead(issue);
  const hits = userHitCount(events, event);
  const tags = eventTags(event);
  const browserDist = buildDistribution(events, (row) => row.browser_name);
  const envDist = buildDistribution(events, (row) => row.environment);
  const releaseDist = buildDistribution(events, (row) => row.release);
  const introduced =
    event?.release &&
    (issue.first_release === event.release ||
      (!issue.came_back && issue.release === event.release));

  return (
    <div className="epure-overview">
      <Section className="space-y-5 px-4 py-4 md:px-5">
        {overviewLead ? (
          <p className="text-sm leading-relaxed text-fg-secondary">{overviewLead}</p>
        ) : null}

        {!event ? (
          <p className="text-xs text-fg-muted">Select an occurrence to inspect its context.</p>
        ) : (
          <>
            <section className="space-y-2" aria-label="Occurrence environment">
              <h3 className="font-mono text-2xs uppercase tracking-wide text-fg-muted">
                Environment
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <OccurrenceCard label="User">
                  <span className="font-mono text-xs">{userLabel(event)}</span>
                  {hits != null && hits > 1 ? (
                    <span className="mt-1 block text-2xs text-fg-muted">{hits} hits in loaded set</span>
                  ) : null}
                </OccurrenceCard>
                <OccurrenceCard label="Runtime">
                  <span className="text-xs text-fg-secondary">{runtimeLabel(event)}</span>
                </OccurrenceCard>
                <OccurrenceCard label="Release">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {event.release ? (
                      <Badge
                        variant="neutral"
                        size="compact"
                        className="max-w-full font-mono-slash font-normal"
                      >
                        <span className="[overflow-wrap:anywhere]">{event.release}</span>
                      </Badge>
                    ) : (
                      <span className="text-fg-muted">—</span>
                    )}
                    {event.environment ? (
                      <Badge
                        variant={environmentVariant(event.environment)}
                        size="compact"
                        className="font-mono font-normal"
                      >
                        {event.environment}
                      </Badge>
                    ) : null}
                    {introduced ? (
                      <Badge variant="warning" size="compact">
                        introduced
                      </Badge>
                    ) : null}
                  </div>
                </OccurrenceCard>
              </div>
            </section>

            <div className="border-t border-border-subtle pt-5">
              <EventHttpRequest event={event} />
            </div>

            {tags.length > 0 ? (
              <section className="space-y-2 border-t border-border-subtle pt-5" aria-label="Tags">
                <h3 className="font-mono text-2xs uppercase tracking-wide text-fg-muted">
                  Tags / extra
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="env" size="compact" className="font-mono font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-4 border-t border-border-subtle pt-5" aria-label="Distributions">
              <h3 className="font-mono text-2xs uppercase tracking-wide text-fg-muted">
                Distributions
              </h3>
              {events.length < 2 ? (
                <p className="text-xs text-fg-muted">
                  Load more occurrences to estimate browser, environment, and release mix.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <DistributionBars
                    title="Browser"
                    buckets={browserDist}
                    emptyHint="No browser data"
                  />
                  <DistributionBars
                    title="Environment"
                    buckets={envDist}
                    emptyHint="No environment data"
                  />
                  <DistributionBars
                    title="Release"
                    buckets={releaseDist}
                    emptyHint="No release data"
                  />
                </div>
              )}
            </section>
          </>
        )}
      </Section>

      <div className="border-t border-border-subtle px-5 py-4">
        <IssueAiCopilotCard issue={issue} event={event} />
      </div>
    </div>
  );
}
