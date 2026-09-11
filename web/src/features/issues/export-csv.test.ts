import assert from "node:assert/strict";
import type { IssueSummary } from "../../lib/api";
import { issuesToCsv } from "./export-csv";

const issue: IssueSummary = {
  id: "issue-1",
  org_id: "org-1",
  project_id: "project-1",
  fingerprint: "fp-abc",
  title: "TypeError: boom, \"quoted\"",
  status: "unresolved",
  level: "error",
  environment: "production",
  release: "web@1.0.0",
  event_count: 12,
  unique_user_count: 3,
  last_seen_at: "2026-09-19T10:00:00.000Z",
  first_seen_at: "2026-09-18T10:00:00.000Z",
  resolved_in_release: null,
  snoozed: false,
  snooze_until: null,
  snooze_until_count: null,
  snooze_until_users: null,
};

const csv = issuesToCsv([issue]);
assert.match(csv, /^title,status,count,users,env,release,last_seen,first_seen,fingerprint\n/);
assert.match(csv, /"TypeError: boom, ""quoted"""/);
assert.match(csv, /unresolved,12,3,production/);
assert.match(csv, /fp-abc/);
