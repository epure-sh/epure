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
  getAlertSignalStateLabel,
  getAlertConditionChip,
  getAlertCorrelatedIssueIds,
  getAlertDetailHeadline,
  getAlertDetailHeroMetric,
  normalizeIssueIdForCompare,
  getAlertDetailTriggerSummary,
  getAlertListProofSnippet,
  getAlertTriggerAnalysisCallout,
  getAlertTriggerExplanation,
  isAlertUnread,
  sortAlerts,
  ALERT_FIRING_WINDOW_MS,
  alertMatchesHistoryRuleFocus,
  alertMatchesRuleName,
  getAlertHistoryKindFilter,
  formatAlertTimestampPrecise,
  getAlertDetailStructuredFields,
  getAlertLatestDeliveredAtIso,
  getAlertOutputsCollapsedPreview,
  isoTimestampHasSubsecondPrecision,
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

assert.equal(filterAlerts([velocity, regression], { kind: "regression", timeWindow: "all" }).length, 1);
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
assert.equal(countAlertsForViewModes([velocity, regression], "all").unread, 2);
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
assert.equal(countAlertsForViewModes([velocity, regression, ignored, resolvedAlert], "all").resolved, 1);

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

assert.equal(getAlertSignalStateLabel("firing"), "Firing");
assert.equal(getAlertSignalStateLabel("fired"), "Fired");
assert.equal(getAlertSignalStateLabel("acknowledged"), "Resolved");
assert.equal(getAlertSignalStateLabel("muted"), "Snoozed");

assert.match(getAlertConditionChip(velocity), /^Velocity > /);
assert.doesNotMatch(getAlertConditionChip(velocity), /velocity_spike/);
assert.match(getAlertConditionChip(regression), /^Regression · /);

const triggerSummary = getAlertDetailTriggerSummary(velocity);
assert.match(triggerSummary, /Event rate jumped vs the prior 15m window/);
assert.doesNotMatch(triggerSummary, /\+400%/);
assert.doesNotMatch(triggerSummary, /Rule matched:/);
assert.equal(getAlertTriggerAnalysisCallout(velocity), triggerSummary);
assert.equal(getAlertTriggerExplanation(velocity), triggerSummary);

assert.equal(getAlertListProofSnippet(velocity), "+400%");
assert.equal(
  getAlertListProofSnippet(
    sampleAlert({
      kind: "regression",
      payload_json: { title: "x", release: "checkout@2.4.0" },
    }),
  ),
  "checkout@2.4.0",
);

const velocityHero = getAlertDetailHeroMetric(velocity);
assert.equal(velocityHero.value, "+400%");
assert.equal(velocityHero.delta, null);

assert.equal(
  getAlertDetailHeadline(
    sampleAlert({
      kind: "custom",
      payload_json: {
        rule_name: "Checkout errors",
        title: "Checkout errors — Payment declined spike",
      },
    }),
  ),
  "Payment declined spike",
);

assert.equal(
  getAlertDetailHeadline(
    sampleAlert({
      kind: "custom",
      payload_json: {
        rule_name: "Checkout errors",
        title: "Checkout errors: Payment declined spike",
      },
    }),
  ),
  "Payment declined spike",
);

const primaryUuid = "a1000001-0000-4000-8000-000000000001";
const primaryCompact = normalizeIssueIdForCompare(primaryUuid);
assert.deepEqual(
  getAlertCorrelatedIssueIds(
    sampleAlert({
      issue_id: primaryUuid,
      payload_json: {
        title: "Checkout failed",
        issue_ids: [primaryUuid, primaryCompact, "issue-other"],
      },
    }),
  ),
  ["issue-other"],
);

const prodSpikeRuleFocus = {
  ruleName: "Production error spike",
  ruleId: "rul-tmpl-prod-spike",
  kind: "velocity_spike" as const,
};

const velocityWithRuleMeta = sampleAlert({
  id: "velocity-prod-spike",
  kind: "velocity_spike",
  payload_json: {
    title: "Checkout failed",
    rule_id: "rul-tmpl-prod-spike",
    rule_name: "Production error spike",
    rule_kind: "velocity_spike",
    current_window: 20,
    previous_window: 4,
    ratio: 5,
  },
});

const velocityBare = sampleAlert({
  id: "velocity-bare",
  kind: "velocity_spike",
  payload_json: {
    title: "Checkout failed",
    current_window: 20,
    previous_window: 4,
    ratio: 5,
  },
});

