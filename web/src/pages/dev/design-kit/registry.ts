/**
 * Authoritative catalog for the playground design kit.
 * When you add `src/components/ui/<name>.tsx` or `src/components/kit/<name>.tsx`,
 * add `<name>` here and ship a matching preview in `previews/`.
 */
export const DESIGN_KIT_UI_MODULES = [
  "badge",
  "button",
  "checkbox",
  "command",
  "dialog",
  "dropdown-menu",
  "icon",
  "input",
  "label",
  "popover",
  "progress",
  "radio-group",
  "select",
  "separator",
  "sheet",
  "sonner",
  "switch",
  "table",
  "tabs",
  "toggle-group",
  "tooltip",
] as const;

export const DESIGN_KIT_KIT_MODULES = [
  "ask-agent-card",
  "code-frame",
  "command-bar",
  "data-table",
  "empty-state",
  "filter-bar",
  "issue-row-shell",
  "page-shell",
  "product-tour",
  "section-card",
  "telemetry-chart",
  "usage-meter-card",
] as const;

export type DesignKitUiModule = (typeof DESIGN_KIT_UI_MODULES)[number];
export type DesignKitKitModule = (typeof DESIGN_KIT_KIT_MODULES)[number];

export const DESIGN_KIT_SECTIONS = [
  { id: "overview", label: "Overview", group: "Start" },
  { id: "product-docs", label: "Design docs (MD)", group: "Foundation" },
  { id: "tokens", label: "Tokens & color", group: "Foundation" },
  { id: "typography", label: "Typography", group: "Foundation" },
  { id: "primitives", label: "UI primitives (@/components/ui)", group: "Components" },
  { id: "kit", label: "Composite kit (@/components/kit)", group: "Components" },
  { id: "feature-ui", label: "Feature UI (src/ui)", group: "Components" },
  { id: "alerts-patterns", label: "Alerts patterns", group: "Product patterns" },
  { id: "shell", label: "App shell", group: "Product patterns" },
  { id: "motion", label: "Motion & micro-physics", group: "Quality" },
  { id: "states", label: "4-state stress", group: "Quality" },
] as const;

export const DESIGN_KIT_SECTION_GROUPS = [
  "Start",
  "Foundation",
  "Components",
  "Product patterns",
  "Quality",
] as const;

export type DesignKitSectionId = (typeof DESIGN_KIT_SECTIONS)[number]["id"];
