import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCloudDeployment, isCloudSocialSignInVisible } from "./deployment";

describe("deployment helpers", () => {
  it("does not throw when evaluated in node/SSR without import.meta.env", () => {
    assert.doesNotThrow(() => {
      isCloudDeployment();
    });
  });

  it("detects cloud deployment based on hostname", () => {
    const originalWindow = globalThis.window;
    try {
      // @ts-expect-error mock window
      globalThis.window = {
        location: { hostname: "app.epure.sh" },
      };
      assert.equal(isCloudDeployment(), true);

      // @ts-expect-error mock window
      globalThis.window = {
        location: { hostname: "tenant.epure.sh" },
      };
      assert.equal(isCloudDeployment(), true);

      // @ts-expect-error mock window
      globalThis.window = {
        location: { hostname: "localhost" },
      };
      assert.equal(isCloudDeployment(), false);
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it("gates social sign-in visibility to cloud deployments", () => {
    const originalWindow = globalThis.window;
    try {
      // Self-hosted
      // @ts-expect-error mock window
      globalThis.window = {
        location: { hostname: "localhost" },
      };
      assert.equal(isCloudSocialSignInVisible(true), false);
      assert.equal(isCloudSocialSignInVisible(false), false);

      // Cloud
      // @ts-expect-error mock window
      globalThis.window = {
        location: { hostname: "app.epure.sh" },
      };
      assert.equal(isCloudSocialSignInVisible(true), true);
      assert.equal(isCloudSocialSignInVisible(false), false);
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
