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

function sampleAlert(overrides: Partial<AlertRow> = {}): AlertRow {
  return {
    id: "alert-1",
    org_id: "org-1",
    project_id: "project-1",
    issue_id: "issue-1",
    kind: "velocity_spike",
    fired_at: new Date().toISOString(),
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
  fired_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
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
  read_at: new Date().toISOString(),
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
