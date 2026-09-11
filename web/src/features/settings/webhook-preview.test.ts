import assert from "node:assert/strict";
import { previewWebhookPayload } from "./webhook-preview";

const slack = previewWebhookPayload("slack", "velocity_spike");
assert.match(slack, /velocity_spike/);
assert.match(slack, /blocks/);

const discord = previewWebhookPayload("discord", "regression");
assert.match(discord, /content/);
assert.match(discord, /regression/);

const generic = previewWebhookPayload("generic", "custom_rule");
assert.match(generic, /"event": "custom_rule"/);
assert.match(generic, /issue_id/);
assert.match(generic, /event_count/);
