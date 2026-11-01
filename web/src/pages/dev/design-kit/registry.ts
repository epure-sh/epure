/**
 * Authoritative catalog for the playground design kit.
 *
 * Sidebar IA (three-tier `/ui` + foundations):
 * Foundations · Primitives · Components · Blocks.
 *
 * Primitives = Polar `@polar-sh/orbit` components
 * (https://github.com/polarsource/polar/tree/main/clients/packages/orbit).
 * Components = `web/src/ui/components` composites.
 * Blocks = `web/src/ui/block` page-level sections.
 * Near-duplicates are variants — never sibling leaves.
 */

// ─── Foundations ──────────────────────────────────────────────────────────────

export const DESIGN_KIT_FOUNDATION_PAGES = [
  {
    id: "foundations",
    label: "Foundations",
    keywords: "overview principles vision brand voice llm contract handbook",
  },
  {
    id: "colors",
    label: "Colors",
    keywords: "palette swatch semantic background text border orbit theme",
  },
  {
    id: "spacing",
    label: "Spacing",
    keywords: "space scale xs s m l xl orbit",
  },
  {
    id: "radius",
    label: "Radius",
    keywords: "border radius rounded orbit borderRadii",
  },
  {
    id: "shadows",
    label: "Shadows",
    keywords: "elevation shadow orbit",
  },
  {
    id: "motion",
    label: "Motion",
    keywords: "duration ease decelerate accelerate spring orbit",
  },
  {
    id: "typography",
    label: "Typography",
    keywords: "text variants type scale orbit Text",
  },
  {
    id: "icons",
    label: "Icons",
    keywords: "lucide material orbit icons",
  },
] as const;

export type DesignKitFoundationId =
  (typeof DESIGN_KIT_FOUNDATION_PAGES)[number]["id"];

// ─── Primitives — Polar Orbit only ────────────────────────────────────────────
// Source of truth: clients/packages/orbit + orbit.polar.sh Components.

export const DESIGN_KIT_PRIMITIVE_FAMILIES = [
  "Layout",
  "Actions",
  "Forms",
  "Choice",
  "Lists",
  "Overlays",
  "Feedback",
  "Identity",
  "Data",
] as const;

export type DesignKitPrimitiveFamily =
  (typeof DESIGN_KIT_PRIMITIVE_FAMILIES)[number];

export type DesignKitPrimitiveMeta = {
  description: string;
  /** Always an `@polar-sh/orbit` import path. */
  importPath: string;
  family: DesignKitPrimitiveFamily;
  orbit: string;
  preview?: string;
};

/**
 * Rail order mirrors orbit.polar.sh Components, then package-only leaves
 * (Modal, InlineModal, Subnav) that ship in the same repo.
 */
export const DESIGN_KIT_PRIMITIVE_MODULES = [
  // Layout
  "box",
  "grid",
  "text",
  "truncated",
  // Actions
  "button",
  "button-group",
  // Forms
  "input",
  "textarea",
  "select",
  "checkbox",
  "switch",
  // Choice
  "segmented-control",
  "tabs",
  // Lists
  "list",
  "list-group",
  "subnav",
  // Overlays
  "tooltip",
  "modal",
  "inline-modal",
  // Feedback
  "alert",
  "status",
  "pill",
  "spinner",
  // Identity
  "avatar",
  // Data
  "data-table",
] as const;

export type DesignKitPrimitiveModule =
  (typeof DESIGN_KIT_PRIMITIVE_MODULES)[number];

export const DESIGN_KIT_PRIMITIVE_META: Record<
  DesignKitPrimitiveModule,
  DesignKitPrimitiveMeta
