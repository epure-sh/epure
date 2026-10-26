import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  DESIGN_KIT_FEATURE_UI_FACADES,
  DESIGN_KIT_FEATURE_UI_GROUPS,
  DESIGN_KIT_FEATURE_UI_MODULES,
} from "./feature-ui-registry";
import {
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_UI_MODULES,
} from "./registry";

const here = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(here, "../../../components/ui");
const kitDir = path.resolve(here, "../../../components/kit");
const featureUiDir = path.resolve(here, "../../../ui");
const uiPreviewDir = path.resolve(here, "previews/ui");
const kitPreviewDir = path.resolve(here, "previews/kit");

function stemsFromDir(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".tsx") && !name.includes(".test."))
    .map((name) => name.replace(/\.tsx$/, ""))
    .sort();
}

function previewStems(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".preview.tsx"))
    .map((name) => name.replace(/\.preview\.tsx$/, ""))
    .sort();
}

test("design kit registry matches ui/ and kit/ on disk", () => {
  const uiOnDisk = stemsFromDir(uiDir);
  const kitOnDisk = stemsFromDir(kitDir);

  assert.deepEqual(
    [...DESIGN_KIT_UI_MODULES].sort(),
    uiOnDisk,
    "Update DESIGN_KIT_UI_MODULES in registry.ts when adding ui primitives",
  );
  assert.deepEqual(
    [...DESIGN_KIT_KIT_MODULES].sort(),
    kitOnDisk.filter((s) => s !== "use-epure-shortcut"),
    "Update DESIGN_KIT_KIT_MODULES (hooks live in INDEX, not kit previews)",
  );
});

test("feature-ui groups are sorted and unique", () => {
  const seen = new Set<string>();
  for (const group of DESIGN_KIT_FEATURE_UI_GROUPS) {
    const sorted = [...group.modules].sort();
    assert.deepEqual([...group.modules], sorted, `${group.id} modules should be A→Z`);
    for (const mod of group.modules) {
      assert.ok(!seen.has(mod), `Duplicate feature-ui module: ${mod}`);
      seen.add(mod);
    }
  }
  assert.equal(seen.size, DESIGN_KIT_FEATURE_UI_MODULES.length);
});

test("feature-ui registry covers every src/ui module (or documented façade)", () => {
  const onDisk = stemsFromDir(featureUiDir);
  const accounted = new Set<string>([
    ...DESIGN_KIT_FEATURE_UI_MODULES,
    ...DESIGN_KIT_FEATURE_UI_FACADES,
  ]);
  const missing = onDisk.filter((stem) => !accounted.has(stem));
  assert.deepEqual(
    missing,
    [],
    `Add ${missing.join(", ")} to feature-ui-registry.ts (catalog or DESIGN_KIT_FEATURE_UI_FACADES)`,
  );
  const extra = DESIGN_KIT_FEATURE_UI_MODULES.filter((stem) => !onDisk.includes(stem));
  assert.deepEqual(extra, [], "Remove stale entries from DESIGN_KIT_FEATURE_UI_GROUPS");
});

test("every cataloged module has a playground preview file", () => {
  const uiPreviews = previewStems(uiPreviewDir);
  const kitPreviews = previewStems(kitPreviewDir);

  for (const mod of DESIGN_KIT_UI_MODULES) {
    assert.ok(uiPreviews.includes(mod), `Missing previews/ui/${mod}.preview.tsx`);
  }
  for (const mod of DESIGN_KIT_KIT_MODULES) {
    assert.ok(kitPreviews.includes(mod), `Missing previews/kit/${mod}.preview.tsx`);
  }
});
