import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  derivedKind,
  describeRule,
  ruleToApiBody,
  templateDraft,
} from "./create-alert-rule-model";

describe("create alert rule sentence", () => {
  it("fills the production crash template", () => {
    const draft = templateDraft("production-crash");
    assert.equal(draft.triggers.length, 2);
    assert.equal(draft.conditions.length, 2);
    assert.equal(draft.cooldownMins, 30);
    assert.match(describeRule(draft), /unhandled/i);
    const body = ruleToApiBody(draft, "proj");
    assert.equal(body.kind, "issue_created");
    assert.equal(body.environment, "production");
    assert.equal(body.condition_match, "all");
    assert.equal(body.payload_options.stack_frames, true);
    assert.equal(body.payload_options.affected_user, true);
    assert.equal(body.payload_options.breadcrumbs, true);
  });

  it("treats a count trigger as a spike rule", () => {
    const draft = templateDraft("error-spike");
    assert.equal(derivedKind(draft), "velocity_spike");
    assert.equal(ruleToApiBody(draft, "proj").threshold, 100);
  });

  it("keeps critical routes as any-of", () => {
    const draft = templateDraft("critical-routes");
    assert.equal(draft.match, "any");
    assert.equal(draft.triggers[0].type, "any_event");
  });
});
