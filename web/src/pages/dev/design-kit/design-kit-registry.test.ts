import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  DESIGN_KIT_FOUNDATION_PAGES,
  DESIGN_KIT_KIT_FAMILIES,
  DESIGN_KIT_KIT_META,
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_PRIMITIVE_FAMILIES,
  DESIGN_KIT_PRIMITIVE_META,
  DESIGN_KIT_PRIMITIVE_MODULES,
  DESIGN_KIT_RETIRED_KIT_LEAVES,
  DESIGN_KIT_RETIRED_PRIMITIVES,
  DESIGN_KIT_SECTION_GROUPS,
  kitByFamily,
  previewStemForPrimitive,
  primitivesByFamily,
} from "./registry";

const here = path.dirname(fileURLToPath(import.meta.url));
const uiPreviewDir = path.resolve(here, "previews/ui");
const kitPreviewDir = path.resolve(here, "previews/kit");

function previewStems(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".preview.tsx"))
    .map((name) => name.replace(/\.preview\.tsx$/, ""))
    .sort();
}

test("sidebar groups are Foundations · Primitives · Kit only", () => {
  assert.deepEqual([...DESIGN_KIT_SECTION_GROUPS], [
    "Foundations",
    "Primitives",
    "Kit",
  ]);
});

test("foundation pages match Orbit rail order", () => {
  assert.deepEqual(
    DESIGN_KIT_FOUNDATION_PAGES.map((p) => p.id),
    [
      "foundations",
      "colors",
      "spacing",
      "radius",
      "shadows",
      "motion",
      "typography",
      "icons",
    ],
  );
});

test("every primitive rail leaf has meta, family, and a preview file", () => {
  const uiPreviews = previewStems(uiPreviewDir);
  const seen = new Set<string>();

  for (const mod of DESIGN_KIT_PRIMITIVE_MODULES) {
    assert.ok(!seen.has(mod), `Duplicate primitive: ${mod}`);
    seen.add(mod);
    const meta = DESIGN_KIT_PRIMITIVE_META[mod];
    assert.ok(meta, `Missing DESIGN_KIT_PRIMITIVE_META.${mod}`);
    assert.ok(
      (DESIGN_KIT_PRIMITIVE_FAMILIES as readonly string[]).includes(meta.family),
      `Unknown family ${meta.family} on ${mod}`,
    );
    assert.ok(
      meta.importPath.startsWith("@polar-sh/orbit"),
      `Primitive ${mod} must import from @polar-sh/orbit, got ${meta.importPath}`,
    );
    assert.ok(meta.orbit, `Primitive ${mod} must name its Orbit export`);
    const stem = previewStemForPrimitive(mod);
    assert.ok(
      uiPreviews.includes(stem),
      `Missing previews/ui/${stem}.preview.tsx for primitive ${mod}`,
    );
  }
});

test("every kit rail leaf has meta, family, and a preview file", () => {
  const kitPreviews = previewStems(kitPreviewDir);
  const seen = new Set<string>();

  for (const mod of DESIGN_KIT_KIT_MODULES) {
    assert.ok(!seen.has(mod), `Duplicate kit: ${mod}`);
    seen.add(mod);
    const meta = DESIGN_KIT_KIT_META[mod];
    assert.ok(meta, `Missing DESIGN_KIT_KIT_META.${mod}`);
    assert.ok(
      (DESIGN_KIT_KIT_FAMILIES as readonly string[]).includes(meta.family),
      `Unknown kit family ${meta.family} on ${mod}`,
    );
    assert.ok(
      kitPreviews.includes(mod),
      `Missing previews/kit/${mod}.preview.tsx`,
    );
  }
});

test("retired names are not rail leaves", () => {
  const primitiveSet = new Set<string>(DESIGN_KIT_PRIMITIVE_MODULES);
  const kitSet = new Set<string>(DESIGN_KIT_KIT_MODULES);

  for (const name of DESIGN_KIT_RETIRED_PRIMITIVES) {
    assert.ok(
      !primitiveSet.has(name),
      `Retired primitive ${name} must not be a rail leaf`,
    );
  }
  for (const name of DESIGN_KIT_RETIRED_KIT_LEAVES) {
    assert.ok(
      !kitSet.has(name),
      `Retired kit leaf ${name} must not be a rail leaf`,
    );
  }
});

test("primitives and kit group helpers cover every module", () => {
  const p = primitivesByFamily();
  const k = kitByFamily();
  assert.equal(
    Object.values(p).flat().length,
    DESIGN_KIT_PRIMITIVE_MODULES.length,
  );
  assert.equal(Object.values(k).flat().length, DESIGN_KIT_KIT_MODULES.length);
});

test("kit absorbs lists do not collide with rail ids", () => {
  const kitSet = new Set<string>(DESIGN_KIT_KIT_MODULES);
  for (const mod of DESIGN_KIT_KIT_MODULES) {
    for (const absorbed of DESIGN_KIT_KIT_META[mod].absorbs ?? []) {
      assert.ok(
        !kitSet.has(absorbed) || absorbed === mod,
        `Absorbed name ${absorbed} collides with kit rail leaf`,
      );
    }
  }
});