> = {
  box: {
    description: "Polymorphic, token-driven layout and style primitive.",
    importPath: "@polar-sh/orbit/Box",
    family: "Layout",
    orbit: "Box",
  },
  grid: {
    description: "Box preset for CSS grid layouts, with GridItem placement.",
    importPath: "@polar-sh/orbit/Grid",
    family: "Layout",
    orbit: "Grid",
  },
  text: {
    description: "Variant-driven typography for every text node.",
    importPath: "@polar-sh/orbit/Text",
    family: "Layout",
    orbit: "Text",
  },
  truncated: {
    description: "Single and multi-line text truncation with ellipsis.",
    importPath: "@polar-sh/orbit",
    family: "Layout",
    orbit: "Truncated",
  },
  button: {
    description: "Actions across variants, sizes and loading states.",
    importPath: "@polar-sh/orbit/Button",
    family: "Actions",
    orbit: "Button",
  },
  "button-group": {
    description: "One or two related actions, with primary and ghost emphasis.",
    importPath: "@polar-sh/orbit",
    family: "Actions",
    orbit: "ButtonGroup",
  },
  input: {
    description: "Single-line text input with pre/post slots.",
    importPath: "@polar-sh/orbit/Input",
    family: "Forms",
    orbit: "Input",
  },
  textarea: {
    description: "Multi-line text input.",
    importPath: "@polar-sh/orbit/TextArea",
    family: "Forms",
    orbit: "TextArea",
  },
  select: {
    description: "Dropdown selection built on Radix.",
    importPath: "@polar-sh/orbit/Select",
    family: "Forms",
    orbit: "Select",
  },
  checkbox: {
    description: "Boolean and indeterminate selection control.",
    importPath: "@polar-sh/orbit/Checkbox",
    family: "Forms",
    orbit: "Checkbox",
  },
  switch: {
    description: "On/off toggle control.",
    importPath: "@polar-sh/orbit/Switch",
    family: "Forms",
    orbit: "Switch",
  },
  "segmented-control": {
    description: "Horizontal control for switching between options.",
    importPath: "@polar-sh/orbit/SegmentedControl",
    family: "Choice",
    orbit: "SegmentedControl",
  },
  tabs: {
    description: "Tabbed section navigation.",
    importPath: "@polar-sh/orbit/Tabs",
    family: "Choice",
    orbit: "Tabs",
  },
  list: {
    description: "Semantic lists.",
    importPath: "@polar-sh/orbit",
    family: "Lists",
    orbit: "List",
  },
  "list-group": {
    description: "Grouped list sections.",
    importPath: "@polar-sh/orbit",
    family: "Lists",
    orbit: "ListGroup",
  },
  subnav: {
    description: "Secondary in-page navigation.",
    importPath: "@polar-sh/orbit",
    family: "Lists",
    orbit: "Subnav",
  },
  tooltip: {
    description: "Contextual hints on hover and focus.",
    importPath: "@polar-sh/orbit",
    family: "Overlays",
    orbit: "Tooltip",
  },
  modal: {
    description: "Blocking dialog overlay.",
    importPath: "@polar-sh/orbit/Modal",
    family: "Overlays",
    orbit: "Modal",
  },
  "inline-modal": {
    description: "Focus-locked modal rendered via portal.",
    importPath: "@polar-sh/orbit",
    family: "Overlays",
    orbit: "InlineModal",
  },
  alert: {
    description: "Tinted callouts that communicate a message and its severity.",
    importPath: "@polar-sh/orbit/Alert",
    family: "Feedback",
    orbit: "Alert",
  },
  status: {
    description: "Status chips with semantic color treatments.",
    importPath: "@polar-sh/orbit/Status",
    family: "Feedback",
    orbit: "Status",
  },
  pill: {
    description: "Compact, colorful tags and labels.",
    importPath: "@polar-sh/orbit/Pill",
    family: "Feedback",
    orbit: "Pill",
  },
  spinner: {
    description: "Indeterminate progress indicator.",
    importPath: "@polar-sh/orbit/Spinner",
    family: "Feedback",
    orbit: "Spinner",
  },
  avatar: {
    description: "User and entity avatars with initials fallback.",
    importPath: "@polar-sh/orbit/Avatar",
    family: "Identity",
    orbit: "Avatar",
  },
  "data-table": {
    description: "Sortable, paginated tables built on TanStack Table.",
    importPath: "@polar-sh/orbit",
    family: "Data",
    orbit: "DataTable",
  },
};

/**
 * Names that are not Polar Orbit components — retired from the primitive rail.
 * Epure product wrappers stay in the codebase; they are not Orbit primitives.
 */
export const DESIGN_KIT_RETIRED_PRIMITIVES = [
  "separator",
  "label",
  "radio-group",
  "popover",
  "dropdown-menu",
  "sheet",
  "command",
  "progress",
  "toast",
  "sonner",
  "table",
  "badge", // → pill
  "dialog", // → modal
  "toggle-group", // → segmented-control
  "icon", // → foundations/icons (Orbit lucide/material)
] as const;

// ─── Components (`web/src/ui/components`) ─────────────────────────────────────

