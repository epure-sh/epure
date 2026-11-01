import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  DESIGN_KIT_BLOCK_FAMILIES,
  DESIGN_KIT_BLOCK_META,
  DESIGN_KIT_BLOCK_MODULES,
  DESIGN_KIT_COMPONENT_FAMILIES,
  DESIGN_KIT_COMPONENT_META,
  DESIGN_KIT_COMPONENT_MODULES,
  DESIGN_KIT_FOUNDATION_PAGES,
  DESIGN_KIT_PRIMITIVE_FAMILIES,
  DESIGN_KIT_PRIMITIVE_META,
  DESIGN_KIT_PRIMITIVE_MODULES,
  DESIGN_KIT_RETIRED_KIT_LEAVES,
  DESIGN_KIT_RETIRED_PRIMITIVES,
  DESIGN_KIT_SECTION_GROUPS,
  blocksByFamily,
  componentsByFamily,
  previewStemForBlock,
  previewStemForComponent,
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

test("sidebar groups are Foundations · Primitives · Components · Blocks", () => {
  assert.deepEqual([...DESIGN_KIT_SECTION_GROUPS], [
    "Foundations",
    "Primitives",
    "Components",
    "Blocks",
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

test("every component rail leaf has meta, family, and a preview file", () => {
  const kitPreviews = previewStems(kitPreviewDir);
  const seen = new Set<string>();

  for (const mod of DESIGN_KIT_COMPONENT_MODULES) {
    assert.ok(!seen.has(mod), `Duplicate component: ${mod}`);
    seen.add(mod);
    const meta = DESIGN_KIT_COMPONENT_META[mod];
    assert.ok(meta, `Missing DESIGN_KIT_COMPONENT_META.${mod}`);
    assert.ok(
      (DESIGN_KIT_COMPONENT_FAMILIES as readonly string[]).includes(meta.family),
      `Unknown component family ${meta.family} on ${mod}`,
    );
    const stem = previewStemForComponent(mod);
    assert.ok(
      kitPreviews.includes(stem),
      `Missing previews/kit/${stem}.preview.tsx for component ${mod}`,
    );
  }
});

test("every block rail leaf has meta, family, and a preview file", () => {
  const kitPreviews = previewStems(kitPreviewDir);
  const seen = new Set<string>();

  for (const mod of DESIGN_KIT_BLOCK_MODULES) {
    assert.ok(!seen.has(mod), `Duplicate block: ${mod}`);
    seen.add(mod);
    const meta = DESIGN_KIT_BLOCK_META[mod];
    assert.ok(meta, `Missing DESIGN_KIT_BLOCK_META.${mod}`);
    assert.ok(
      (DESIGN_KIT_BLOCK_FAMILIES as readonly string[]).includes(meta.family),
      `Unknown block family ${meta.family} on ${mod}`,
    );
    const stem = previewStemForBlock(mod);
    assert.ok(
      kitPreviews.includes(stem),
      `Missing previews/kit/${stem}.preview.tsx for block ${mod}`,
    );
  }
});

test("retired names are not rail leaves", () => {
  const primitiveSet = new Set<string>(DESIGN_KIT_PRIMITIVE_MODULES);
  const componentSet = new Set<string>(DESIGN_KIT_COMPONENT_MODULES);
  const blockSet = new Set<string>(DESIGN_KIT_BLOCK_MODULES);

  for (const name of DESIGN_KIT_RETIRED_PRIMITIVES) {
    assert.ok(
      !primitiveSet.has(name),
      `Retired primitive ${name} must not be a rail leaf`,
    );
  }
  for (const name of DESIGN_KIT_RETIRED_KIT_LEAVES) {
    assert.ok(
      !componentSet.has(name) && !blockSet.has(name),
      `Retired kit leaf ${name} must not be a rail leaf`,
    );
  }
});

test("primitives, components, and blocks group helpers cover every module", () => {
  const p = primitivesByFamily();
  const c = componentsByFamily();
  const b = blocksByFamily();
  assert.equal(
    Object.values(p).flat().length,
    DESIGN_KIT_PRIMITIVE_MODULES.length,
  );
  assert.equal(
    Object.values(c).flat().length,
    DESIGN_KIT_COMPONENT_MODULES.length,
  );
  assert.equal(Object.values(b).flat().length, DESIGN_KIT_BLOCK_MODULES.length);
});

test("component and block absorbs lists do not collide with rail ids", () => {
  const rail = new Set<string>([
    ...DESIGN_KIT_COMPONENT_MODULES,
    ...DESIGN_KIT_BLOCK_MODULES,
  ]);
  for (const mod of DESIGN_KIT_COMPONENT_MODULES) {
    for (const absorbed of DESIGN_KIT_COMPONENT_META[mod].absorbs ?? []) {
      assert.ok(
        !rail.has(absorbed) || absorbed === mod,
        `Absorbed name ${absorbed} collides with rail leaf`,
      );
    }
  }
  for (const mod of DESIGN_KIT_BLOCK_MODULES) {
    for (const absorbed of DESIGN_KIT_BLOCK_META[mod].absorbs ?? []) {
      assert.ok(
        !rail.has(absorbed) || absorbed === mod,
        `Absorbed name ${absorbed} collides with rail leaf`,
      );
    }
  }
});

test("component and block rails do not share module ids", () => {
  const overlap = DESIGN_KIT_COMPONENT_MODULES.filter((mod) =>
    (DESIGN_KIT_BLOCK_MODULES as readonly string[]).includes(mod),
  );
  assert.deepEqual(overlap, []);
});
