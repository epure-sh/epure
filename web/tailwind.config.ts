import type { Config } from "tailwindcss";
import designTheme from "./design/tailwind.theme.cjs";

/**
 * Do NOT remap Tailwind numeric spacing (h-8, px-5, …) onto Epure `--space-*`.
 * Orbit Button/Input/Pill assume the default scale (h-8=2rem, h-10=2.5rem).
 * Epure chrome dims stay as CSS vars (`--space-*`, `--chrome-*`) for explicit use.
 */
const epureSpacing: Record<string, string> = {};
for (let i = 1; i <= 10; i += 1) {
  epureSpacing[`epure-${i}`] = `var(--space-${i})`;
}

export default {
  content: [
    "./index.html",
    "./playground/index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./playground/**/*.{js,ts,jsx,tsx}",
    "../packages/orbit/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      ...designTheme,
      spacing: epureSpacing,
      width: {
        rail: "var(--chrome-rail-width)",
        "issue-list": "var(--chrome-list-width)",
        "control-sm": "var(--control-height-sm)",
      },
      maxWidth: {
        narrow: "var(--content-width-narrow)",
        default: "var(--content-width-default)",
        wide: "var(--content-width-wide)",
        org: "var(--content-width-org)",
      },
      height: {
        "top-strip": "var(--chrome-top-height)",
        "filter-row": "var(--chrome-filter-height)",
        row: "var(--row-height)",
        control: "var(--control-height)",
        "control-sm": "var(--control-height-sm)",
        "control-lg": "var(--control-height-lg)",
      },
      padding: {
        row: "var(--row-padding-y)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        panel: "var(--duration-panel)",
      },
      transitionTimingFunction: {
        mechanical: "var(--ease-mechanical)",
        "out-soft": "var(--ease-out-soft)",
      },
      fontSize: {
        "2xs": ["var(--text-2xs)", { lineHeight: "var(--leading-2xs)" }],
        xs: ["var(--text-xs)", { lineHeight: "var(--leading-xs)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--leading-sm)" }],
        md: ["var(--text-md)", { lineHeight: "var(--leading-md)" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--leading-lg)" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--leading-xl)" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-2xl)" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-3xl)" }],
        "4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-4xl)" }],
        "5xl": ["var(--text-5xl)", { lineHeight: "var(--leading-5xl)" }],
      },
    },
  },
} satisfies Config;
