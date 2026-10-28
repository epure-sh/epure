import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALERT_TEMPLATE_OPTIONS, findAlertTemplate, applyAlertTemplate } from "./alert-rule-templates";
import { bulkAlertAvailability } from "./alert-bulk-utils";
import type { AlertRow } from "@/lib/api";

describe("Alert Rule Contracts and Templates", () => {
  it("enforces backend-supported RuleKind values across all templates", () => {
    const validKinds = new Set(["velocity_spike", "issue_created", "regression"]);
    for (const tpl of ALERT_TEMPLATE_OPTIONS) {
      assert.ok(
        validKinds.has(tpl.kind),
        `Template ${tpl.id} has invalid kind: ${tpl.kind}`,
      );
    }
  });

  it("verifies specific template rule kinds", () => {
    const prodUsers = findAlertTemplate("prod-users");
    assert.equal(prodUsers.kind, "issue_created");

    const prodVolume = findAlertTemplate("prod-volume");
    assert.equal(prodVolume.kind, "velocity_spike");

    const customAgent = findAlertTemplate("custom-agent");
    assert.equal(customAgent.kind, "issue_created");
  });

  it("applies template defaults accurately", () => {
    const spikeTpl = findAlertTemplate("prod-spike");
    const applied = applyAlertTemplate(spikeTpl);
    assert.equal(applied.kind, "velocity_spike");
    assert.equal(applied.threshold, "300");
    assert.equal(applied.environment, "production");
    assert.equal(applied.minLevel, "error");
    assert.equal(applied.firstSeen, "any");
  });

  it("calculates bulk alert availability for snooze and resolve without ignore", () => {
    const sampleAlerts: AlertRow[] = [
      {
        id: "a1",
        org_id: "org-1",
        project_id: "p1",
        kind: "velocity_spike",
        payload_json: {},
        fired_at: new Date().toISOString(),
        read_at: null,
        ignored: false,
      },
      {
        id: "a2",
        org_id: "org-1",
        project_id: "p1",
        kind: "issue_created",
        payload_json: {},
        fired_at: new Date().toISOString(),
        read_at: new Date().toISOString(),
        ignored: true,
      },
    ];

    const avail = bulkAlertAvailability(sampleAlerts);
    assert.equal(avail.resolve, true, "should have resolve because a1 is unread and not ignored");
    assert.equal(avail.snooze, true, "should have snooze because a1 is not ignored");
    assert.equal(avail.unsnooze, true, "should have unsnooze because a2 is ignored");
    assert.equal(avail.reopen, false, "reopen should be false because a2 is ignored");
  });
});
