import assert from "node:assert/strict";
import type { AlertRow } from "../../lib/api";
import {
  countAlertsByKind,
  filterAlerts,
  getAlertDetail,
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

assert.equal(filterAlerts([velocity, regression], { kind: "regression" }).length, 1);
assert.equal(countAlertsByKind([velocity, regression]).regression, 1);
assert.equal(
  getAlertDetail(regression),
  "Reappeared in web@2.1.0 after resolving in web@2.0.0",
);
assert.equal(sortAlerts([velocity, regression], "severity")[0]?.kind, "regression");
