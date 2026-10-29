import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  derivedKind,
  describeRule,
  draftFromRule,
  ruleToApiBody,
  templateDraft,
} from "./create-alert-rule-model";

describe("create alert rule sentence", () => {
  it("fills the production crash template", () => {
    const draft = templateDraft("production-crash");
    assert.equal(draft.triggers.length, 1);
    assert.equal(draft.triggers[0].type, "issue_new");
    assert.equal(draft.conditions.length, 2);
    assert.equal(draft.cooldownMins, 30);
    assert.match(describeRule(draft), /unhandled/i);
    const body = ruleToApiBody(draft, "proj");
    assert.equal(body.kind, "issue_created");
    assert.equal(body.environment, "production");
    assert.equal(body.condition_match, "all");
    assert.equal(body.payload_options.stack_frames, true);
    assert.equal(body.payload_options["stack:in_app"], true);
    assert.equal(body.payload_options["stack:frames:3"], true);
    assert.equal(body.payload_options["stack:frames:1"], false);
    assert.equal(body.payload_options.affected_user, true);
    assert.equal(body.payload_options.breadcrumbs, true);
  });

  it("keeps came back as a condition on the regression template", () => {
    const draft = templateDraft("regression-watchdog");
    assert.equal(draft.triggers.length, 1);
    assert.equal(draft.triggers[0].type, "issue_new");
    assert.equal(derivedKind(draft), "regression");
    assert.equal(
      draft.conditions.some((item) => item.field === "came_back" && item.value === "yes"),
      true,
    );
  });

  it("treats a count trigger as a spike rule", () => {
    const draft = templateDraft("error-spike");
    assert.equal(draft.triggers[0].type, "issue_count");
    if (draft.triggers[0].type === "issue_count") {
      assert.equal(draft.triggers[0].op, "gt");
      assert.equal(draft.triggers[0].threshold, 100);
      assert.equal(draft.triggers[0].window, "5m");
    }
    assert.equal(derivedKind(draft), "velocity_spike");
    assert.equal(ruleToApiBody(draft, "proj").threshold, 100);
    assert.match(describeRule(draft), /> 100 in 5 min/);
  });

  it("turns a stored regression trigger into the came back condition", () => {
    const draft = draftFromRule({
      name: "Old regression",
      kind: "regression",
      triggers: [{ type: "issue_regression" }],
      conditions: [{ field: "environment", op: "is", value: "production" }],
    });
    assert.equal(draft.triggers[0].type, "issue_new");
    assert.equal(derivedKind(draft), "regression");
    assert.equal(
      draft.conditions.some((item) => item.field === "came_back" && item.value === "yes"),
      true,
    );
  });

  it("keeps checkout as a new issue with any-of conditions", () => {
    const draft = templateDraft("critical-routes");
    assert.equal(draft.match, "any");
    assert.equal(draft.triggers[0].type, "issue_new");
  });
});
