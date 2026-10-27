import type { AlertFirstSeenFilter, AlertLevelFilter } from "./alert-condition-fields";
import type { RuleKind } from "./alert-template-picker.types";

/** One editable starter — maps 1:1 to alert_rules rows teams expect on day one. */
export interface AlertTemplateOption {
  id: string;
  kind: RuleKind;
  title: string;
  /** Mono condition line in the picker. */
  preview: string;
  /** Plain-language why teams keep this armed. */
  rationale: string;
  badge?: { label: string; variant: "neutral" | "info" | "escalating" | "regression" | "healthy" };
  defaultName: string;
  threshold: number | null;
  defaultEnvironment: string;
  defaultMinLevel: AlertLevelFilter;
  defaultFirstSeen: AlertFirstSeenFilter;
}

/**
 * Six high-signal patterns (Sentry/Datadog/on-call playbooks): spike, new, regression,
 * fatal-only, pre-prod staging, cross-env regression safety net.
 */
export const ALERT_TEMPLATE_OPTIONS: AlertTemplateOption[] = [
  {
    id: "prod-spike",
    kind: "velocity_spike",
    title: "Production error spike",
    preview: "≥300% vs prior 15m · production · error+",
    rationale:
      "Surfaces bad deploys and incidents when error rate jumps against the previous window—before volume thresholds alone would notice.",
    badge: { label: "recommended", variant: "info" },
    defaultName: "Production error spike",
    threshold: 300,
    defaultEnvironment: "production",
    defaultMinLevel: "error",
    defaultFirstSeen: "any",
  },
  {
    id: "prod-new",
    kind: "issue_created",
    title: "New production errors",
    preview: "First fingerprint · production · error+",
    rationale:
      "Alerts once per new exception in production so the first customer hit is never silent.",
    badge: { label: "critical", variant: "escalating" },
    defaultName: "New production errors",
    threshold: null,
    defaultEnvironment: "production",
    defaultMinLevel: "error",
    defaultFirstSeen: "new",
  },
  {
    id: "prod-regression",
    kind: "regression",
    title: "Production regression",
    preview: "Resolved issue returns · production",
    rationale:
      "Catches release regressions when a fixed issue reappears in a later build—the highest-signal “came back” event.",
    badge: { label: "release", variant: "regression" },
    defaultName: "Production regressions",
    threshold: null,
    defaultEnvironment: "production",
    defaultMinLevel: "any",
    defaultFirstSeen: "any",
  },
  {
    id: "prod-fatal",
    kind: "issue_created",
    title: "New fatal in production",
    preview: "First fingerprint · production · fatal only",
    rationale:
      "Minimal-noise pager lane: only never-seen fatal-level issues in production.",
    badge: { label: "pager", variant: "escalating" },
    defaultName: "New fatal in production",
    threshold: null,
    defaultEnvironment: "production",
    defaultMinLevel: "fatal",
    defaultFirstSeen: "new",
  },
  {
    id: "staging-new",
    kind: "issue_created",
    title: "New staging errors",
    preview: "First fingerprint · staging · error+",
    rationale:
      "Shift-left: catch new exceptions in staging or preview before they reach production traffic.",
    badge: { label: "pre-prod", variant: "neutral" },
    defaultName: "New staging errors",
    threshold: null,
    defaultEnvironment: "staging",
    defaultMinLevel: "error",
    defaultFirstSeen: "new",
  },
  {
    id: "any-regression",
    kind: "regression",
    title: "Regression (any environment)",
    preview: "Resolved issue returns · all environments",
    rationale:
      "Safety net when regressions surface outside production first (canary, staging, or multi-env SaaS).",
    badge: { label: "safety net", variant: "neutral" },
    defaultName: "Regression — any environment",
    threshold: null,
    defaultEnvironment: "",
    defaultMinLevel: "any",
    defaultFirstSeen: "any",
  },
];

export const DEFAULT_ALERT_TEMPLATE_ID = ALERT_TEMPLATE_OPTIONS[0].id;

export function findAlertTemplate(id: string): AlertTemplateOption {
  return ALERT_TEMPLATE_OPTIONS.find((item) => item.id === id) ?? ALERT_TEMPLATE_OPTIONS[0];
}

export function applyAlertTemplate(template: AlertTemplateOption): {
  templateId: string;
  kind: RuleKind;
  threshold: string;
  environment: string;
  minLevel: AlertLevelFilter;
  firstSeen: AlertFirstSeenFilter;
  name: string;
} {
  return {
    templateId: template.id,
    kind: template.kind,
    threshold: template.threshold == null ? "" : String(template.threshold),
    environment: template.defaultEnvironment,
    minLevel: template.defaultMinLevel,
    firstSeen: template.defaultFirstSeen,
    name: template.defaultName,
  };
}
