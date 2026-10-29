/**
 * Authoritative catalog for the playground design kit.
 *
 * Sidebar IA (Orbit parity): Foundations · Primitives · Kit.
 *
 * Primitives = Polar `@polar-sh/orbit` components only
 * (https://github.com/polarsource/polar/tree/main/clients/packages/orbit).
 * Epure product composites live under Kit. Near-duplicates are variants —
 * never sibling leaves.
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

// ─── Kit (Epure crafted families) ─────────────────────────────────────────────

export const DESIGN_KIT_KIT_FAMILIES = [
  "Chrome",
  "Surfaces",
  "Controls",
  "Product",
] as const;

export type DesignKitKitFamily = (typeof DESIGN_KIT_KIT_FAMILIES)[number];

export type DesignKitKitMeta = {
  description: string;
  importPath: string;
  family: DesignKitKitFamily;
  absorbs?: readonly string[];
};

export const DESIGN_KIT_KIT_MODULES = [
  "page",
  "nav",
  "card",
  "empty",
  "code",
  "chart",
  "field",
  "filter",
  "command-bar",
  "issue-row",
  "issue-detail",
  "setup",
  "agent",
  "banner",
  "product-tour",
] as const;

export type DesignKitKitModule = (typeof DESIGN_KIT_KIT_MODULES)[number];

export const DESIGN_KIT_KIT_META: Record<DesignKitKitModule, DesignKitKitMeta> = {
  page: {
    description: "Page density shell, chrome, and feed headers.",
    importPath: "@/components/kit/page-shell",
    family: "Chrome",
    absorbs: ["page-shell", "page-chrome", "page-header", "simple-feed-header"],
  },
  nav: {
    description: "Settings nav, workspace nav, count pastille, logo.",
    importPath: "@/ui/settings-nav",
    family: "Chrome",
    absorbs: [
      "settings-nav",
      "workspace-settings-nav",
      "nav-count-pastille",
      "logo",
    ],
  },
  card: {
    description: "Surface cards · section · polar gallery · usage meter.",
    importPath: "@/ui/card",
    family: "Surfaces",
    absorbs: ["card", "section", "section-card", "polar-card", "usage-meter-card"],
  },
  empty: {
    description: "Quiet, with action, error, and loading empty paths.",
    importPath: "@/components/kit/empty-state",
    family: "Surfaces",
    absorbs: ["empty", "empty-state", "error-state", "skeleton"],
  },
  code: {
    description: "Code frames, blocks, SDK snippets, DSN copy.",
    importPath: "@/components/kit/code-frame",
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
    description: "Sparkline, occurrence line, telemetry chart.",
    importPath: "@/components/kit/telemetry-chart",
    family: "Surfaces",
    absorbs: ["sparkline", "occurrence-line-chart", "telemetry-chart"],
  },
  field: {
    description: "Labeled form field pattern.",
    importPath: "@/ui/field",
    family: "Controls",
    absorbs: ["field", "kbd", "label"],
  },
  filter: {
    description: "Filter bar, chips, and panel.",
    importPath: "@/components/kit/filter-bar",
    family: "Controls",
    absorbs: ["filter-bar", "filter-chip", "filter-panel"],
  },
  "command-bar": {
    description: "Product ⌘K palette chrome.",
    importPath: "@/components/kit/command-bar",
    family: "Controls",
    absorbs: ["command"],
  },
  "issue-row": {
    description: "Inbox / feed rows · read and lifecycle cues as states.",
    importPath: "@/ui/issue-row",
    family: "Product",
    absorbs: [
      "issue-row",
      "issue-feed-row",
      "issue-row-shell",
      "list-row",
      "inbox-read-cue",
      "inbox-lifecycle-cue",
      "issue-priority",
      "regression-strip",
      "issues-context-strip",
      "issues-home-hint",
    ],
  },
  "issue-detail": {
    description: "Detail overlay flow · tabs, overview, stack, occurrences.",
    importPath: "@/ui/issue-detail-overlay",
    family: "Product",
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
      "more-panel",
      "keyboard-hints-footer",
      "feed-list-shell",
      "stat-bar",
    ],
  },
  setup: {
    description: "Onboarding checklist, connect, waiting, platform mark.",
    importPath: "@/ui/setup-checklist",
    family: "Product",
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
  agent: {
    description: "AI copilot cards.",
    importPath: "@/components/kit/ask-agent-card",
    family: "Product",
    absorbs: ["ask-agent-card", "issue-ai-copilot-card", "apply-with-ai-button"],
  },
  banner: {
    description: "Product banners as Alert tones.",
    importPath: "@/ui/fair-use-banner",
    family: "Product",
    absorbs: [
      "fair-use-banner",
      "setup-status-banner",
      "toast",
      "toast-provider",
      "route-error-boundary",
      "shared-project-badge",
    ],
  },
  "product-tour": {
    description: "driver.js product tour popover.",
    importPath: "@/components/kit/product-tour",
    family: "Product",
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
  "Kit",
] as const;

export type DesignKitSectionGroup = (typeof DESIGN_KIT_SECTION_GROUPS)[number];

/** @deprecated Use DESIGN_KIT_PRIMITIVE_MODULES */
export const DESIGN_KIT_UI_MODULES = DESIGN_KIT_PRIMITIVE_MODULES;
/** @deprecated Use DESIGN_KIT_PRIMITIVE_META */
export const DESIGN_KIT_UI_META = DESIGN_KIT_PRIMITIVE_META;

export type DesignKitUiModule = DesignKitPrimitiveModule;
export type DesignKitSectionId = DesignKitFoundationId | "primitives" | "kit";

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

export function kitByFamily(): Record<DesignKitKitFamily, DesignKitKitModule[]> {
  const out = Object.fromEntries(
    DESIGN_KIT_KIT_FAMILIES.map((f) => [f, [] as DesignKitKitModule[]]),
  ) as Record<DesignKitKitFamily, DesignKitKitModule[]>;
  for (const mod of DESIGN_KIT_KIT_MODULES) {
    out[DESIGN_KIT_KIT_META[mod].family].push(mod);
  }
  return out;
}

export function previewStemForPrimitive(mod: DesignKitPrimitiveModule): string {
  return DESIGN_KIT_PRIMITIVE_META[mod].preview ?? mod;
}
