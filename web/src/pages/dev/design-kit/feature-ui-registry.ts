/**
 * Historical inventory of `src/ui/*.tsx` modules.
 *
 * The playground sidebar no longer lists Feature UI as its own category —
 * crafted surfaces are absorbed into Kit families in `registry.ts`
 * (`DESIGN_KIT_KIT_META.*.absorbs`). Keep this file as a disk inventory for
 * agents; do not wire it into the rail.
 *
 * Facades below are thin re-exports of `@/components/ui/*`.
 */
export const DESIGN_KIT_FEATURE_UI_FACADES = [
  "badge",
  "button",
  "checkbox",
  "command",
  "dialog",
  "dropdown-menu",
  "input",
  "label",
  "popover",
  "radio-group",
  "select",
  "separator",
  "switch",
  "tabs",
  "tooltip",
] as const;

export type DesignKitFeatureUiGroup = {
  id: string;
  label: string;
  description: string;
  modules: readonly string[];
};

/** Sorted A→Z within each group for scanability. */
export const DESIGN_KIT_FEATURE_UI_GROUPS: DesignKitFeatureUiGroup[] = [
  {
    id: "feature-ui-controls",
    label: "Controls & inputs",
    description: "Buttons, fields, filters, copy actions — feature-layer wrappers.",
    modules: [
      "action-button",
      "apply-with-ai-button",
      "copy-button",
      "copy-dsn-block",
      "field",
      "filter-chip",
      "filter-panel",
      "kbd",
    ],
  },
  {
    id: "feature-ui-layout",
    label: "Layout & data display",
    description: "Cards, lists, stats, code, charts.",
    modules: [
      "card",
      "code-block",
      "empty",
      "feed-list-shell",
      "list-row",
      "occurrence-line-chart",
      "section",
      "simple-feed-header",
      "skeleton",
      "sparkline",
      "stat-bar",
    ],
  },
  {
    id: "feature-ui-issues-feed",
    label: "Issues — feed & triage",
    description: "Inbox rows, strips, regression chrome.",
    modules: [
      "issue-feed-row",
      "issue-priority",
      "issue-row",
      "issues-context-strip",
      "issues-home-hint",
      "regression-strip",
    ],
  },
  {
    id: "feature-ui-issue-detail",
    label: "Issues — detail & diagnostics",
    description: "Detail panes, stack, breadcrumbs, occurrences.",
    modules: [
      "breadcrumb-timeline",
      "issue-ai-copilot-card",
      "issue-context-fields",
      "issue-context-snapshot",
      "issue-detail-overlay",
      "issue-detail-tabs",
      "issue-impact-strip",
      "issue-more-panel",
      "issue-occurrence-timeline",
      "issue-occurrences-table",
      "issue-overview-panel",
      "issue-recent-occurrences",
      "keyboard-hints-footer",
      "more-panel",
      "occurrence-picker",
      "source-code-block",
      "stack-trace-panel",
    ],
  },
  {
    id: "feature-ui-setup",
    label: "Setup & onboarding",
    description: "Wizard steps, DSN, waiting states.",
    modules: [
      "dual-sending-card",
      "sdk-snippet-block",
      "setup-checklist",
      "setup-connect-guide",
      "setup-connect-panel",
      "setup-docs-link",
      "setup-platform-mark",
      "setup-status-banner",
      "setup-waiting-panel",
      "step-indicator",
    ],
  },
  {
    id: "feature-ui-chrome",
    label: "Navigation & chrome",
    description: "Headers, settings nav, branding.",
    modules: [
      "logo",
      "page-chrome",
      "page-header",
      "settings-nav",
      "shared-project-badge",
      "workspace-settings-nav",
    ],
  },
  {
    id: "feature-ui-feedback",
    label: "Feedback & system",
    description: "Errors, toasts, quotas, boundaries.",
    modules: [
      "error-state",
      "fair-use-banner",
      "route-error-boundary",
      "toast",
      "toast-provider",
    ],
  },
];

export const DESIGN_KIT_FEATURE_UI_MODULES = DESIGN_KIT_FEATURE_UI_GROUPS.flatMap(
  (group) => group.modules,
);
