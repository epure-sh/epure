import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSetupAiPrompt, EPURE_WIRE_SKILL_INSTALL_HINT } from "./setup-ai-prompt";

describe("buildSetupAiPrompt", () => {
  const dsn = "http://abc123@localhost:8080/880e8400-e29b-41d4-a716-446655440099";

  it("includes DSN and interactive discovery", () => {
    const prompt = buildSetupAiPrompt({
      dsn,
      path: "fresh",
      phase: "connect",
      projectName: "Checkout Web",
      platformLabel: "Next.js",
      platformId: "nextjs",
    });
    assert.match(prompt, new RegExp(dsn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(prompt, /Interactive discovery/);
    assert.match(prompt, /Checkout Web/);
    assert.match(prompt, /Next\.js/);
    assert.match(prompt, /platforms\/javascript\/nextjs/);
    assert.ok(prompt.includes(EPURE_WIRE_SKILL_INSTALL_HINT));
  });

  it("uses sentry migration workflow when path is sentry", () => {
    const prompt = buildSetupAiPrompt({
      dsn,
      path: "sentry",
      phase: "connect",
    });
    assert.match(prompt, /Sentry → Epure/);
    assert.match(prompt, /Sentry today/);
    assert.match(prompt, /Replace \*\*only\*\* the `dsn`/);
  });

  it("verify phase focuses on test exception", () => {
    const prompt = buildSetupAiPrompt({
      dsn,
      path: "fresh",
      phase: "verify",
    });
    assert.match(prompt, /Verify workflow/);
    assert.match(prompt, /Epure setup test/);
    assert.doesNotMatch(prompt, /Implementation workflow \(fresh\)/);
  });
});
