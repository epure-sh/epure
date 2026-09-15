import { useSyncExternalStore } from "react";

/** Calm Ledger (Indigo) — the only production style theme. */
export const STYLE_THEMES = [{ id: "calm-ledger", label: "Calm Ledger" }] as const;

export type StyleThemeId = (typeof STYLE_THEMES)[number]["id"];

const STORAGE_KEY = "epure-style-theme";
const DEFAULT_STYLE: StyleThemeId = "calm-ledger";

/** Any stored or legacy theme id maps to calm-ledger. */
const LEGACY_STYLE_MAP: Record<string, StyleThemeId> = {
  "signal-room": "calm-ledger",
  "plausible-calm": "calm-ledger",
  "linear-instrument": "calm-ledger",
  "instrument-cool": "calm-ledger",
  "instrument-console": "calm-ledger",
  "quiet-ledger": "calm-ledger",
  "calm-dense": "calm-ledger",
  "calm-ledger-slate": "calm-ledger",
  "calm-ledger-sage": "calm-ledger",
  "calm-ledger-ink": "calm-ledger",
  "calm-ledger-violet": "calm-ledger",
  "calm-ledger-amber": "calm-ledger",
  "calm-ledger-ocean": "calm-ledger",
  "calm-ledger-rose": "calm-ledger",
  "calm-ledger-moss": "calm-ledger",
  "calm-ledger-graphite": "calm-ledger",
  "calm-ledger-coral": "calm-ledger",
  "calm-ledger-frost": "calm-ledger",
};

export function isStyleThemeId(value: string | null | undefined): value is StyleThemeId {
  return value === DEFAULT_STYLE;
}

function normalizeStyleId(value: string | null | undefined): StyleThemeId {
  if (!value || value === DEFAULT_STYLE) {
    return DEFAULT_STYLE;
  }
  return LEGACY_STYLE_MAP[value] ?? DEFAULT_STYLE;
}

export function getStoredStyleTheme(): StyleThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizeStyleId(stored);
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_STYLE;
}

export function applyStyleTheme(id: StyleThemeId = DEFAULT_STYLE): void {
  document.documentElement.setAttribute("data-style", id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* localStorage unavailable */
  }
}

/** Call before React mount to avoid theme flash. */
export function initStyleTheme(): StyleThemeId {
  const id = getStoredStyleTheme();
  applyStyleTheme(id);
  return id;
}

export function getStyleTheme(): StyleThemeId {
  if (typeof document === "undefined") {
    return DEFAULT_STYLE;
  }
  const attr = document.documentElement.getAttribute("data-style");
  return normalizeStyleId(attr);
}

export type IssuesLayoutMode = "overlay" | "split-narrow" | "split-recessed";
export type StatBarVariant = "cards" | "rules" | "inline";
export type IssueRowVariant = "airy" | "standard" | "dense";

export function getIssuesLayoutMode(_theme?: StyleThemeId): IssuesLayoutMode {
  return "overlay";
}

export function getStatBarVariant(_theme?: StyleThemeId): StatBarVariant {
  return "cards";
}

export function getIssueRowVariant(_theme?: StyleThemeId): IssueRowVariant {
  return "airy";
}

export function useIssuesLayoutMode(): IssuesLayoutMode {
  return getIssuesLayoutMode();
}

function subscribeStyleTheme(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-style"],
  });
  return () => observer.disconnect();
}

/** Reactive theme id — always calm-ledger; re-renders if data-style changes. */
export function useStyleTheme(): StyleThemeId {
  return useSyncExternalStore(subscribeStyleTheme, getStyleTheme, () => DEFAULT_STYLE);
}