export const DESIGN_KIT_COMPONENT_FAMILIES = [
  "Surfaces",
  "Controls",
  "Feedback",
  "Product",
] as const;

export type DesignKitComponentFamily =
  (typeof DESIGN_KIT_COMPONENT_FAMILIES)[number];

export type DesignKitComponentMeta = {
  description: string;
  importPath: string;
  family: DesignKitComponentFamily;
  absorbs?: readonly string[];
  /** Preview file stem under previews/kit/ (defaults to module id). */
  preview?: string;
};

export const DESIGN_KIT_COMPONENT_MODULES = [
  "card",
  "empty",
  "code",
  "chart",
  "field",
  "filter",
  "command-bar",
  "action-button",
  "agent",
  "banner",
] as const;

export type DesignKitComponentModule =
  (typeof DESIGN_KIT_COMPONENT_MODULES)[number];

export const DESIGN_KIT_COMPONENT_META: Record<
  DesignKitComponentModule,
  DesignKitComponentMeta
> = {
  card: {
    description: "Surface cards · section · polar gallery · usage meter.",
    importPath: "@/ui/components",
    family: "Surfaces",
    absorbs: ["card", "section", "section-card", "polar-card", "usage-meter-card"],
  },
  empty: {
    description: "Quiet, with action, error, and loading empty paths.",
    importPath: "@/ui/components",
    family: "Surfaces",
    absorbs: ["empty", "empty-state", "error-state", "skeleton"],
  },
  code: {
    description: "Code frames, blocks, SDK snippets, DSN copy.",
    importPath: "@/ui/components",
    family: "Surfaces",
    absorbs: [
      "code-frame",
      "code-block",
      "source-code-block",
      "sdk-snippet-block",
      "copy-dsn-block",
    ],
  },
  chart: {
    description: "Sparkline and telemetry chart composites.",
    importPath: "@/ui/components",
    family: "Surfaces",
    absorbs: ["sparkline", "telemetry-chart"],
  },
  field: {
    description: "Labeled form field pattern.",
    importPath: "@/ui/components",
    family: "Controls",
    absorbs: ["field", "kbd", "label"],
  },
  filter: {
    description: "Filter bar and chips.",
    importPath: "@/ui/components",
    family: "Controls",
    absorbs: ["filter-bar", "filter-chip"],
  },
  "command-bar": {
    description: "Product ⌘K palette chrome.",
    importPath: "@/ui/components",
    family: "Controls",
    absorbs: ["command"],
  },
  "action-button": {
    description: "Button with disabled-tooltip affordance.",
    importPath: "@/ui/components",
    family: "Controls",
    absorbs: ["action-button", "copy-button", "apply-with-ai-button"],
  },
  agent: {
    description: "AI copilot cards.",
    importPath: "@/ui/components",
    family: "Product",
    absorbs: ["ask-agent-card", "issue-ai-copilot-card", "ai-copilot-card"],
  },
  banner: {
    description: "Product banners and context strips.",
    importPath: "@/ui/components",
    family: "Feedback",
    absorbs: [
      "fair-use-banner",
      "setup-status-banner",
      "toast",
      "toast-provider",
      "shared-project-badge",
      "regression-strip",
      "issues-context-strip",
      "issues-home-hint",
    ],
  },
};

// ─── Blocks (`web/src/ui/block`) ──────────────────────────────────────────────

export const DESIGN_KIT_BLOCK_FAMILIES = [
  "Chrome",
  "Feed",
  "Detail",
  "Setup",
  "Product",
] as const;

export type DesignKitBlockFamily = (typeof DESIGN_KIT_BLOCK_FAMILIES)[number];

export type DesignKitBlockMeta = {
  description: string;
  importPath: string;
  family: DesignKitBlockFamily;
  absorbs?: readonly string[];
  preview?: string;
};

export const DESIGN_KIT_BLOCK_MODULES = [
  "page",
  "nav",
  "issue-row",
  "issue-detail",
  "setup",
  "product-tour",
  "alert-rule",
  "output-channel",
  "monitor",
] as const;

export type DesignKitBlockModule = (typeof DESIGN_KIT_BLOCK_MODULES)[number];

export const DESIGN_KIT_BLOCK_META: Record<
  DesignKitBlockModule,
  DesignKitBlockMeta
