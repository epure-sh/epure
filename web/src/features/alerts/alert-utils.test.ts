import assert from "node:assert/strict";
import type { AlertRow } from "../../lib/api";
import {
  countAlertsByKind,
  countAlertsForViewModes,
  filterAlerts,
  filterAlertsByViewMode,
  getAlertDetail,
  groupAlertsByDay,
  isAlertUnread,
  sortAlerts,
} from "./alert-utils";

const baseDate = new Date("2026-10-22T14:00:00.000Z");

function sampleAlert(overrides: Partial<AlertRow> = {}): AlertRow {
  return {
    id: "alert-1",
    org_id: "org-1",
    project_id: "project-1",
    issue_id: "issue-1",
    kind: "velocity_spike",
    fired_at: baseDate.toISOString(),
    payload_json: {
      title: "Checkout failed",
      current_window: 20,
      previous_window: 4,
      ratio: 5,
    },
    read_at: null,
    ignored: false,
    ...overrides,
  };
}

const velocity = sampleAlert();
const regression = sampleAlert({
  id: "alert-2",
  kind: "regression",
  fired_at: new Date(baseDate.getTime() - 2 * 60 * 60 * 1000).toISOString(),
  payload_json: {
    title: "Hydration mismatch",
    release: "web@2.1.0",
    resolved_in_release: "web@2.0.0",
  },
});
const ignored = sampleAlert({
  id: "alert-3",
  kind: "new_issue",
  ignored: true,
  read_at: baseDate.toISOString(),
});

assert.equal(filterAlerts([velocity, regression], { kind: "regression" }).length, 1);
assert.equal(countAlertsByKind([velocity, regression]).regression, 1);
assert.equal(
  getAlertDetail(regression),
  "Reappeared in web@2.1.0 after resolving in web@2.0.0",
);
assert.equal(sortAlerts([velocity, regression], "severity")[0]?.kind, "regression");
assert.equal(isAlertUnread(velocity), true);
assert.equal(filterAlertsByViewMode([velocity, regression, ignored], "unread").length, 2);
assert.equal(filterAlertsByViewMode([velocity, regression, ignored], "ignored").length, 1);
assert.equal(filterAlertsByViewMode([velocity, regression, ignored], "all").length, 3);
assert.equal(countAlertsForViewModes([velocity, regression], "7d").unread, 2);
assert.equal(groupAlertsByDay([velocity, regression]).length, 1);

// Edge cases: null/undefined inputs
assert.equal(filterAlerts(null as any).length, 0);
assert.equal(filterAlerts(undefined as any).length, 0);
assert.deepEqual(countAlertsByKind(null as any), { velocity: 0, regression: 0, newIssue: 0 });
assert.equal(countAlertsByKind(null as any).velocity, 0);
assert.equal(sortAlerts(null as any).length, 0);
assert.equal(filterAlertsByViewMode(null as any, "all").length, 0);
assert.equal(countAlertsForViewModes(null as any).unread, 0);
assert.equal(groupAlertsByDay(null as any).length, 0);

// Null or corrupt alert rows
assert.equal(isAlertUnread(null as any), false);
assert.equal(getAlertDetail(null as any), "");
const emptyPayloadAlert = sampleAlert({ payload_json: null as any });
assert.equal(getAlertDetail(emptyPayloadAlert), "Event rate jumped more than 300% in 15 minutes");
const emptyObjPayloadAlert = sampleAlert({ payload_json: {} });
assert.equal(getAlertDetail(emptyObjPayloadAlert), "Event rate jumped more than 300% in 15 minutes");

// Stringified payload_json edge case
const stringifiedPayloadAlert = sampleAlert({
  payload_json: JSON.stringify({
    title: "Serialized crash",
    current_window: 10,
    previous_window: 2,
    ratio: 5,
  }) as any,
});
assert.match(getAlertDetail(stringifiedPayloadAlert), /10 events in 15m/);

// Corrupted/NaN date in sortAlerts
const corruptedDateAlert = sampleAlert({ fired_at: "not-a-date" });
const sortedWithCorrupted = sortAlerts([corruptedDateAlert, velocity]);
assert.equal(sortedWithCorrupted.length, 2);
assert.equal(sortedWithCorrupted[0]?.id, velocity.id);
