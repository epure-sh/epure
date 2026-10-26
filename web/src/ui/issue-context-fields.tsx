import type { ReactNode } from "react";
import type { EventDetail, IssueSummary } from "../lib/api";
import { Badge } from "./badge";
import { IssuePriorityIcon } from "./issue-priority";
import { cn } from "../lib/cn";

export interface IssueContextFieldsProps {
  issue: IssueSummary;
  event: EventDetail | null;
  tags: string[];
  className?: string;
}

function ContextRow({
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
        "grid grid-cols-[5.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5",
        className,
      )}
    >
      <dt className="pt-0.5 font-mono text-xs uppercase tracking-wide text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-sm leading-snug text-fg-primary">{children}</dd>
    </div>
  );
}

function formatLatestUser(event: EventDetail | null): string {
  if (!event) {
    return "—";
  }
  return event.user_email ?? event.user_id ?? "—";
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

export function IssueContextFields({ issue, event, tags, className }: IssueContextFieldsProps) {
  const environment = issue.environment ?? event?.environment ?? "—";
  const release = issue.release ?? event?.release ?? "—";
  const user = formatLatestUser(event);

  return (
    <dl
      className={cn(
        "epure-issue-context-fields grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2 md:items-start",
        className,
      )}
    >
      <ContextRow label="Priority">
        <IssuePriorityIcon level={issue.level} status={issue.status} size={14} showLabel />
      </ContextRow>
      <ContextRow label="Environment">
        {environment === "—" ? (
          <span className="text-fg-muted">—</span>
        ) : (
          <Badge variant={environmentVariant(environment)} size="compact" className="font-mono font-normal">
            {environment}
          </Badge>
        )}
      </ContextRow>
      <ContextRow label="Release">
        {release === "—" ? (
          <span className="text-fg-muted">—</span>
        ) : (
          <Badge variant="neutral" size="compact" className="max-w-full font-mono-slash font-normal">
            <span className="[overflow-wrap:anywhere]">{release}</span>
          </Badge>
        )}
      </ContextRow>
      <ContextRow label="Latest user">
        <span className="block font-mono text-xs leading-relaxed text-fg-primary [overflow-wrap:anywhere]">
          {user}
        </span>
      </ContextRow>
      {tags.length > 0 ? (
        <ContextRow label="Runtime" className="md:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="env" size="compact" className="font-mono font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        </ContextRow>
      ) : null}
    </dl>
  );
}