> = {
  page: {
    description: "Page density shell, chrome, and feed headers.",
    importPath: "@/ui/block",
    family: "Chrome",
    absorbs: ["page-shell", "page-chrome", "page-header", "simple-feed-header"],
  },
  nav: {
    description: "Settings nav, workspace nav, count pastille, logo.",
    importPath: "@/ui/block",
    family: "Chrome",
    absorbs: [
      "settings-nav",
      "workspace-settings-nav",
      "nav-count-pastille",
      "logo",
    ],
  },
  "issue-row": {
    description: "Inbox / feed rows · read and lifecycle cues as states.",
    importPath: "@/ui/block",
    family: "Feed",
    absorbs: [
      "issue-row",
      "issue-feed-row",
      "issue-row-shell",
      "list-row",
      "inbox-read-cue",
      "inbox-lifecycle-cue",
      "issue-priority",
      "feed-list-shell",
      "filter-panel",
    ],
  },
  "issue-detail": {
    description: "Detail overlay flow · tabs, overview, stack, occurrences.",
    importPath: "@/ui/block",
    family: "Detail",
    absorbs: [
      "issue-detail-overlay",
      "issue-detail-tabs",
      "issue-overview-panel",
      "issue-context-fields",
      "issue-context-snapshot",
      "issue-occurrence-timeline",
      "issue-occurrences-table",
      "issue-recent-occurrences",
      "issue-impact-strip",
      "issue-more-panel",
      "stack-trace-panel",
      "breadcrumb-timeline",
      "occurrence-picker",
      "occurrence-line-chart",
      "more-panel",
      "keyboard-hints-footer",
      "stat-bar",
      "route-error-boundary",
    ],
  },
  setup: {
    description: "Onboarding checklist, connect, waiting, platform mark.",
    importPath: "@/ui/block",
    family: "Setup",
    absorbs: [
      "setup-checklist",
      "setup-connect-guide",
      "setup-connect-panel",
      "setup-waiting-panel",
      "setup-platform-mark",
      "setup-docs-link",
      "step-indicator",
      "dual-sending-card",
    ],
  },
  "product-tour": {
    description: "driver.js product tour popover.",
    importPath: "@/components/kit/product-tour",
    family: "Product",
  },
  "alert-rule": {
    description: "Create-alert setup: template, sentence, and delivery.",
    importPath: "@/components/kit/create-alert-rule",
    family: "Product",
    absorbs: ["create-alert-rule"],
  },
  "output-channel": {
    description: "Connect destinations: provider, credentials, and verify test.",
    importPath: "@/components/kit/create-output-channel",
    family: "Product",
    absorbs: ["create-output-channel"],
  },
  monitor: {
    description: "Cron monitor list row, duration strip, and 2-step create wizard.",
    importPath: "@/components/kit/monitor-row",
    family: "Product",
    absorbs: ["monitor-row", "monitor-duration-strip", "create-monitor"],
  },
};

export const DESIGN_KIT_RETIRED_KIT_LEAVES = [
  "ask-agent-card",
  "code-frame",
  "data-table",
  "empty-state",
  "filter-bar",
  "inbox-lifecycle-cue",
  "inbox-read-cue",
  "issue-row-shell",
  "nav-count-pastille",
  "page-shell",
  "polar-card",
  "section-card",
  "telemetry-chart",
  "time-window-select",
  "usage-meter-card",
] as const;

// ─── Sidebar groups ───────────────────────────────────────────────────────────

export const DESIGN_KIT_SECTION_GROUPS = [
  "Foundations",
  "Primitives",
  "Components",
  "Blocks",
] as const;

export type DesignKitSectionGroup = (typeof DESIGN_KIT_SECTION_GROUPS)[number];

/** @deprecated Use DESIGN_KIT_PRIMITIVE_MODULES */
export const DESIGN_KIT_UI_MODULES = DESIGN_KIT_PRIMITIVE_MODULES;
/** @deprecated Use DESIGN_KIT_PRIMITIVE_META */
export const DESIGN_KIT_UI_META = DESIGN_KIT_PRIMITIVE_META;

/** @deprecated Prefer DESIGN_KIT_COMPONENT_* / DESIGN_KIT_BLOCK_* */
export const DESIGN_KIT_KIT_FAMILIES = [
  ...DESIGN_KIT_COMPONENT_FAMILIES,
  ...DESIGN_KIT_BLOCK_FAMILIES,
] as const;

