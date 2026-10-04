import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { httpSecureCookieTrap } from "./session-cookie";

describe("httpSecureCookieTrap", () => {
  it("blocks production cookies on HTTP", () => {
    assert.equal(httpSecureCookieTrap("http:", true), true);
  });

  it("allows production cookies on HTTPS", () => {
    assert.equal(httpSecureCookieTrap("https:", true), false);
  });

  it("allows local HTTP when the cookie is not Secure", () => {
    assert.equal(httpSecureCookieTrap("http:", false), false);
  });
});
