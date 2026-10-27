import { useEffect } from "react";
import type { AlertRow } from "../../lib/api";
import { projectIssuePath } from "../../lib/paths";
import {
  formatAlertTimestampPrecise,
  getAlertDetailHeadline,
  getAlertDetailStructuredFields,
  getAlertDispatchAuditRows,
  getAlertLifecycle,
  getAlertRuleDisplayName,
  getAlertSignalState,
  getAlertSignalStateLabel,
  getAlertTriggerExplanation,
} from "./alert-utils";

function formatIso(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function buildAlertAiClipboard(alert: AlertRow, projectId: string): string {
  const title = getAlertDetailHeadline(alert);
  const ruleName = getAlertRuleDisplayName(alert);
  const lifecycle = getAlertLifecycle(alert);
  const signal = getAlertSignalStateLabel(getAlertSignalState(alert));
  const structured = getAlertDetailStructuredFields(alert);
  const trigger = getAlertTriggerExplanation(alert);
  const fired = formatAlertTimestampPrecise(alert.fired_at);
  const issueUrl =
    alert.issue_id && projectId
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${projectIssuePath(projectId, alert.issue_id)}`
      : null;

  const dispatches = getAlertDispatchAuditRows(alert, null);
  const dispatchLines =
    dispatches.length > 0
      ? dispatches.map((row) => `- ${row.channel} → ${row.target}: ${row.status} (${row.timeLabel})`)
      : ["- No per-channel delivery log in payload"];

  return [
    "# Alert (Epure History)",
    "",
    "Use this firing context to investigate or fix the underlying issue.",
    "",
    "## Summary",
    "",
    `- **Title:** ${title}`,
    `- **Rule:** ${ruleName}`,
    `- **Signal:** ${signal}`,
    `- **Lifecycle:** ${lifecycle}`,
    `- **Kind:** ${alert.kind}`,
    `- **Fired:** ${fired.absolute}${fired.isoSubline ? ` (${fired.isoSubline})` : ""}`,
    issueUrl ? `- **Linked issue:** ${issueUrl}` : null,
    "",
    "## Why it fired",
    "",
    trigger || "_No trigger narrative._",
    "",
    structured?.triggerRows.length
      ? ["### Threshold / scope", "", ...structured.triggerRows.map((r) => `- **${r.label}:** ${r.value}`), ""].join(
          "\n",
        )
      : null,
    structured?.impactRows.length
      ? ["## Impact at fire time", "", ...structured.impactRows.map((r) => `- **${r.label}:** ${r.value}`), ""].join(
          "\n",
        )
      : null,
    "## Notifications",
    "",
    ...dispatchLines,
    "",
    "## Raw",
    "",
    `- **Alert id:** ${alert.id}`,
    `- **read_at:** ${formatIso(alert.read_at)}`,
    `- **ignored:** ${alert.ignored ? "yes" : "no"}`,
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

export async function copyAlertExport(alert: AlertRow, projectId: string): Promise<void> {
  const markdown = buildAlertAiClipboard(alert, projectId);
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown);
    }
  } catch {
    // Clipboard blocked
  }
}

export function useAlertExportHotkey(
  enabled: boolean,
  alert: AlertRow | null,
  projectId: string,
  onCopied?: () => void,
): void {
  useEffect(() => {
    const handler = (keyboardEvent: KeyboardEvent) => {
      if (!enabled || !alert) {
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
      const isPlainC =
        !keyboardEvent.metaKey &&
        !keyboardEvent.ctrlKey &&
        !keyboardEvent.altKey &&
        keyboardEvent.key.toLowerCase() === "c";
      const isModifierC = modifier && keyboardEvent.shiftKey && keyboardEvent.key.toLowerCase() === "c";

      if (isPlainC || isModifierC) {
        keyboardEvent.preventDefault();
        void copyAlertExport(alert, projectId).then(() => onCopied?.());
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [alert, enabled, onCopied, projectId]);
}