/** @deprecated Prefer DESIGN_KIT_COMPONENT_MODULES / DESIGN_KIT_BLOCK_MODULES */
export const DESIGN_KIT_KIT_MODULES = [
  ...DESIGN_KIT_COMPONENT_MODULES,
  ...DESIGN_KIT_BLOCK_MODULES,
] as const;

/** @deprecated Prefer DESIGN_KIT_COMPONENT_META / DESIGN_KIT_BLOCK_META */
export type DesignKitKitFamily =
  | DesignKitComponentFamily
  | DesignKitBlockFamily;
/** @deprecated Prefer DesignKitComponentModule / DesignKitBlockModule */
export type DesignKitKitModule =
  | DesignKitComponentModule
  | DesignKitBlockModule;
/** @deprecated Prefer DesignKitComponentMeta / DesignKitBlockMeta */
export type DesignKitKitMeta = DesignKitComponentMeta | DesignKitBlockMeta;

/** @deprecated Prefer COMPONENT_META / BLOCK_META */
export const DESIGN_KIT_KIT_META: Record<DesignKitKitModule, DesignKitKitMeta> = {
  ...DESIGN_KIT_COMPONENT_META,
  ...DESIGN_KIT_BLOCK_META,
};

export type DesignKitUiModule = DesignKitPrimitiveModule;
export type DesignKitSectionId =
  | DesignKitFoundationId
  | "primitives"
  | "components"
  | "blocks"
  | "kit";

export function primitivesByFamily(): Record<
  DesignKitPrimitiveFamily,
  DesignKitPrimitiveModule[]
> {
  const out = Object.fromEntries(
    DESIGN_KIT_PRIMITIVE_FAMILIES.map((f) => [f, [] as DesignKitPrimitiveModule[]]),
  ) as Record<DesignKitPrimitiveFamily, DesignKitPrimitiveModule[]>;
  for (const mod of DESIGN_KIT_PRIMITIVE_MODULES) {
    out[DESIGN_KIT_PRIMITIVE_META[mod].family].push(mod);
  }
  return out;
}

export function componentsByFamily(): Record<
  DesignKitComponentFamily,
  DesignKitComponentModule[]
> {
  const out = Object.fromEntries(
    DESIGN_KIT_COMPONENT_FAMILIES.map((f) => [
      f,
      [] as DesignKitComponentModule[],
    ]),
  ) as Record<DesignKitComponentFamily, DesignKitComponentModule[]>;
  for (const mod of DESIGN_KIT_COMPONENT_MODULES) {
    out[DESIGN_KIT_COMPONENT_META[mod].family].push(mod);
  }
  return out;
}

export function blocksByFamily(): Record<
  DesignKitBlockFamily,
  DesignKitBlockModule[]
> {
  const out = Object.fromEntries(
    DESIGN_KIT_BLOCK_FAMILIES.map((f) => [f, [] as DesignKitBlockModule[]]),
  ) as Record<DesignKitBlockFamily, DesignKitBlockModule[]>;
  for (const mod of DESIGN_KIT_BLOCK_MODULES) {
    out[DESIGN_KIT_BLOCK_META[mod].family].push(mod);
  }
  return out;
}

/** @deprecated Use componentsByFamily / blocksByFamily */
export function kitByFamily(): Record<DesignKitKitFamily, DesignKitKitModule[]> {
  const out = Object.fromEntries(
    DESIGN_KIT_KIT_FAMILIES.map((f) => [f, [] as DesignKitKitModule[]]),
  ) as Record<DesignKitKitFamily, DesignKitKitModule[]>;
  for (const mod of DESIGN_KIT_COMPONENT_MODULES) {
    out[DESIGN_KIT_COMPONENT_META[mod].family].push(mod);
  }
  for (const mod of DESIGN_KIT_BLOCK_MODULES) {
    out[DESIGN_KIT_BLOCK_META[mod].family].push(mod);
  }
  return out;
}

export function previewStemForPrimitive(mod: DesignKitPrimitiveModule): string {
  return DESIGN_KIT_PRIMITIVE_META[mod].preview ?? mod;
}

export function previewStemForComponent(mod: DesignKitComponentModule): string {
  return DESIGN_KIT_COMPONENT_META[mod].preview ?? mod;
}

export function previewStemForBlock(mod: DesignKitBlockModule): string {
  return DESIGN_KIT_BLOCK_META[mod].preview ?? mod;
}
