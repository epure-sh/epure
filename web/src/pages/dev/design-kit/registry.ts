/**
 * Authoritative catalog for the playground design kit.
 * When you add `src/components/ui/<name>.tsx` or `src/components/kit/<name>.tsx`,
 * add `<name>` here and ship a matching preview in `previews/`.
 *
 * Phase 5 — Orbit-style registry: nav + Example pages are driven from these
 * lists (like orbit.polar.sh `lib/registry.ts`). Canvas remains optional tooling.
 */
export const DESIGN_KIT_UI_MODULES = [
  "alert",
  "avatar",
  "badge",
  "button",
  "checkbox",
  "command",
  "dialog",
  "dropdown-menu",
  "icon",
  "input",
  "label",
  "modal",
  "popover",
  "progress",
  "radio-group",
  "segmented-control",
  "select",
  "separator",
  "sheet",
  "sonner",
  "spinner",
  "status",
  "switch",
  "table",
  "tabs",
  "textarea",
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
  "inbox-lifecycle-cue",
  "inbox-read-cue",
  "issue-row-shell",
  "nav-count-pastille",
  "page-shell",
  "polar-card",
  "product-tour",
  "section-card",
  "telemetry-chart",
  "time-window-select",
  "usage-meter-card",
] as const;

export type DesignKitUiModule = (typeof DESIGN_KIT_UI_MODULES)[number];
export type DesignKitKitModule = (typeof DESIGN_KIT_KIT_MODULES)[number];

/** Registry blurb for UI wrappers (Phase 2 Orbit mapping). */
export const DESIGN_KIT_UI_META: Record<
  DesignKitUiModule,
  { description: string; importPath: string; orbit?: string }
> = {
  alert: {
    description: "Orbit Alert façade.",
    importPath: "@/components/ui/alert",
    orbit: "Alert",
  },
  avatar: {
    description: "Orbit Avatar façade (initials fallback).",
    importPath: "@/components/ui/avatar",
    orbit: "Avatar",
  },
  badge: {
    description: "Epure Badge → Orbit Pill (variant names mapped).",
    importPath: "@/components/ui/badge",
    orbit: "Pill",
  },
  button: {
    description: "Orbit Button · Epure variants (signal / filter*) · hotkey · loading.",
    importPath: "@/components/ui/button",
    orbit: "Button",
  },
  checkbox: {
    description: "Orbit Checkbox wrap.",
    importPath: "@/components/ui/checkbox",
    orbit: "Checkbox",
  },
  command: {
    description: "cmdk command palette chrome (no Orbit equiv).",
    importPath: "@/components/ui/command",
  },
  dialog: {
    description: "Product compound Dialog API; prefer Modal for new overlays.",
    importPath: "@/components/ui/dialog",
  },
  "dropdown-menu": {
    description: "Radix dropdown (no Orbit equiv yet).",
    importPath: "@/components/ui/dropdown-menu",
  },
  icon: {
    description: "Phosphor icon façade for product surfaces.",
    importPath: "@/components/ui/icon",
  },
  input: {
    description: "Orbit Input · leadingIcon → preSlot · trailingShortcut.",
    importPath: "@/components/ui/input",
    orbit: "Input",
  },
  label: {
    description: "Form label (Calm Ledger / Radix).",
    importPath: "@/components/ui/label",
  },
  modal: {
    description: "Orbit Modal for new overlays.",
    importPath: "@/components/ui/modal",
    orbit: "Modal",
  },
  popover: {
    description: "Radix popover (no Orbit equiv yet).",
    importPath: "@/components/ui/popover",
  },
  progress: {
    description: "Progress bar (no Orbit equiv yet).",
    importPath: "@/components/ui/progress",
  },
  "radio-group": {
    description: "Radio group (no Orbit equiv yet).",
    importPath: "@/components/ui/radio-group",
  },
  "segmented-control": {
    description: "Orbit SegmentedControl façade.",
    importPath: "@/components/ui/segmented-control",
    orbit: "SegmentedControl",
  },
  select: {
    description: "Orbit Select · Epure trigger size sm/md.",
    importPath: "@/components/ui/select",
    orbit: "Select",
  },
  separator: {
    description: "Separator (no Orbit equiv yet) · Polar gray border tokens.",
    importPath: "@/components/ui/separator",
  },
  sheet: {
    description: "Vaul sheet / drawer (no Orbit sheet).",
    importPath: "@/components/ui/sheet",
  },
  sonner: {
    description: "Toast via sonner (no Orbit toast).",
    importPath: "@/components/ui/sonner",
  },
  spinner: {
    description: "Orbit Spinner façade.",
    importPath: "@/components/ui/spinner",
    orbit: "Spinner",
  },
  status: {
    description: "Orbit Status chip façade.",
    importPath: "@/components/ui/status",
    orbit: "Status",
  },
  switch: {
    description: "Orbit Switch · Epure size compact/default.",
    importPath: "@/components/ui/switch",
    orbit: "Switch",
  },
  table: {
    description: "Orbit Table primitives · Footer/Caption are Epure locals.",
    importPath: "@/components/ui/table",
    orbit: "Table",
  },
  tabs: {
    description: "Orbit Tabs · Epure line/folder overlays.",
    importPath: "@/components/ui/tabs",
    orbit: "Tabs",
  },
  textarea: {
    description: "Orbit TextArea façade.",
    importPath: "@/components/ui/textarea",
    orbit: "TextArea",
  },
  "toggle-group": {
    description: "Toggle group (no Orbit equiv yet).",
    importPath: "@/components/ui/toggle-group",
  },
  tooltip: {
    description: "Orbit Tooltip re-export.",
    importPath: "@/components/ui/tooltip",
    orbit: "Tooltip",
  },
};

