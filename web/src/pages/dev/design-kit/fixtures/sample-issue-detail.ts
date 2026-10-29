import type { EventDetail, IssueTimeline } from "@/lib/api";
import { DESIGN_KIT_SAMPLE_EVENT, DESIGN_KIT_SAMPLE_ISSUE } from "./sample-issue";

export const DESIGN_KIT_SAMPLE_TIMELINE: IssueTimeline = {
  issue_id: DESIGN_KIT_SAMPLE_ISSUE.id,
  event_count: DESIGN_KIT_SAMPLE_ISSUE.event_count,
  stored_event_count: 4,
  buckets: [
    { start: new Date(Date.now() - 6 * 86400000).toISOString(), count: 2 },
    { start: new Date(Date.now() - 5 * 86400000).toISOString(), count: 8 },
    { start: new Date(Date.now() - 4 * 86400000).toISOString(), count: 5 },
    { start: new Date(Date.now() - 3 * 86400000).toISOString(), count: 12 },
  ],
  summary: { last_1h: 3, last_24h: 42, last_7d: 180 },
};

export const DESIGN_KIT_SAMPLE_TAGS = ["env:production", "release:web@2.15.0"];

const secondEvent: EventDetail = {
  ...DESIGN_KIT_SAMPLE_EVENT,
  id: "evt-preview-2",
  occurred_at: new Date(Date.now() - 3600_000).toISOString(),
  browser_name: "Firefox",
  environment: "staging",
  release: "web@2.14.0",
  user_email: "ops@epure.local",
};

const thirdEvent: EventDetail = {
  ...DESIGN_KIT_SAMPLE_EVENT,
  id: "evt-preview-3",
  occurred_at: new Date(Date.now() - 7200_000).toISOString(),
  browser_name: "Chrome",
  environment: "production",
  release: "web@2.15.0",
  user_id: "user-9",
  user_email: null,
};

export const DESIGN_KIT_SAMPLE_EVENTS = [
  DESIGN_KIT_SAMPLE_EVENT,
  secondEvent,
  thirdEvent,
];

export function noopSelectEvent() {
  return undefined;
}
