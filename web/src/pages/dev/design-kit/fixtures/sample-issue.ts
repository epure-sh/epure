import type { EventDetail, IssueSummary } from "@/lib/api";

export const DESIGN_KIT_SAMPLE_ISSUE: IssueSummary = {
  id: "a1000001-0000-4000-8000-000000000001",
  org_id: "11111111-1111-1111-1111-111111111111",
  project_id: "550e8400-e29b-41d4-a716-446655440000",
  fingerprint: "fp-preview",
  title: "TypeError: Cannot read properties of undefined (reading 'total')",
  status: "unresolved",
  level: "error",
  environment: "production",
  release: "web@2.15.0",
  event_count: 462,
  unique_user_count: 111,
  last_seen_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  first_seen_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  resolved_in_release: null,
  snoozed: false,
  snooze_until: null,
  snooze_until_count: null,
  snooze_until_users: null,
};

export const DESIGN_KIT_SAMPLE_EVENT: EventDetail = {
  id: "evt-preview",
  issue_id: DESIGN_KIT_SAMPLE_ISSUE.id,
  occurred_at: new Date().toISOString(),
  environment: "production",
  release: "web@2.15.0",
  platform: "javascript",
  runtime_name: "browser",
  runtime_version: "122",
  browser_name: "Chrome",
  os_name: "macOS",
  user_id: "user-1",
  user_email: "dev@epure.local",
  payload_json: {
    transaction: "checkout.submit",
    culprit: "src/checkout.ts:42",
  },
  stack_frames: [{ filename: "src/checkout.ts", lineno: 42, function: "submit" }],
  breadcrumbs: [],
};
