import test from "node:test";
import assert from "node:assert/strict";
import { isDemoProject } from "./demo-utils";

test("isDemoProject identification", async (t) => {
  await t.test("identifies explicit is_demo: true", () => {
    assert.equal(isDemoProject({ id: "proj_123", is_demo: true }), true);
  });

  await t.test("identifies acme id prefixes", () => {
    assert.equal(isDemoProject({ id: "acme_web", is_demo: false }), true);
    assert.equal(isDemoProject({ id: "acme-api", is_demo: false }), true);
    assert.equal(isDemoProject({ id: "prj_seed_1", is_demo: false }), true);
  });

  await t.test("identifies acme slugs", () => {
    assert.equal(isDemoProject({ id: "proj_999", slug: "acme" }), true);
    assert.equal(isDemoProject({ id: "proj_999", slug: "acme-web" }), true);
  });

  await t.test("does not false-positive on legitimate user projects containing acme in name or description", () => {
    assert.equal(
      isDemoProject({
        id: "proj_real_custom",
        slug: "acme-payments-integration",
        is_demo: false,
      }),
      false,
    );
    assert.equal(
      isDemoProject({
        id: "proj_real_123",
        slug: "my-production-app",
        is_demo: false,
      }),
      false,
    );
  });

  await t.test("handles null or undefined safely", () => {
    assert.equal(isDemoProject(null), false);
    assert.equal(isDemoProject(undefined), false);
  });
});
