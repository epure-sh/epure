/** Shared feed time horizons (Issues, Alerts history, etc.). */
export type TimeWindowValue = "24h" | "7d" | "14d" | "30d" | "90d";

export const DEFAULT_TIME_WINDOW: TimeWindowValue = "7d";

export const TIME_WINDOW_OPTIONS: ReadonlyArray<{
  value: TimeWindowValue;
  label: string;
}> = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const TIME_WINDOW_SET = new Set<string>(TIME_WINDOW_OPTIONS.map((option) => option.value));

/** Short horizon label for toolbars (e.g. `7D`, `ALL`). */
export function getTimeWindowShortLabel(value: string): string {
  if (value === "all") {
    return "All";
  }
  return value.toUpperCase();
}

export function getTimeWindowLabel(value: TimeWindowValue): string {
  return TIME_WINDOW_OPTIONS.find((option) => option.value === value)?.label ?? "Last 7 days";
}

export function parseTimeWindow(raw: string | null | undefined): TimeWindowValue {
  if (raw && TIME_WINDOW_SET.has(raw)) {
    return raw as TimeWindowValue;
  }
  return DEFAULT_TIME_WINDOW;
}

export function timeWindowCutoffMs(window: TimeWindowValue | "all", now = Date.now()): number | null {
  switch (window) {
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "14d":
      return now - 14 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "90d":
      return now - 90 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}
