import assert from "node:assert/strict";
import { test } from "node:test";
import { safeAuthReturn } from "./auth-return";
test("sign-in preserves a complete OAuth consent request", () => {
  const path="/oauth/authorize?client_id=epure_registered_123&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&code_challenge=challenge&state=state";
  assert.equal(safeAuthReturn(path), path);
});
test("sign-in return addresses cannot leave the application", () => {
  for (const value of ["//evil.invalid", "/\\evil.invalid", "https://evil.invalid", "javascript:alert(1)", "/\r\nLocation: evil", null]) assert.equal(safeAuthReturn(value), "/");
});
