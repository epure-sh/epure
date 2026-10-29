import {
  detectBrowserTimezone,
  humanizeSchedule,
  parseStoredSchedule,
  slugifyMonitorName,
  type IntervalUnit,
  type MonitorSchedule,
  type ScheduleMode,
} from "@/features/monitors/schedule";

export type MonitorTemplateId =
  | "every-15m"
  | "hourly"
  | "nightly"
  | "weekly"
  | "custom";

export interface MonitorTemplate {
  id: MonitorTemplateId;
  title: string;
  blurb: string;
  mode: ScheduleMode;
  intervalValue?: number;
  intervalUnit?: IntervalUnit;
  crontab?: string;
  checkinMarginMins: number;
  maxRuntimeMins: number;
  failureIssueThreshold: number;
}

export const MONITOR_TEMPLATES: MonitorTemplate[] = [
  {
    id: "every-15m",
    title: "Every 15 mins",
    blurb: "Workers, sync jobs, queues",
    mode: "interval",
    intervalValue: 15,
    intervalUnit: "minute",
    checkinMarginMins: 5,
    maxRuntimeMins: 15,
    failureIssueThreshold: 2,
  },
  {
    id: "hourly",
    title: "Hourly",
    blurb: "Reports, light batch work",
    mode: "interval",
    intervalValue: 1,
    intervalUnit: "hour",
    checkinMarginMins: 5,
    maxRuntimeMins: 30,
    failureIssueThreshold: 1,
  },
  {
    id: "nightly",
    title: "Nightly",
    blurb: "Backups and payouts at 02:00",
    mode: "crontab",
    crontab: "0 2 * * *",
    checkinMarginMins: 15,
    maxRuntimeMins: 60,
    failureIssueThreshold: 1,
  },
  {
    id: "weekly",
    title: "Weekly",
    blurb: "Sunday maintenance windows",
    mode: "crontab",
    crontab: "0 3 * * 0",
    checkinMarginMins: 30,
    maxRuntimeMins: 60,
    failureIssueThreshold: 1,
  },
  {
    id: "custom",
    title: "Custom",
    blurb: "Your own interval or crontab",
    mode: "interval",
    intervalValue: 15,
    intervalUnit: "minute",
    checkinMarginMins: 5,
    maxRuntimeMins: 30,
    failureIssueThreshold: 1,
  },
];

export interface CreateMonitorDraft {
  templateId: MonitorTemplateId | null;
  name: string;
  slug: string;
  slugTouched: boolean;
  environment: string;
  mode: ScheduleMode;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  crontab: string;
  timezone: string;
  checkinMarginMins: number;
  maxRuntimeMins: number;
  failureIssueThreshold: number;
  channelIds: string[];
}

export function emptyMonitorDraft(environment = "production"): CreateMonitorDraft {
  return {
    templateId: null,
    name: "",
    slug: "",
    slugTouched: false,
    environment,
    mode: "interval",
    intervalValue: 15,
    intervalUnit: "minute",
    crontab: "0 2 * * *",
    timezone: detectBrowserTimezone(),
    checkinMarginMins: 5,
    maxRuntimeMins: 30,
    failureIssueThreshold: 1,
    channelIds: [],
  };
}

export function applyTemplate(
  draft: CreateMonitorDraft,
  templateId: MonitorTemplateId,
): CreateMonitorDraft {
  const t = MONITOR_TEMPLATES.find((item) => item.id === templateId);
  if (!t) return { ...draft, templateId };
  return {
    ...draft,
    templateId,
    mode: t.mode,
    intervalValue: t.intervalValue ?? draft.intervalValue,
    intervalUnit: t.intervalUnit ?? draft.intervalUnit,
    crontab: t.crontab ?? draft.crontab,
    checkinMarginMins: t.checkinMarginMins,
    maxRuntimeMins: t.maxRuntimeMins,
    failureIssueThreshold: t.failureIssueThreshold,
  };
}

export function draftToSchedule(draft: CreateMonitorDraft): MonitorSchedule {
  if (draft.mode === "interval") {
    return {
      type: "interval",
      value: Math.max(1, draft.intervalValue),
      unit: draft.intervalUnit,
    };
  }
  return {
    type: "crontab",
    value: draft.crontab.trim() || "0 * * * *",
    timezone: draft.timezone,
  };
}

export function describeMonitorDraft(draft: CreateMonitorDraft): string {
  const schedule = draftToSchedule(draft);
  const when = humanizeSchedule(schedule);
  const name = draft.name.trim() || "Untitled monitor";
  return `${name} · ${when}`;
}

export function canAdvanceMonitor(
  step: 1 | 2 | 3,
  draft: CreateMonitorDraft,
): boolean {
  if (step === 1) return Boolean(draft.templateId);
  if (step === 2) {
    return Boolean(draft.name.trim() && draft.slug.trim());
  }
  return Boolean(draft.name.trim() && draft.slug.trim());
}

export function canCreateMonitor(draft: CreateMonitorDraft): boolean {
  return canAdvanceMonitor(2, draft) && canAdvanceMonitor(3, draft);
}

export function withAutoSlug(draft: CreateMonitorDraft, name: string): CreateMonitorDraft {
  return {
    ...draft,
    name,
    slug: draft.slugTouched ? draft.slug : slugifyMonitorName(name),
  };
}

/** Prefill the edit form from an existing monitor row (slug stays locked). */
export function draftFromMonitor(monitor: {
  name: string | null;
  slug: string;
  environment: string | null;
  schedule: string | null;
  timezone: string | null;
  checkin_margin_mins: number;
  max_runtime_mins: number;
  failure_issue_threshold: number;
}): CreateMonitorDraft {
  const parsed = parseStoredSchedule(monitor.schedule, monitor.timezone ?? "UTC");
  const mode: ScheduleMode = parsed?.type === "crontab" ? "crontab" : "interval";
  return {
    templateId: "custom",
    name: (monitor.name || monitor.slug || "").trim(),
    slug: monitor.slug,
    slugTouched: true,
    environment: monitor.environment || "production",
    mode,
    intervalValue: parsed?.type === "interval" ? parsed.value : 15,
    intervalUnit: parsed?.type === "interval" ? parsed.unit : "minute",
    crontab: parsed?.type === "crontab" ? parsed.value : "0 2 * * *",
    timezone: monitor.timezone || detectBrowserTimezone(),
    checkinMarginMins: monitor.checkin_margin_mins,
    maxRuntimeMins: monitor.max_runtime_mins,
    failureIssueThreshold: monitor.failure_issue_threshold,
    channelIds: [],
  };
}
