import { useEffect } from "react";
import type { EventDetail, IssueSummary } from "../../lib/api";

interface StackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
  in_app?: boolean;
}

interface Breadcrumb {
  category?: string;
  message?: string;
  level?: string;
  timestamp?: number;
  type?: string;
  data?: Record<string, unknown>;
}

interface ExceptionEntry {
  type?: string;
  value?: string;
}

const BREADCRUMB_LIMIT = 8;
const APP_STACK_LIMIT = 12;

function asStackFrames(value: unknown): StackFrame[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as StackFrame[];
}

function asBreadcrumbs(value: unknown): Breadcrumb[] {
  if (Array.isArray(value)) {
    return value as Breadcrumb[];
  }
  if (value && typeof value === "object" && Array.isArray((value as { values?: unknown }).values)) {
    return (value as { values: Breadcrumb[] }).values;
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatIso(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function isVendorFrame(frame: StackFrame): boolean {
  if (frame.in_app === true) {
    return false;
  }
  if (frame.in_app === false) {
    return true;
  }

  const filename = (frame.filename ?? "").toLowerCase();
  if (filename.includes("node_modules")) {
    return true;
  }

  const looksLikeAppSource =
    filename.includes("/src/") ||
    filename.includes("/app/") ||
    filename.includes("/lib/") ||
    filename.includes("/components/") ||
    filename.includes("/hooks/");

  if (looksLikeAppSource) {
    return false;
  }

  return (
    filename.includes("webpack-internal://") ||
    (filename.includes("webpack") && !looksLikeAppSource) ||
    (filename.includes("vite") && filename.includes("deps"))
  );
}

function hasSourceContext(frame: StackFrame): boolean {
  return Boolean(
    frame.context_line?.trim() ||
      (frame.pre_context && frame.pre_context.length > 0) ||
      (frame.post_context && frame.post_context.length > 0),
  );
}

function findCulpritFrame(frames: StackFrame[]): StackFrame | null {
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index];
    if (!isVendorFrame(frame) && hasSourceContext(frame)) {
      return frame;
    }
  }

  for (let index = frames.length - 1; index >= 0; index -= 1) {
    if (!isVendorFrame(frames[index])) {
      return frames[index];
    }
  }

  return frames.length > 0 ? frames[frames.length - 1] : null;
}

function exceptionEntries(payload: Record<string, unknown>): ExceptionEntry[] {
  const values = payload.exception as { values?: ExceptionEntry[] } | undefined;
  return values?.values ?? [];
}

function exceptionSummary(payload: Record<string, unknown>): string {
  const entries = exceptionEntries(payload);
  if (entries.length === 0) {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
    return "Unknown exception";
  }

  return entries
    .map((entry) => `${entry.type ?? "Error"}: ${entry.value ?? ""}`.trim())
    .join(" → ");
}

function frameLocation(frame: StackFrame): string {
  const filename = frame.filename ?? "?";
  const line = frame.lineno ?? "?";
  const column = frame.colno ?? "?";
  return `${filename}:${line}:${column}`;
}

function formatSourceBlock(frame: StackFrame): string {
  const lines: string[] = [];
  for (const line of frame.pre_context ?? []) {
    lines.push(`  ${line}`);
  }
  if (frame.context_line) {
    lines.push(`> ${frame.context_line}`);
  }
  for (const line of frame.post_context ?? []) {
    lines.push(`  ${line}`);
  }
  if (lines.length === 0 && frame.context_line) {
    lines.push(`> ${frame.context_line}`);
  }
  return lines.length > 0 ? lines.join("\n") : "_No source context captured_";
}

function formatCulpritFrame(frame: StackFrame): string {
  const fn = frame.function ?? "<anonymous>";
  return [
    `**Function:** \`${fn}\``,
    `**Location:** \`${frameLocation(frame)}\``,
    "",
    "```",
    formatSourceBlock(frame),
    "```",
  ].join("\n");
}

function formatAppStack(frames: StackFrame[]): string {
  const appFrames = frames.filter((frame) => !isVendorFrame(frame)).slice(0, APP_STACK_LIMIT);
  if (appFrames.length === 0) {
    return "_No in-app frames — inspect vendor stack in full export below_";
  }

  return appFrames
    .map((frame, index) => {
      const fn = frame.function ?? "<anonymous>";
      const location = frameLocation(frame);
      const source = formatSourceBlock(frame);
      const hasContext = source !== "_No source context captured_";
      const body = hasContext ? `\n\`\`\`\n${source}\n\`\`\`` : "";
      return `### ${index + 1}. \`${fn}\` at \`${location}\`${body}`;
    })
    .join("\n\n");
}

function formatBreadcrumb(crumb: Breadcrumb, index: number): string {
  const category = crumb.category ?? crumb.type ?? "default";
  const level = crumb.level ?? "info";
  const message = crumb.message?.trim() ?? "";
  const data = asRecord(crumb.data);
  const dataBits: string[] = [];

  if (data) {
    for (const key of ["method", "url", "status_code", "label", "status"]) {
      const value = data[key];
      if (value != null && String(value).trim()) {
        dataBits.push(`${key}=${String(value)}`);
      }
    }
  }

  const suffix = dataBits.length > 0 ? ` (${dataBits.join(", ")})` : "";
  return `${index + 1}. [${category}/${level}] ${message}${suffix}`;
}

function formatBreadcrumbs(crumbs: Breadcrumb[]): string {
  if (crumbs.length === 0) {
    return "_No breadcrumbs captured before the crash_";
  }

  const recent = crumbs.slice(-BREADCRUMB_LIMIT);
  const skipped = crumbs.length - recent.length;
  const header =
    skipped > 0 ? `_Showing last ${recent.length} of ${crumbs.length} breadcrumbs_\n` : "";

  return `${header}${recent.map((crumb, index) => formatBreadcrumb(crumb, index)).join("\n")}`;
}

function inferUserJourney(crumbs: Breadcrumb[], exceptionText: string): string {
  if (crumbs.length === 0) {
    return `The app crashed with: ${exceptionText}`;
  }

  const recent = crumbs.slice(-BREADCRUMB_LIMIT);
  const steps = recent
    .map((crumb) => {
      const category = crumb.category ?? crumb.type ?? "event";
      const message = crumb.message?.trim();
      if (!message) {
        return null;
      }
      if (category.includes("navigation")) {
        const destination = message.replace(/^navigated to\s+/i, "");
        return `navigated to ${destination}`;
      }
      if (category.includes("click") || category === "ui") {
        return `clicked ${message}`;
      }
      if (category.includes("fetch") || category.includes("http") || category === "xhr") {
        const data = asRecord(crumb.data);
        const method = data?.method ?? "HTTP";
        const url = data?.url ?? message;
        const status = data?.status_code;
        return status != null ? `${method} ${url} → ${status}` : `${method} ${url}`;
      }
      if (category.includes("console")) {
        return `console: ${message}`;
      }
      return `${category}: ${message}`;
    })
    .filter((step): step is string => step != null);

  if (steps.length === 0) {
    return `The app crashed with: ${exceptionText}`;
  }

  return `User flow before crash: ${steps.join(" → ")} → **${exceptionText}**`;
}

function runtimeTags(event: EventDetail | null): string {
  if (!event) {
    return "_No runtime tags_";
  }

  const tags: string[] = [];
  if (event.platform) tags.push(`platform=${event.platform}`);
  if (event.runtime_name) tags.push(`runtime=${event.runtime_name}`);
  if (event.runtime_version) tags.push(`runtime_version=${event.runtime_version}`);
  if (event.browser_name) tags.push(`browser=${event.browser_name}`);
  if (event.os_name) tags.push(`os=${event.os_name}`);
  if (event.environment) tags.push(`env=${event.environment}`);
  if (event.release) tags.push(`release=${event.release}`);
  if (event.user_id) tags.push(`user_id=${event.user_id}`);
  if (event.user_email) tags.push(`user_email=${event.user_email}`);
  return tags.length > 0 ? tags.join(", ") : "_No runtime tags_";
}

function payloadTags(payload: Record<string, unknown>): string {
  const tags = asRecord(payload.tags);
  if (!tags || Object.keys(tags).length === 0) {
    return "_No custom tags_";
  }

  return Object.entries(tags)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
}

function requestContext(payload: Record<string, unknown>): string | null {
  const request = asRecord(payload.request);
  const transaction = typeof payload.transaction === "string" ? payload.transaction : null;
  const bits: string[] = [];

  if (transaction) {
    bits.push(`transaction=${transaction}`);
  }
  if (request?.url) {
    bits.push(`url=${String(request.url)}`);
  }
  if (request?.method) {
    bits.push(`method=${String(request.method)}`);
  }

  return bits.length > 0 ? bits.join(", ") : null;
}

function issueLifecycleNotes(issue: IssueSummary): string[] {
  const notes: string[] = [];

  if (issue.status === "regressed" && issue.resolved_in_release) {
    notes.push(
      `Regression: previously resolved in \`${issue.resolved_in_release}\`, now firing again`,
    );
  } else if (issue.resolved_in_release) {
    notes.push(`Resolved in release \`${issue.resolved_in_release}\``);
  }

  if (issue.snoozed) {
    const parts = ["Snoozed"];
    if (issue.snooze_until) {
      parts.push(`until ${formatIso(issue.snooze_until)}`);
    }
    if (issue.snooze_until_count != null) {
      parts.push(`or ${issue.snooze_until_count} more events`);
    }
    if (issue.snooze_until_users != null) {
      parts.push(`or ${issue.snooze_until_users} more users`);
    }
    notes.push(parts.join(" "));
  }

  return notes;
}

function buildIssueAiPrompt(
  issue: IssueSummary,
  event: EventDetail | null,
  context: {
    exceptionText: string;
    culprit: StackFrame | null;
    journey: string;
    request: string | null;
    lifecycleNotes: string[];
  },
): string {
  const title = issue.title ?? context.exceptionText;
  const culpritSection = context.culprit
    ? formatCulpritFrame(context.culprit)
    : "_No culprit frame identified — use the application stack below_";

  return [
    "# Fix this production exception (one-shot)",
    "",
    "You are a senior engineer debugging from error monitoring telemetry. Deliver a complete fix in **one response** — no clarifying questions, no exploration loops.",
    "",
    "## Required output (use these headings exactly)",
    "",
    "### Root cause",
    "1–2 sentences: what failed, why, and what user action or request triggered it.",
    "",
    "### Culprit",
    "File, function, and line. Quote the exact failing line.",
    "",
    "### Patch",
    "Minimal unified diff or full function replacement. No drive-by refactors.",
    "",
    "### Regression guard",
    "One test, assertion, or runtime check that would have caught this.",
    "",
    "## How to work",
    "",
    "1. Start with **Likely fault location** and **User journey** — they are pre-ranked.",
    "2. Prefer **in-app frames** over vendor/node_modules frames.",
    "3. Use breadcrumbs to reconstruct intent; the last HTTP/navigation/console steps matter most.",
    "4. If context is incomplete, state assumptions and still propose the safest fix.",
    "5. Keep the change minimal and preserve behavior outside the bug.",
    "",
    "## Issue snapshot",
    "",
    `- **Title:** ${title}`,
    `- **Status:** ${issue.status}`,
    `- **Level:** ${issue.level ?? "unknown"}`,
    `- **Occurrences:** ${issue.event_count}`,
    issue.unique_user_count >= 1 ? `- **Users affected:** ${issue.unique_user_count}` : null,
    `- **Environment:** ${issue.environment ?? event?.environment ?? "unknown"}`,
    `- **Release:** ${issue.release ?? event?.release ?? "unknown"}`,
    `- **First seen:** ${formatIso(issue.first_seen_at)}`,
    `- **Last seen:** ${formatIso(issue.last_seen_at ?? event?.occurred_at)}`,
    event?.occurred_at ? `- **This occurrence:** ${formatIso(event.occurred_at)}` : null,
    context.lifecycleNotes.length > 0
      ? `- **Lifecycle:** ${context.lifecycleNotes.join("; ")}`
      : null,
    context.request ? `- **Request:** ${context.request}` : null,
    "",
    "## Exception",
    "",
    context.exceptionText,
    "",
    "## User journey",
    "",
    context.journey,
    "",
    "## Likely fault location (start here)",
    "",
    culpritSection,
    "",
    "---",
    "",
    "Full diagnostic export follows below.",
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

export function buildIssueExportMarkdown(
  issue: IssueSummary,
  event: EventDetail | null,
): string {
  const title = issue.title ?? "Untitled issue";
  const payload = event?.payload_json ?? {};
  const frames = asStackFrames(event?.stack_frames);
  const breadcrumbs = asBreadcrumbs(event?.breadcrumbs);
  const exceptionText = exceptionSummary(payload);
  const vendorCount = frames.filter((frame) => isVendorFrame(frame)).length;
  const appCount = frames.length - vendorCount;

  return [
    `# ${title}`,
    "",
    `**Status:** ${issue.status}`,
    `**Level:** ${issue.level ?? "unknown"}`,
    `**Events:** ${issue.event_count}`,
    issue.unique_user_count >= 1 ? `**Users affected:** ${issue.unique_user_count}` : null,
    `**First seen:** ${formatIso(issue.first_seen_at)}`,
    `**Last seen:** ${formatIso(issue.last_seen_at ?? event?.occurred_at)}`,
    "",
    "## Exception",
    exceptionText,
    "",
    "## Application stack (in-app frames)",
    `_${appCount} in-app, ${vendorCount} vendor frames omitted_`,
    "",
    formatAppStack(frames),
    "",
    "## Breadcrumbs (last events before crash)",
    formatBreadcrumbs(breadcrumbs),
    "",
    "## Runtime",
    runtimeTags(event),
    "",
    "## Tags",
    payloadTags(payload),
    requestContext(payload) ? `**Request context:** ${requestContext(payload)}` : null,
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

export function buildIssueAiClipboard(
  issue: IssueSummary,
  event: EventDetail | null,
): string {
  const payload = event?.payload_json ?? {};
  const frames = asStackFrames(event?.stack_frames);
  const breadcrumbs = asBreadcrumbs(event?.breadcrumbs);
  const exceptionText = exceptionSummary(payload);
  const context = {
    exceptionText,
    culprit: findCulpritFrame(frames),
    journey: inferUserJourney(breadcrumbs, exceptionText),
    request: requestContext(payload),
    lifecycleNotes: issueLifecycleNotes(issue),
  };

  return `${buildIssueAiPrompt(issue, event, context)}\n\n${buildIssueExportMarkdown(issue, event)}`;
}

export async function copyIssueExport(
  issue: IssueSummary,
  event: EventDetail | null,
): Promise<void> {
  const markdown = buildIssueAiClipboard(issue, event);
  await navigator.clipboard.writeText(markdown);
}

export function useExportHotkey(
  enabled: boolean,
  issue: IssueSummary | null,
  event: EventDetail | null,
  onCopied?: () => void,
): void {
  useEffect(() => {
    const handler = (keyboardEvent: KeyboardEvent) => {
      if (!enabled || !issue) {
        return;
      }

      const target = keyboardEvent.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? keyboardEvent.metaKey : keyboardEvent.ctrlKey;
      if (modifier && keyboardEvent.shiftKey && keyboardEvent.key.toLowerCase() === "c") {
        keyboardEvent.preventDefault();
        void copyIssueExport(issue, event).then(() => onCopied?.());
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, issue, event, onCopied]);
}
