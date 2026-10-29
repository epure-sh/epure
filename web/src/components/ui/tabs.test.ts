import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsVariant,
} from "./tabs";

/**
 * Orbit Tabs pull Radix from `@polar-sh/orbit`'s nested install; SSR
 * `renderToStaticMarkup` then hits a duplicate-React invalid-hook-call.
 * Contract-only here — visual / a11y covered by design-kit + Playwright.
 */
describe("Tabs primitive component", () => {
  it("exports Orbit-backed compound API with Epure variant typing", () => {
    assert.equal(typeof Tabs, "function");
    assert.equal(typeof TabsList, "function");
    assert.equal(typeof TabsTrigger, "function");
    assert.equal(typeof TabsContent, "function");

    const variants: TabsVariant[] = ["default", "line", "folder"];
    assert.deepEqual(variants, ["default", "line", "folder"]);
  });
});