const customPayguard = sampleAlert({
  id: "custom-payguard",
  kind: "custom",
  payload_json: {
    rule_id: "rul-payguard-001",
    rule_name: "Payment guard — production",
    rule_kind: "velocity_spike",
    title: "Payment failed",
  },
});

assert.equal(getAlertHistoryKindFilter(velocityWithRuleMeta), "velocity_spike");
assert.equal(getAlertHistoryKindFilter(customPayguard), "velocity_spike");
assert.equal(getAlertHistoryKindFilter(regression), "regression");

assert.equal(
  alertMatchesRuleName(velocityWithRuleMeta, "Production error spike"),
  true,
  "matches configured rule name via payload.rule_name",
);
assert.equal(
  alertMatchesRuleName(velocityWithRuleMeta, "Velocity spike"),
  true,
  "matches built-in display name",
);
assert.equal(
  alertMatchesRuleName(velocityBare, "Production error spike"),
  false,
  "bare velocity alert does not match arbitrary rule name",
);

assert.equal(
  alertMatchesHistoryRuleFocus(velocityWithRuleMeta, prodSpikeRuleFocus),
  true,
  "matches by payload.rule_id",
);
assert.equal(
  alertMatchesHistoryRuleFocus(customPayguard, prodSpikeRuleFocus),
  false,
  "does not match a different rule_id on same kind",
);
assert.equal(
  alertMatchesHistoryRuleFocus(velocityBare, prodSpikeRuleFocus),
  true,
  "falls back to kind when payload has no rule_id",
);

const newProdErrorsFocus = {
  ruleName: "New production errors",
  ruleId: "rul-tmpl-prod-new",
  kind: "new_issue" as const,
};
const newIssueAlert = sampleAlert({
  id: "new-prod",
  kind: "new_issue",
  payload_json: { title: "Fresh error", rule_id: "rul-tmpl-prod-new" },
});
assert.equal(alertMatchesHistoryRuleFocus(newIssueAlert, newProdErrorsFocus), true);

assert.equal(isoTimestampHasSubsecondPrecision("2026-10-22T14:00:00.000Z"), true);
assert.equal(isoTimestampHasSubsecondPrecision("2026-10-22T14:00:00Z"), false);

const preciseMs = formatAlertTimestampPrecise("2026-10-22T14:30:45.123Z", now);
assert.ok(preciseMs.absolute.includes("45"));
assert.equal(preciseMs.isoSubline, "2026-10-22T14:30:45.123Z");
assert.ok(preciseMs.relative.length > 0);

const structuredVelocity = getAlertDetailStructuredFields(velocity, now);
assert.ok(structuredVelocity);
assert.equal(structuredVelocity?.kindChip, "Velocity spike");
assert.ok(structuredVelocity?.triggerRows.some((row) => row.label === "Observed ratio"));
assert.ok(structuredVelocity?.velocityStats?.current === 20);
assert.ok(structuredVelocity?.impactRows.some((row) => row.label.includes("Events")));

const structuredRegression = getAlertDetailStructuredFields(regression, now);
assert.ok(structuredRegression?.linkedIssue?.rows.some((row) => row.label === "Release"));

const dispatchAuditAlert = sampleAlert({
  payload_json: {
    dispatches: [
      { channel: "Slack", target: "#ops", status: "200 OK", delivered_at: "2026-10-22T10:00:00.240Z" },
      { channel: "Webhook", target: "hooks", status: "202", delivered_at: "2026-10-22T10:00:01.991Z" },
    ],
  },
});
assert.equal(getAlertLatestDeliveredAtIso(dispatchAuditAlert), "2026-10-22T10:00:01.991Z");
const collapsedPreview = getAlertOutputsCollapsedPreview(dispatchAuditAlert, now);
assert.ok(collapsedPreview?.includes("Slack #ops"));
assert.ok(collapsedPreview?.includes("Last delivered"));

const velocityWithBoundaries = sampleAlert({
  kind: "velocity_spike",
  payload_json: {
    current_window: 10,
    previous_window: 2,
    ratio: 5,
    current_window_start_at: "2026-10-22T09:45:00.000Z",
    current_window_end_at: "2026-10-22T10:00:00.000Z",
  },
});
const structuredBoundaries = getAlertDetailStructuredFields(velocityWithBoundaries, now);
assert.ok(structuredBoundaries?.impactRows.some((row) => row.label === "Current window"));
