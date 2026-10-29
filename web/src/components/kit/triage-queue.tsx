import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Sparkle } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-time";
import { formatCompactCount } from "@/lib/format-count";
import { IssuePriorityBadge, resolveIssuePriority } from "@/ui/issue-priority";
import type { IssueSummary } from "@/lib/api";

export interface TriageQueueItem extends IssueSummary {}

export interface TriageQueueProps {
  issues: TriageQueueItem[];
  loading?: boolean;
  onInspect?: (issue: TriageQueueItem) => void;
  onCopyForAgent?: (issue: TriageQueueItem) => void | Promise<void>;
  emptyLabel?: string;
  className?: string;
}

function triageKind(issue: IssueSummary): { label: string; variant: "escalating" | "regression" | "info" } {
  if (issue.status === "regression" || issue.came_back) {
    return { label: "Regressed", variant: "regression" };
  }
  const ageMs = issue.first_seen_at ? Date.now() - new Date(issue.first_seen_at).getTime() : Infinity;
  if (ageMs < 36 * 60 * 60 * 1000) {
    return { label: "New", variant: "info" };
  }
  const priority = resolveIssuePriority(issue.level, issue.status);
  if (priority === "critical" || priority === "high") {
    return { label: "High", variant: "escalating" };
  }
  return { label: "Open", variant: "info" };
}

export function TriageQueue({
  issues,
  loading = false,
  onInspect,
  onCopyForAgent,
  emptyLabel = "Nothing needs triage right now.",
  className,
}: TriageQueueProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = async (issue: TriageQueueItem) => {
    await onCopyForAgent?.(issue);
    setCopiedId(issue.id);
    window.setTimeout(() => setCopiedId((current) => (current === issue.id ? null : current)), 1600);
  };

  return (
    <div data-slot="triage-queue" className={cn("flex flex-col gap-1", className)}>
      {loading ? (
        Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[68px] animate-pulse rounded-control border border-border-subtle bg-surface-2/50"
          />
        ))
      ) : issues.length === 0 ? (
        <p className="py-10 text-center text-xs text-fg-muted">{emptyLabel}</p>
      ) : (
        issues.map((issue) => {
          const kind = triageKind(issue);
          return (
            <div
              key={issue.id}
              className="group flex items-start gap-3 rounded-control border border-transparent px-2.5 py-2.5 transition-colors hover:border-border-subtle hover:bg-surface-2/40"
            >
              <div className="mt-0.5 shrink-0">
                <IssuePriorityBadge level={issue.level} status={issue.status} compact />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={kind.variant} size="sm">
                    {kind.label}
                  </Badge>
                  <span className="font-mono text-[10px] text-fg-muted tabular-nums">
                    {formatCompactCount(issue.event_count)} evt
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium tracking-tight text-fg-primary">
                  {issue.title ?? "Untitled issue"}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-fg-muted">
                  {issue.environment ?? "prod"}
                  {issue.last_seen_at ? ` · ${formatRelativeTime(issue.last_seen_at)}` : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Copy for agent"
                  onClick={() => void handleCopy(issue)}
                >
                  {copiedId === issue.id ? (
                    <Check className="size-3.5" weight="bold" />
                  ) : (
                    <Sparkle className="size-3.5" weight="fill" />
                  )}
                </Button>
                <Button variant="ghost" size="xs" onClick={() => onInspect?.(issue)}>
                  Inspect
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
