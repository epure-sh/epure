import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { AlertRow } from "../../lib/api";
import {
  ArrowCounterClockwise,
  Bell,
  ChartBar,
  Sparkle,
  Terminal,
  TrendUp,
  Users,
  Warning,
} from "@/components/ui/icon";
import { getAlertSeverity, type AlertSeverity } from "./alert-utils";

export type AlertKindVisualTone = "accent" | "warning" | "danger" | "neutral";

/** Normalize API / rule kinds to alert feed icon keys. */
export function normalizeAlertKind(kind?: string | null): string {
  if (!kind) {
    return "unknown";
  }
  if (kind === "velocity") {
    return "velocity_spike";
  }
  if (kind === "issue_created") {
    return "new_issue";
  }
  return kind;
}

const ALERT_KIND_ICONS: Record<string, PhosphorIcon> = {
  velocity_spike: TrendUp,
  regression: ArrowCounterClockwise,
  new_issue: Sparkle,
  event_milestone: ChartBar,
  users_affected: Users,
  ingest_cap_hit: Warning,
  custom: Terminal,
};

/** Icons for alert history + rules — same Phosphor set as `@/components/ui/icon` design kit. */
export function getAlertKindIcon(kind?: string | null): PhosphorIcon {
  const key = normalizeAlertKind(kind);
  return ALERT_KIND_ICONS[key] ?? Bell;
}

/** Wizard template cards — map starter ids to history icons. */
export function getAlertTemplateIcon(templateId: string, kind?: string | null): PhosphorIcon {
  if (templateId === "prod-fatal") {
    return Warning;
  }
  if (templateId === "staging-new") {
    return Sparkle;
  }
  return getAlertKindIcon(kind);
}

function toneFromSeverity(severity: AlertSeverity, kind: string): AlertKindVisualTone {
  if (severity === "danger") {
    return "danger";
  }
  if (kind === "custom" || kind === "new_issue" || kind === "users_affected") {
    return "accent";
  }
  if (kind === "unknown") {
    return "neutral";
  }
  return "warning";
}

export function getAlertKindVisualTone(kind?: string | null): AlertKindVisualTone {
  const normalized = normalizeAlertKind(kind);
  const severity = getAlertSeverity(normalized === "unknown" ? null : normalized);
  return toneFromSeverity(severity, normalized);
}

export function getAlertKindVisual(alert?: AlertRow | null): {
  icon: PhosphorIcon;
  tone: AlertKindVisualTone;
} {
  const kind = alert?.kind;
  return {
    icon: getAlertKindIcon(kind),
    tone: getAlertKindVisualTone(kind),
  };
}

/** Colored glyph + matching outline (template picker, optional). */
export const alertKindIconOutlineClass: Record<AlertKindVisualTone, string> = {
  accent: "border-accent/45 text-accent",
  warning: "border-escalating/45 text-escalating",
  danger: "border-semantic-danger/45 text-semantic-danger",
  neutral: "border-border-strong text-fg-muted",
};

/** Full-color list icons (no tile). */
export const alertKindIconColorClass: Record<AlertKindVisualTone, string> = {
  accent: "text-accent",
  warning: "text-escalating",
  danger: "text-semantic-danger",
  neutral: "text-fg-muted",
};

/** Short list badges — scan-friendly vs full chip labels. */
const ALERT_KIND_BADGE_LABELS: Record<string, string> = {
  velocity_spike: "Events",
  event_milestone: "Events",
  users_affected: "Users",
  new_issue: "New",
  regression: "Regression",
  ingest_cap_hit: "Cap",
  noise_spike: "Noise",
  custom: "Custom",
};

export function getAlertKindBadgeLabel(kind?: string | null): string {
  const key = normalizeAlertKind(kind);
  return ALERT_KIND_BADGE_LABELS[key] ?? (key === "unknown" ? "Alert" : key.replace(/_/g, " "));
}

export function getAlertKindBadgeVariant(
  kind?: string | null,
): "warning" | "error" | "info" | "regression" | "neutral" {
  const key = normalizeAlertKind(kind);
  const tone = getAlertKindVisualTone(kind);
  if (key === "regression") {
    return "regression";
  }
  if (key === "new_issue") {
    return "info";
  }
  if (tone === "danger") {
    return "error";
  }
  if (tone === "warning") {
    return "warning";
  }
  if (tone === "accent") {
    // Orbit Pill has no indigo; blue reads as “signal” on the list.
    return "info";
  }
  return "neutral";
}
