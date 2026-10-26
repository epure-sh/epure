import assert from "node:assert/strict";
import type { AlertRow } from "../../lib/api";
import {
  countAlertsByKind,
  countAlertsForViewModes,
  filterAlerts,
  filterAlertsByViewMode,
  getAlertDetail,
  groupAlertsByDay,
  getAlertSignalState,
  isAlertUnread,
  sortAlerts,
  ALERT_FIRING_WINDOW_MS,
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

// Resolved alert filtering
const resolvedAlert = sampleAlert({
  id: "alert-4",
  read_at: baseDate.toISOString(),
  ignored: false,
});
assert.equal(filterAlertsByViewMode([velocity, regression, ignored, resolvedAlert], "resolved").length, 1);
assert.equal(filterAlertsByViewMode([velocity, regression, ignored, resolvedAlert], "resolved")[0]?.id, "alert-4");
assert.equal(countAlertsForViewModes([velocity, regression, ignored, resolvedAlert], "7d").resolved, 1);

// formatAlertListTime and getAlertDayGroupLabel
import { formatAlertListTime, getAlertDayGroupLabel } from "./alert-utils";
const now = new Date("2026-10-22T15:00:00.000Z").getTime();
// Same day: formats local time
const todayTime = formatAlertListTime("2026-10-22T14:30:00.000Z", now);
assert.ok(todayTime !== "—" && !todayTime.includes("d"));

// Clock skew slightly in future: still labels as "Today"
const futureSkewLabel = getAlertDayGroupLabel("2026-10-22T15:05:00.000Z", now);
assert.equal(futureSkewLabel, "Today");

// Yesterday label
const yesterdayLabel = getAlertDayGroupLabel("2026-10-21T12:00:00.000Z", now);
assert.equal(yesterdayLabel, "Yesterday");

// ALERT_KIND_FILTERS includes custom rule
import { ALERT_KIND_FILTERS } from "./alert-utils";
assert.ok(ALERT_KIND_FILTERS.some((filter) => filter.value === "custom"));

// groupAlertsByDay with sort parameter
const day1Older = sampleAlert({
  id: "alert-day1-old",
  fired_at: "2026-10-20T10:00:00.000Z",
  kind: "velocity_spike",
});
const day2NewerDanger = sampleAlert({
  id: "alert-day2-danger",
  fired_at: "2026-10-22T10:00:00.000Z",
  kind: "regression",
});
const day2NewerWarning = sampleAlert({
  id: "alert-day2-warning",
  fired_at: "2026-10-22T11:00:00.000Z",
  kind: "velocity_spike",
});

// Sorted newest first: day2 group should be first, and inside day2 warning (11:00) before danger (10:00)
const newestGroups = groupAlertsByDay([day1Older, day2NewerDanger, day2NewerWarning], "newest", now);
assert.equal(newestGroups.length, 2);
assert.equal(newestGroups[0]?.alerts[0]?.id, "alert-day2-warning");
assert.equal(newestGroups[0]?.alerts[1]?.id, "alert-day2-danger");
assert.equal(newestGroups[1]?.alerts[0]?.id, "alert-day1-old");

// Sorted oldest first: day1 group should be first, and inside day2 danger (10:00) before warning (11:00)
const oldestGroups = groupAlertsByDay([day1Older, day2NewerDanger, day2NewerWarning], "oldest", now);
assert.equal(oldestGroups.length, 2);
assert.equal(oldestGroups[0]?.alerts[0]?.id, "alert-day1-old");
assert.equal(oldestGroups[1]?.alerts[0]?.id, "alert-day2-danger");
assert.equal(oldestGroups[1]?.alerts[1]?.id, "alert-day2-warning");

// Sorted severity: within day2, danger alert should be before warning alert
const severityGroups = groupAlertsByDay([day1Older, day2NewerDanger, day2NewerWarning], "severity", now);
assert.equal(severityGroups.length, 2);
assert.equal(severityGroups[0]?.alerts[0]?.id, "alert-day2-danger");
assert.equal(severityGroups[0]?.alerts[1]?.id, "alert-day2-warning");

const signalNow = baseDate.getTime();
assert.equal(getAlertSignalState(sampleAlert({ fired_at: baseDate.toISOString() }), signalNow), "firing");
assert.equal(
  getAlertSignalState(
    sampleAlert({ fired_at: new Date(signalNow - ALERT_FIRING_WINDOW_MS - 1).toISOString() }),
    signalNow,
  ),
  "fired",
);
assert.equal(
  getAlertSignalState(sampleAlert({ read_at: baseDate.toISOString() }), signalNow),
  "acknowledged",
);
assert.equal(getAlertSignalState(sampleAlert({ ignored: true }), signalNow), "muted");
