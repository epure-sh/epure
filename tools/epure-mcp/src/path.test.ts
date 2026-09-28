import assert from "node:assert/strict";
import test from "node:test";

import { assertEpureApiPath } from "./path.js";

test("allows normal api paths", () => {
  assert.equal(assertEpureApiPath("/api/v1/issues"), "/api/v1/issues");
  assert.equal(
    assertEpureApiPath("api/v1/agent/queue"),
    "/api/v1/agent/queue",
  );
});

test("rejects traversal and off-host URLs", () => {
  assert.throws(() => assertEpureApiPath("/api/v1/../auth/login"));
  assert.throws(() => assertEpureApiPath("https://evil/api/v1/issues"));
  assert.throws(() => assertEpureApiPath("//evil/api/v1/issues"));
});

test("rejects auth routes", () => {
  assert.throws(() => assertEpureApiPath("/api/v1/auth/login"));
});
