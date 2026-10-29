import { cn } from "@/lib/utils";

/**
 * Inbox read/unread cues — aligned with common error-inbox UX (Sentry issue stream,
 * Linear/GitHub notification lists): left accent rail + weight/type contrast, no full-row wash.
 * Unread clears on open/detail; “Mark read” sets the same viewed timestamp in local state.
 */

export function InboxUnreadRail({ unread }: { unread: boolean }) {
  if (!unread) {
    return null;
  }
  return (
    <span
      className="inbox-unread-rail pointer-events-none absolute bottom-2 left-0 top-2 w-[2px] rounded-r-sm bg-accent"
      title="Unread"
      aria-hidden
    />
  );
}

/** Primary line (issue title, alert rule name). */
export function inboxPrimaryTitleClass(unread: boolean, className?: string) {
  return cn(
    "min-w-0 truncate text-sm tracking-ui transition-colors",
    unread ? "font-semibold text-fg-primary" : "font-normal text-fg-secondary",
    className,
  );
}

/** Secondary line (subtitle, issue path, alert context). */
export function inboxSecondaryLineClass(unread: boolean, className?: string) {
  return cn(
    "truncate transition-colors",
    unread ? "text-fg-muted" : "text-fg-muted/75",
    className,
  );
}

/** Numeric / time columns — slightly dimmer when read. */
export function inboxMetaClass(unread: boolean, className?: string) {
  return cn(
    "font-mono text-[11px] tabular-nums transition-colors",
    unread ? "text-fg-secondary" : "text-fg-muted/80",
    className,
  );
}

export function inboxRowDataAttrs(unread: boolean) {
  return unread ? ({ "data-inbox-unread": true } as const) : ({ "data-inbox-read": true } as const);
}

/** Fixed single-line feed toolbar (Issues + Alerts History/Rules). Controls stay h-7. */
export const INBOX_FEED_TOOLBAR_HEADER_CLASS =
  "flex h-16 shrink-0 items-center border-b border-border bg-bg-subtle epure-page-gutter-x select-none";

/** Body below inbox feed toolbar — same horizontal inset as `INBOX_FEED_TOOLBAR_HEADER_CLASS`. */
export const INBOX_FEED_BODY_PAD_CLASS = "epure-page-gutter-x";

export const INBOX_FEED_TOOLBAR_ROW_CLASS =
  "flex h-full min-h-0 w-full min-w-0 flex-nowrap items-center gap-x-2";

export const INBOX_FEED_TOOLBAR_MAIN_CLASS =
  "flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-x-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Rules tab filter row — one line, shrink search; no horizontal scroll. */
export const ALERTS_RULES_TOOLBAR_MAIN_CLASS =
  "flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-x-2";

export const INBOX_FEED_TOOLBAR_RAIL_CLASS =
  "ml-auto flex shrink-0 flex-nowrap items-center gap-2";

/** @deprecated Alerts history uses `ISSUE_FEED_ROW_HEIGHT_CLASS` via `AlertRowShell`. */
export const ALERT_FEED_ROW_HEIGHT_CLASS =
  "h-[4.625rem] max-h-[4.625rem] min-h-[4.625rem] overflow-hidden";

/** @deprecated Use ALERT_FEED_ROW_HEIGHT_CLASS */
export const INBOX_FEED_ROW_HEIGHT_CLASS = ALERT_FEED_ROW_HEIGHT_CLASS;
