import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { getIssueRowVariant, useStyleTheme } from "../lib/style-theme";
import { Badge } from "./badge";

export interface IssueRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  lastSeen?: string;
  eventCount?: number;
  userCount?: number;
  level?: string;
  environment?: string;
  release?: string;
  regression?: boolean;
  snoozed?: boolean;
  unread?: boolean;
  selected?: boolean;
  bulkSelected?: boolean;
}

function unreadDot(): { className: string; title: string } {
  return {
    className: "epure-issue-unread-dot h-1.5 w-1.5 rounded-full bg-signal",
    title: "Not yet viewed",
  };
}

function MetaPart({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return (
    <span className={cn(mono && "font-mono-slash tabular-nums")}>{children}</span>
  );
}

export function IssueRow({
  title,
  lastSeen,
  eventCount,
  userCount,
  level,
  environment,
  release,
  regression = false,
  snoozed = false,
  unread = false,
  selected = false,
  bulkSelected = false,
  className,
  ...props
}: IssueRowProps) {
  const rowVariant = getIssueRowVariant(useStyleTheme());
  const showEdge = selected || unread;
  const statusDot = unread ? unreadDot() : null;

  return (
    <button
      type="button"
      className={cn(
        "epure-issue-row flex min-h-row w-full flex-col gap-1 border-b border-border px-4 py-row text-left transition-colors duration-fast focus-ring",
        `epure-issue-row--${rowVariant}`,
        unread && "epure-issue-row--unread",
        showEdge
          ? "border-l-[length:var(--unread-bar-width)] border-l-accent pl-[calc(1rem-1px)]"
          : "border-l-[length:var(--unread-bar-width)] border-l-transparent pl-[calc(1rem-1px)]",
        selected
          ? "bg-accent-muted"
          : bulkSelected
            ? "bg-accent-muted/70 hover:bg-state-hover"
            : "hover:bg-state-hover",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {statusDot ? (
            <span
              className={cn("mt-1.5 shrink-0 rounded-full", statusDot.className)}
              aria-hidden
              title={statusDot.title}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "epure-issue-row-title line-clamp-2 text-sm leading-snug tracking-ui lg:line-clamp-1 lg:truncate",
                  unread ? "font-semibold text-ink" : "font-medium text-ink-muted",
                )}
              >
                {title}
              </span>
              {regression ? (
                <Badge variant="warning" className="shrink-0">Came back</Badge>
              ) : null}
              {snoozed ? (
                <Badge variant="info" size="compact" className="shrink-0">Snoozed</Badge>
              ) : null}
            </div>
          </div>
        </div>
        {lastSeen ? (
          <span className="hidden shrink-0 pt-0.5 text-xs text-ink-muted lg:inline">{lastSeen}</span>
        ) : null}
      </div>
      <p className="truncate text-xs text-ink-muted">
        {[
          eventCount !== undefined ? `${eventCount} events` : null,
          userCount !== undefined && userCount > 1 ? `${userCount} users` : null,
          environment,
          release,
        ]
          .filter(Boolean)
          .map((part, index) => (
            <span key={index}>
              {index > 0 ? <span aria-hidden> · </span> : null}
              <MetaPart mono={typeof part === "string" && part.includes("events")}>{part}</MetaPart>
            </span>
          ))}
      </p>
    </button>
  );
}
