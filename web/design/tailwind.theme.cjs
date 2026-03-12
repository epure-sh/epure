/** Tailwind theme fragment — merge into tailwind.config.* theme.extend */
module.exports = {
  fontFamily: {
    sans: ["var(--font-sans)"],
    mono: ["var(--font-mono)"],
    display: ["var(--font-display)"],
    serif: ["var(--font-docs)"],
  },
  fontWeight: {
    normal: "var(--font-weight-regular)",
    medium: "var(--font-weight-medium)",
  },
  letterSpacing: {
    ui: "var(--tracking-ui)",
  },
  colors: {
    bg: {
      DEFAULT: "var(--bg)",
      subtle: "var(--bg-subtle)",
    },
    surface: {
      DEFAULT: "var(--surface)",
      inset: "var(--surface-inset)",
      elevated: "var(--surface-elevated)",
      raised: "var(--surface-raised)",
    },
    border: {
      DEFAULT: "var(--border)",
      strong: "var(--border-strong)",
    },
    ink: {
      DEFAULT: "var(--text)",
      muted: "var(--text-muted)",
      subtle: "var(--text-subtle)",
      inverse: "var(--text-inverse)",
    },
    accent: {
      DEFAULT: "var(--accent)",
      muted: "var(--accent-muted)",
      contrast: "var(--accent-contrast)",
    },
    signal: {
      DEFAULT: "var(--signal)",
      muted: "var(--signal-muted)",
      contrast: "var(--signal-contrast)",
    },
    semantic: {
      success: "var(--success)",
      warning: "var(--warning)",
      danger: "var(--danger)",
      info: "var(--info)",
    },
    state: {
      hover: "var(--state-hover)",
      selected: "var(--state-selected)",
      pressed: "var(--state-pressed)",
    },
  },
  borderRadius: {
    none: "0",
    sm: "var(--radius-sm)",
    DEFAULT: "var(--radius-md)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)",
    full: "9999px",
  },
  boxShadow: {
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    none: "none",
  },
  borderWidth: {
    DEFAULT: "var(--border-width)",
    1: "1px",
    2: "2px",
  },
};
