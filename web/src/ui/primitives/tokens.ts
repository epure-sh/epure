// web/src/ui/primitives/tokens.ts
// Foundation tokens bridging Orbit StyleX tokens and semantic light-dark tokens to CSS variables.

export * from "@polar-sh/orbit/theme";

/**
 * CSS Custom Property tokens bridging Orbit StyleX tokens and Epure theme variables.
 * Allows components to reference both StyleX token identifiers and CSS custom properties.
 */
export const CSS_VARIABLES = {
  // Theme surfaces & colors
  bg: "var(--bg)",
  bgSubtle: "var(--bg-subtle)",
  surface: "var(--surface)",
  surfaceInset: "var(--surface-inset)",
  surfaceElevated: "var(--surface-elevated)",
  surfaceRaised: "var(--surface-raised)",
  border: "var(--border)",
  borderStrong: "var(--border-strong)",
  text: "var(--text)",
  textMuted: "var(--text-muted)",
  textSubtle: "var(--text-subtle)",
  textInverse: "var(--text-inverse)",
  accent: "var(--accent)",
  accentMuted: "var(--accent-muted)",
  accentContrast: "var(--accent-contrast)",
  signal: "var(--signal)",
  signalMuted: "var(--signal-muted)",
  signalContrast: "var(--signal-contrast)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  focusRing: "var(--focus-ring)",

  // Typography
  fontSans: "var(--font-sans)",
  fontDisplay: "var(--font-display)",
  fontMono: "var(--font-mono)",

  // Geometry & Radii
  radiusXs: "var(--radius-xs, 4px)",
  radiusSm: "var(--radius-sm, 8px)",
  radiusMd: "var(--radius-md, 12px)",
  radiusLg: "var(--radius-lg, 16px)",
  radiusXl: "var(--radius-xl, 32px)",

  // Motion
  durationFast: "var(--duration-fast, 120ms)",
  durationBase: "var(--duration-base, 200ms)",
  durationPanel: "var(--duration-panel, 320ms)",
  easeMechanical: "var(--ease-mechanical, cubic-bezier(0, 0, 0, 1))",
  easeOutSoft: "var(--ease-out-soft, cubic-bezier(0.2, 0, 0, 1))",
  easeOut: "var(--ease-out, cubic-bezier(0, 0, 0, 1))",
  easeDrawer: "var(--ease-drawer, cubic-bezier(0.3, 0, 1, 1))",
} as const;

/**
 * Static mapping bridge from Orbit token names to Epure CSS variable names.
 */
export const orbitCssVariableBridge = {
  surfaces: {
    "background-primary": "--bg",
    "background-secondary": "--bg-subtle",
    "background-card": "--surface-inset",
    "background-inverse": "--text",
    "background-accent": "--accent-muted",
    "background-warning": "--badge-regression-bg",
    "background-success": "--badge-healthy-bg",
    "background-danger": "--badge-escalating-bg",
  },
  text: {
    "text-primary": "--text",
    "text-secondary": "--text-muted",
    "text-tertiary": "--text-subtle",
    "text-disabled": "--text-subtle",
    "text-success": "--success",
    "text-danger": "--danger",
    "text-warning": "--warning",
    "text-accent": "--accent",
  },
  borders: {
    "border-primary": "--border",
    "border-secondary": "--border-strong",
    "border-warning": "--badge-regression-border",
  },
  radii: {
    none: "0px",
    s: "var(--radius-sm, 8px)",
    m: "var(--radius-md, 12px)",
    l: "var(--radius-lg, 16px)",
    xl: "var(--radius-xl, 32px)",
    full: "9999px",
  },
  motion: {
    durations: {
      instant: "0ms",
      fast: "var(--duration-fast, 120ms)",
      base: "var(--duration-base, 200ms)",
      slow: "var(--duration-panel, 320ms)",
      slower: "480ms",
    },
    easings: {
      standard: "var(--ease-out-soft, cubic-bezier(0.2, 0, 0, 1))",
      decelerate: "var(--ease-out, cubic-bezier(0, 0, 0, 1))",
      accelerate: "var(--ease-drawer, cubic-bezier(0.3, 0, 1, 1))",
      spring: "var(--ease-mechanical, cubic-bezier(0, 0, 0, 1))",
    },
  },
} as const;
