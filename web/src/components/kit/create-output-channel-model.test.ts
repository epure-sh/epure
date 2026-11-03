import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyOutputChannelDraft, draftToCreateBodies } from "./create-output-channel-model";

test("three selected projects create one destination with one verification state", () => {
 const bodies = draftToCreateBodies({ ...emptyOutputChannelDraft(), provider:"webhook", label:"Operations", projectIds:["p1","p2","p3","p2"], url:"https://hooks.example.com/epure" });
 assert.equal(bodies.length,1); assert.deepEqual(bodies[0]?.project_ids,["p1","p2","p3"]); assert.equal(bodies[0]?.require_verify,true);
});
