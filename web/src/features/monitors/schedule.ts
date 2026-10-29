/** Schedule humanizer + next-run estimator for cron monitors (no external cron lib). */

export type ScheduleMode = "interval" | "crontab";
export type IntervalUnit = "minute" | "hour" | "day" | "week";

export interface IntervalSchedule {
  type: "interval";
  value: number;
  unit: IntervalUnit;
}

export interface CrontabSchedule {
  type: "crontab";
  value: string;
  timezone: string;
}

export type MonitorSchedule = IntervalSchedule | CrontabSchedule;

export const INTERVAL_PRESETS: Array<{
  label: string;
  value: number;
  unit: IntervalUnit;
}> = [
  { label: "Every 5 mins", value: 5, unit: "minute" },
  { label: "Every 15 mins", value: 15, unit: "minute" },
  { label: "Hourly", value: 1, unit: "hour" },
  { label: "Daily at midnight", value: 1, unit: "day" },
  { label: "Weekly", value: 1, unit: "week" },
];

export function slugifyMonitorName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function scheduleToStorage(schedule: MonitorSchedule): string {
  if (schedule.type === "interval") {
    return `every ${schedule.value} ${schedule.unit}`;
  }
  return schedule.value.trim();
}

export function parseStoredSchedule(
  raw: string | null | undefined,
  timezone = "UTC",
): MonitorSchedule | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();
  const interval = text.match(/^every\s+(\d+)\s+(minute|hour|day|week)s?$/i);
  if (interval) {
    return {
      type: "interval",
      value: Number(interval[1]),
      unit: interval[2].toLowerCase() as IntervalUnit,
    };
  }
  if (text.split(/\s+/).length === 5) {
    return { type: "crontab", value: text, timezone };
  }
  return { type: "crontab", value: text, timezone };
}

export function humanizeSchedule(schedule: MonitorSchedule): string {
  if (schedule.type === "interval") {
    const { value, unit } = schedule;
    if (value === 1 && unit === "day") return "Daily at midnight";
    if (value === 1 && unit === "week") return "Weekly";
    if (value === 1 && unit === "hour") return "Hourly";
    if (unit === "minute") return `Every ${value} mins`;
    return `Every ${value} ${unit}${value === 1 ? "" : "s"}`;
  }
  return humanizeCrontab(schedule.value, schedule.timezone);
}

function humanizeCrontab(expr: string, timezone: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, , , dow] = parts;

  if (min.startsWith("*/") && hour === "*" && dow === "*") {
    return `Every ${min.slice(2)} mins (${timezone})`;
  }
  if (min === "0" && hour === "*" && dow === "*") {
    return `Hourly at :00 (${timezone})`;
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dow === "*") {
    const h = Number(hour);
    const m = Number(min);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const mm = String(m).padStart(2, "0");
    return `Every day at ${h12}:${mm} ${ampm} (${timezone})`;
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dow === "0") {
    return `Weekly on Sunday at ${hour.padStart(2, "0")}:${min.padStart(2, "0")} (${timezone})`;
  }
  return `${expr} (${timezone})`;
}

export function nextRunDates(
  schedule: MonitorSchedule,
  count = 3,
  from = new Date(),
): Date[] {
  if (schedule.type === "interval") {
    const ms = intervalMs(schedule.value, schedule.unit);
    return Array.from({ length: count }, (_, i) => new Date(from.getTime() + ms * (i + 1)));
  }
  return nextCrontabRuns(schedule.value, schedule.timezone, count, from);
}

function intervalMs(value: number, unit: IntervalUnit): number {
  const n = Math.max(1, value);
  switch (unit) {
    case "minute":
      return n * 60_000;
    case "hour":
      return n * 3_600_000;
    case "day":
      return n * 86_400_000;
    case "week":
      return n * 604_800_000;
  }
}

/** Best-effort next runs for common 5-field crontabs in a named IANA timezone. */
function nextCrontabRuns(expr: string, timezone: string, count: number, from: Date): Date[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const [minF, hourF, , , dowF] = parts;
  const out: Date[] = [];
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);

  for (let step = 0; step < 366 * 24 * 60 && out.length < count; step += 1) {
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    const partsInTz = zonedParts(cursor, timezone);
    if (!fieldMatches(minF, partsInTz.minute)) continue;
    if (!fieldMatches(hourF, partsInTz.hour)) continue;
    if (!fieldMatches(dowF, partsInTz.weekday === 7 ? 0 : partsInTz.weekday)) continue;
    out.push(new Date(cursor.getTime()));
  }
  return out;
}

function zonedParts(date: Date, timeZone: string): {
  minute: number;
  hour: number;
  weekday: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });
  const bits = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    minute: Number(bits.minute ?? 0),
    hour: Number(bits.hour === "24" ? 0 : bits.hour ?? 0),
    weekday: weekdayMap[bits.weekday ?? "Sun"] ?? 0,
  };
}

function fieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;
  if (field.startsWith("*/")) {
    const step = Number(field.slice(2));
    return step > 0 && value % step === 0;
  }
  if (field.includes(",")) {
    return field.split(",").some((part) => fieldMatches(part.trim(), value));
  }
  if (field.includes("-")) {
    const [a, b] = field.split("-").map(Number);
    return value >= a && value <= b;
  }
  return Number(field) === value;
}

export function formatNextRunLabel(date: Date, now = new Date()): string {
  const sameDay =
    date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `Tonight at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCountdown(targetIso: string | null, now = Date.now()): string {
  if (!targetIso) return "Next: unscheduled";
  const delta = Date.parse(targetIso) - now;
  if (Number.isNaN(delta)) return "Next: unscheduled";
  if (delta < 0) {
    const overdue = Math.abs(delta);
    return `Overdue by ${formatShortDuration(overdue)}`;
  }
  return `Next in ${formatShortDuration(delta)}`;
}

export function formatShortDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  if (hr < 48) return rem ? `${hr}h ${rem}m` : `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

export function estimateNextCheckInIso(
  schedule: MonitorSchedule | null,
  from = new Date(),
): string | null {
  if (!schedule) return null;
  const next = nextRunDates(schedule, 1, from)[0];
  return next ? next.toISOString() : null;
}