/** Registry blurb for kit composites (Phase 4 chrome; Phase 6 surfaces deferred). */
export const DESIGN_KIT_KIT_META: Record<
  DesignKitKitModule,
  { description: string; importPath: string; phase?: "4" | "6" }
> = {
  "ask-agent-card": {
    description: "AI copilot card — Phase 6 surface (deferred).",
    importPath: "@/components/kit/ask-agent-card",
    phase: "6",
  },
  "code-frame": {
    description: "Shiki body · Orbit chrome (Phase 4).",
    importPath: "@/components/kit/code-frame",
    phase: "4",
  },
  "command-bar": {
    description: "⌘K trigger/item chrome · cmdk dialog kept (Phase 4).",
    importPath: "@/components/kit/command-bar",
    phase: "4",
  },
  "data-table": {
    description: "Orbit DataTable façade (TanStack Table v9 · manual sort/page).",
    importPath: "@/components/kit/data-table",
    phase: "4",
  },
  "empty-state": {
    description: "Empty / first-run / quiet states on Box/Text (Phase 4).",
    importPath: "@/components/kit/empty-state",
    phase: "4",
  },
  "filter-bar": {
    description: "Filter chip row chrome (Phase 4).",
    importPath: "@/components/kit/filter-bar",
    phase: "4",
  },
  "inbox-lifecycle-cue": {
    description: "Inbox lifecycle cue — Phase 6 (deferred).",
    importPath: "@/components/kit/inbox-lifecycle-cue",
    phase: "6",
  },
  "inbox-read-cue": {
    description: "Inbox read cue — Phase 6 (deferred).",
    importPath: "@/components/kit/inbox-read-cue",
    phase: "6",
  },
  "issue-row-shell": {
    description: "Issue row shell — Phase 6 (deferred).",
    importPath: "@/components/kit/issue-row-shell",
    phase: "6",
  },
  "nav-count-pastille": {
    description: "Nav count pastille (Phase 4).",
    importPath: "@/components/kit/nav-count-pastille",
    phase: "4",
  },
  "page-shell": {
    description: "Page density shell — gutter + centered main column (Phase 4).",
    importPath: "@/components/kit/page-shell",
    phase: "4",
  },
  "polar-card": {
    description: "Polar gallery card (Orbit Box chrome; no Orbit Card).",
    importPath: "@/components/kit/polar-card",
    phase: "4",
  },
  "product-tour": {
    description: "driver.js tour + app.css popover — leave as-is.",
    importPath: "@/components/kit/product-tour",
  },
  "section-card": {
    description: "Section card chrome (Phase 4).",
    importPath: "@/components/kit/section-card",
    phase: "4",
  },
  "telemetry-chart": {
    description: "Telemetry chart — Phase 6 (deferred).",
    importPath: "@/components/kit/telemetry-chart",
    phase: "6",
  },
  "time-window-select": {
    description: "Thin Orbit Select wrapper.",
    importPath: "@/components/kit/time-window-select",
    phase: "4",
  },
  "usage-meter-card": {
    description: "Usage meter card on Orbit · Progress still ui (Phase 4).",
    importPath: "@/components/kit/usage-meter-card",
    phase: "4",
  },
};

/**
 * Playground IA — mirrors orbit.polar.sh (Principles / Foundations / Components)
 * plus Polar handbook.polar.sh/design and Epure recipes.
 * Sidebar order = DESIGN_KIT_SECTION_GROUPS; nested leaves are UI/Kit/Feature modules.
 */
export const DESIGN_KIT_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    group: "Start",
    keywords: "home intro orbit catalog registry principles foundations",
  },
  {
    id: "handbook",
    label: "Design at Polar",
    group: "Handbook",
    keywords: "handbook vision governing principle perception brand pillars",
  },
  {
    id: "principles",
    label: "Principles",
    group: "Handbook",
    keywords: "subtraction derived decorated precision respect",
  },
  {
    id: "product-design",
    label: "Product design",
    group: "Handbook",
    keywords: "density polish debt speed data artifact",
  },
  {
    id: "visual-design",
    label: "Visual design",
    group: "Handbook",
    keywords: "typography motion magnetism polar coordinates",
  },
  {
    id: "voice-tone",
    label: "Voice & tone",
    group: "Handbook",
    keywords: "copy writing developer point of view",
  },
  {
    id: "llm-contract",
    label: "LLM contract",
    group: "Handbook",
    keywords: "adr-0004 box text tokens eslint orbit zone agents",
  },
  {
    id: "recipes",
    label: "Recipes",
    group: "Cookbook",
    keywords: "stack card toolbar empty loading error grid box text copy",
  },
  {
    id: "brand",
    label: "Brand identity",
    group: "Brand",
    keywords: "vision mission logo mark voice accent",
  },
  {
    id: "brand-tokens",
    label: "Live token craft",
    group: "Brand",
    keywords: "edit color css variable accent paper",
  },
  {
    id: "brand-assets",
    label: "Marks & assets",
    group: "Brand",
    keywords: "logo svg favicon lockup",
  },
  {
    id: "tokens",
    label: "Colors",
    group: "Foundations",
    keywords: "palette swatch semantic danger success orbit background text border",
  },
  {
    id: "typography",
    label: "Typography",
    group: "Foundations",
    keywords: "inter geist type scale mono",
  },
  {
    id: "space-radius",
    label: "Spacing & radius",
    group: "Foundations",
    keywords: "spacing elevation shadow control",
  },
  {
    id: "motion",
    label: "Motion",
    group: "Foundations",
    keywords: "duration ease decelerate accelerate transition",
  },
  {
    id: "libraries",
    label: "Icons & libraries",
    group: "Foundations",
    keywords: "radix orbit vaul sonner cmdk phosphor icons",
  },
  {
    id: "primitives",
    label: "UI primitives",
    group: "Components",
    keywords: "components ui orbit wrappers",
  },
  {
    id: "kit",
    label: "Composite kit",
    group: "Components",
    keywords: "kit composites empty page-shell",
  },
  {
    id: "feature-ui",
    label: "Feature UI",
    group: "Feature",
    keywords: "src/ui product screens",
  },
  {
    id: "alerts-patterns",
    label: "Alerts",
    group: "Lab",
    keywords: "toast alert history firing",
  },
  {
    id: "states",
    label: "State matrix",
    group: "Lab",
    keywords: "idle active busy error stress",
  },
  {
    id: "shell",
    label: "App shell",
    group: "Lab",
    keywords: "chrome rail navbar phase6",
  },
  {
    id: "a11y",
    label: "Accessibility",
    group: "Quality",
    keywords: "focus reduced-motion keyboard contrast",
  },
  {
    id: "product-docs",
    label: "Repo markdown",
    group: "Quality",
    keywords: "markdown system qa recipes orbit contract",
  },
] as const;

export const DESIGN_KIT_SECTION_GROUPS = [
  "Start",
  "Handbook",
  "Cookbook",
  "Brand",
  "Foundations",
  "Components",
  "Feature",
  "Lab",
  "Quality",
] as const;

export type DesignKitSectionId = (typeof DESIGN_KIT_SECTIONS)[number]["id"];
