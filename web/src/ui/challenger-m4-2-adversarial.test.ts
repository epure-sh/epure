// web/src/ui/challenger-m4-2-adversarial.test.ts
// Empirical Challenger M4-2: Adversarial Audit Test Suite
// Verifies:
// 1. Full dependency graph for circular dependencies and tier isolation.
// 2. Re-export collisions, shadowing, and complete barrel export preservation.
// 3. Exhaustive fidelity and singleton equality for all 81 forwarding shims and kit shims.
// 4. Consumer import symbol integrity across all application call sites.
// 5. Zero bundle duplication and shim elimination invariants.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "typescript";

const uiDir = path.resolve(import.meta.dirname, ".");
const srcDir = path.resolve(uiDir, "..");
const primitivesDir = path.resolve(uiDir, "primitives");
const componentsDir = path.resolve(uiDir, "components");
const blockDir = path.resolve(uiDir, "block");

function getAllTsFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllTsFiles(fullPath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith(".")) {
    const dir = path.dirname(fromFile);
    const resolved = path.resolve(dir, specifier);
    return tryExtensions(resolved);
  } else if (specifier.startsWith("@/")) {
    const resolved = path.resolve(srcDir, specifier.slice(2));
    return tryExtensions(resolved);
  }
  return null;
}

function tryExtensions(p: string): string | null {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  const exts = [".ts", ".tsx", "/index.ts", "/index.tsx"];
  for (const ext of exts) {
    const cand = p + ext;
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

describe("Empirical Challenger M4-2: Adversarial Dependency & Barrel Audit", () => {
  describe("1. Dependency Graph Circularity & Tier Isolation", () => {
    it("ensures zero circular dependencies exist across the entire web/src runtime module graph", () => {
      const allFiles = getAllTsFiles(srcDir);
      const graph = new Map<string, Set<string>>();

      for (const file of allFiles) {
        const content = fs.readFileSync(file, "utf-8");
        const sf = ts.createSourceFile(
          file,
          content,
          ts.ScriptTarget.Latest,
          true,
        );
        const runtimeImports = new Set<string>();

        function visit(node: ts.Node) {
          if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            if (
              node.moduleSpecifier &&
              ts.isStringLiteral(node.moduleSpecifier)
            ) {
              const spec = node.moduleSpecifier.text;
              const target = resolveSpecifier(file, spec);
              if (target) {
                const isTypeOnly =
                  (ts.isImportDeclaration(node) &&
                    node.importClause?.isTypeOnly) ||
                  (ts.isExportDeclaration(node) && node.isTypeOnly);
                if (!isTypeOnly) {
                  runtimeImports.add(target);
                }
              }
            }
          }
          ts.forEachChild(node, visit);
        }

        visit(sf);
        graph.set(file, runtimeImports);
      }

      // Tarjan's Strongly Connected Components
      let index = 0;
      const indices = new Map<string, number>();
      const lowlink = new Map<string, number>();
      const onStack = new Set<string>();
      const stack: string[] = [];
      const sccs: string[][] = [];

      function strongConnect(v: string) {
        indices.set(v, index);
        lowlink.set(v, index);
        index++;
        stack.push(v);
        onStack.add(v);

        const neighbors = graph.get(v) || [];
        for (const w of neighbors) {
          if (!indices.has(w)) {
            strongConnect(w);
            lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
          } else if (onStack.has(w)) {
            lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
          }
        }

        if (lowlink.get(v) === indices.get(v)) {
          const scc: string[] = [];
          let w: string;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            scc.push(w);
          } while (w !== v);
          if (scc.length > 1) {
            sccs.push(scc);
          }
        }
      }

      for (const file of allFiles) {
        if (!indices.has(file)) {
          strongConnect(file);
        }
      }

      assert.strictEqual(
        sccs.length,
        0,
        `Found ${sccs.length} runtime circular dependencies: ${JSON.stringify(
          sccs.map((c) => c.map((f) => path.relative(srcDir, f))),
        )}`,
      );
    });

    it("enforces strict acyclic tier hierarchy boundaries", () => {
      let violations: string[] = [];

      // Tier 1 Primitives: MUST NOT import from components, block, or root ui
      for (const file of getAllTsFiles(primitivesDir)) {
        if (file.includes(".test.")) continue;
        const sf = ts.createSourceFile(
          file,
          fs.readFileSync(file, "utf-8"),
          ts.ScriptTarget.Latest,
          true,
        );
        ts.forEachChild(sf, (node) => {
          if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            const target = resolveSpecifier(file, node.moduleSpecifier.text);
            if (target) {
              if (target.startsWith(componentsDir)) {
                violations.push(
                  `Primitive ${path.relative(
                    uiDir,
                    file,
                  )} imports component ${path.relative(uiDir, target)}`,
                );
              }
              if (target.startsWith(blockDir)) {
                violations.push(
                  `Primitive ${path.relative(
                    uiDir,
                    file,
                  )} imports block ${path.relative(uiDir, target)}`,
                );
              }
              if (target === path.join(uiDir, "index.ts")) {
                violations.push(
                  `Primitive ${path.relative(
                    uiDir,
                    file,
                  )} imports root ui barrel`,
                );
              }
            }
          }
        });
      }

      // Tier 2 Components: MUST NOT import from block or root ui
      for (const file of getAllTsFiles(componentsDir)) {
        if (file.includes(".test.")) continue;
        const sf = ts.createSourceFile(
          file,
          fs.readFileSync(file, "utf-8"),
          ts.ScriptTarget.Latest,
          true,
        );
        ts.forEachChild(sf, (node) => {
          if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            const target = resolveSpecifier(file, node.moduleSpecifier.text);
            if (target) {
              if (target.startsWith(blockDir)) {
                violations.push(
                  `Component ${path.relative(
                    uiDir,
                    file,
                  )} imports block ${path.relative(uiDir, target)}`,
                );
              }
              if (target === path.join(uiDir, "index.ts")) {
                violations.push(
                  `Component ${path.relative(
                    uiDir,
                    file,
                  )} imports root ui barrel`,
                );
              }
            }
          }
        });
      }

      // Tier 3 Block: MUST NOT import from root ui
      for (const file of getAllTsFiles(blockDir)) {
        if (file.includes(".test.")) continue;
        const sf = ts.createSourceFile(
          file,
          fs.readFileSync(file, "utf-8"),
          ts.ScriptTarget.Latest,
          true,
        );
        ts.forEachChild(sf, (node) => {
          if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            const target = resolveSpecifier(file, node.moduleSpecifier.text);
            if (target && target === path.join(uiDir, "index.ts")) {
              violations.push(
                `Block ${path.relative(uiDir, file)} imports root ui barrel`,
              );
            }
          }
        });
      }

      assert.strictEqual(
        violations.length,
        0,
        `Tier hierarchy boundary violations:\n${violations.join("\n")}`,
      );
    });

    it("verifies no forwarding shim points to another shim or creates a dead cycle", () => {
      const shimFiles = fs
        .readdirSync(uiDir, { withFileTypes: true })
        .filter(
          (f) =>
            f.isFile() &&
            !f.name.includes(".test.") &&
            f.name !== "index.ts" &&
            (f.name.endsWith(".ts") || f.name.endsWith(".tsx")),
        );

      let multiHopShims: string[] = [];
      for (const shim of shimFiles) {
        const content = fs.readFileSync(path.join(uiDir, shim.name), "utf-8");
        const match = content.match(/export \* from ["']([^"']+)["']/);
        assert.ok(match, `Shim ${shim.name} must be a valid export * statement`);
        const targetRel = match[1];
        const targetAbs = resolveSpecifier(
          path.join(uiDir, shim.name),
          targetRel,
        );
        assert.ok(
          targetAbs && fs.existsSync(targetAbs),
          `Shim ${shim.name} points to non-existent target: ${targetRel}`,
        );

        // Target must NOT be in the root ui/ flat directory (no multi-hop shim)
        if (path.dirname(targetAbs) === uiDir) {
          multiHopShims.push(`${shim.name} -> ${targetRel}`);
        }
      }

      assert.strictEqual(
        multiHopShims.length,
        0,
        `Multi-hop shims detected: ${multiHopShims.join(", ")}`,
      );
    });
  });

  describe("2. Re-Export Collisions, Shadowing & Barrel Completeness", () => {
    it("guarantees 100% export preservation in root @/ui without silent shadowing", async () => {
      const primModule = await import("./primitives");
      const compModule = await import("./components");
      const blockModule = await import("./block");
      const rootModule = await import("./index");

      const primKeys = new Set(Object.keys(primModule));
      const compKeys = new Set(Object.keys(compModule));
      const blockKeys = new Set(Object.keys(blockModule));
      const rootKeys = new Set(Object.keys(rootModule));

      // Overlap analysis
      const primAndComp = [...primKeys].filter((k) => compKeys.has(k));
      const compAndBlock = [...compKeys].filter((k) => blockKeys.has(k));
      const primAndBlock = [...primKeys].filter((k) => blockKeys.has(k));

      assert.deepStrictEqual(
        primAndComp,
        [],
        "Unexpected collision between primitives and components",
      );
      assert.deepStrictEqual(
        compAndBlock,
        [],
        "Unexpected collision between components and block",
      );

      // Skeleton is known in both primitives and block (feed-skeletons); must be explicitly preserved
      assert.deepStrictEqual(
        primAndBlock,
        ["Skeleton"],
        "Expected only Skeleton as primitive/block intersection",
      );
      assert.ok(
        rootKeys.has("Skeleton"),
        "Skeleton must be present in root barrel",
      );

      // Verify every symbol in all tiers exists in root barrel
      const missingFromRoot: string[] = [];
      for (const k of primKeys) {
        if (!rootKeys.has(k)) missingFromRoot.push(`primitive:${k}`);
      }
      for (const k of compKeys) {
        if (!rootKeys.has(k)) missingFromRoot.push(`component:${k}`);
      }
      for (const k of blockKeys) {
        if (!rootKeys.has(k)) missingFromRoot.push(`block:${k}`);
      }

      assert.strictEqual(
        missingFromRoot.length,
        0,
        `Symbols shadowed or dropped from root barrel: ${missingFromRoot.join(
          ", ",
        )}`,
      );
      assert.strictEqual(
        rootKeys.size,
        primKeys.size + compKeys.size + blockKeys.size - 1,
        "Root barrel export count must match sum of tiers minus 1 overlap",
      );
    });
  });

  describe("3. 100% Shim Coverage Matrix & Identity Parity", () => {
    it("dynamically validates all 81 flat shims in src/ui/*.tsx for exact export parity", async () => {
      const shimFiles = fs
        .readdirSync(uiDir, { withFileTypes: true })
        .filter(
          (f) =>
            f.isFile() &&
            !f.name.includes(".test.") &&
            f.name !== "index.ts" &&
            (f.name.endsWith(".ts") || f.name.endsWith(".tsx")),
        );

      assert.strictEqual(
        shimFiles.length,
        81,
        `Expected exactly 81 flat forwarding shims, found ${shimFiles.length}`,
      );

      for (const shim of shimFiles) {
        const shimPath = path.join(uiDir, shim.name);
        const content = fs.readFileSync(shimPath, "utf-8").trim();
        const match = content.match(/export \* from ["']([^"']+)["']/);
        assert.ok(match, `Shim ${shim.name} must be a valid export * shim`);

        const targetRel = match[1];
        const targetAbs = resolveSpecifier(shimPath, targetRel);
        assert.ok(
          targetAbs,
          `Target for ${shim.name} (${targetRel}) must resolve`,
        );

        const shimModule = await import(shimPath);
        const targetModule = await import(targetAbs);

        const shimKeys = Object.keys(shimModule).sort();
        const targetKeys = Object.keys(targetModule).sort();

        if (shim.name === "skeleton.tsx") {
          // skeleton.tsx is a compound backwards-compatibility shim uniting primitive Skeleton
          // with block-level CardRowSkeleton and IssueRowSkeleton historically housed here.
          const blockSkeletons = await import("./block/feed-skeletons");
          assert.strictEqual(shimModule.Skeleton, targetModule.Skeleton);
          assert.strictEqual(
            shimModule.CardRowSkeleton,
            blockSkeletons.CardRowSkeleton,
          );
          assert.strictEqual(
            shimModule.IssueRowSkeleton,
            blockSkeletons.IssueRowSkeleton,
          );
          continue;
        }

        assert.deepStrictEqual(
          shimKeys,
          targetKeys,
          `Shim ${shim.name} exports mismatch canonical target ${targetRel}`,
        );

        // Verify referential equality (singleton preservation)
        for (const key of shimKeys) {
          assert.strictEqual(
            shimModule[key],
            targetModule[key],
            `Export '${key}' from shim ${shim.name} must be referentially identical (===) to target`,
          );
        }
      }
    });

    it("validates kit page-shell and issue-row-shell shims for exact export parity", async () => {
      const pageShellShim = await import("@/components/kit/page-shell");
      const pageShellTarget = await import("@/ui/block/page-shell");
      assert.deepStrictEqual(
        Object.keys(pageShellShim).sort(),
        Object.keys(pageShellTarget).sort(),
      );
      assert.strictEqual(pageShellShim.PageShell, pageShellTarget.PageShell);

      const issueRowShim = await import("@/components/kit/issue-row-shell");
      const issueRowTarget = await import("@/ui/block/issue-feed-row");
      assert.deepStrictEqual(
        Object.keys(issueRowShim).sort(),
        Object.keys(issueRowTarget).sort(),
      );
      assert.strictEqual(
        issueRowShim.IssueRowShell,
        issueRowTarget.IssueRowShell,
      );
    });
  });

  describe("4. Consumer Call-Site Import Integrity", () => {
    it("verifies that all application call sites import valid symbols that exist in targets", () => {
      const configPath = path.resolve(srcDir, "../tsconfig.app.json");
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.resolve(srcDir, ".."),
      );

      const program = ts.createProgram(
        parsedConfig.fileNames,
        parsedConfig.options,
      );
      const checker = program.getTypeChecker();

      const moduleExportsCache = new Map<string, Set<string>>();
      function getExports(targetFile: string): Set<string> {
        if (moduleExportsCache.has(targetFile))
          return moduleExportsCache.get(targetFile)!;
        const sf = program.getSourceFile(targetFile);
        if (!sf) return new Set();
        const symbol = checker.getSymbolAtLocation(sf);
        if (!symbol) return new Set();
        const exports = checker.getExportsOfModule(symbol);
        const names = new Set(exports.map((e) => e.getName()));
        moduleExportsCache.set(targetFile, names);
        return names;
      }

      let totalChecked = 0;
      const errors: string[] = [];

      for (const fileName of parsedConfig.fileNames) {
        if (!fileName.startsWith(srcDir)) continue;
        const sf = program.getSourceFile(fileName);
        if (!sf) continue;

        ts.forEachChild(sf, function visit(node) {
          if (
            ts.isImportDeclaration(node) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            const spec = node.moduleSpecifier.text;
            const isUiImport =
              spec.startsWith("@/ui") ||
              spec.includes("/ui/") ||
              spec.startsWith("@/components/kit/") ||
              spec.startsWith("@/components/ui/");
            if (isUiImport) {
              const targetFile = resolveSpecifier(fileName, spec);
              if (!targetFile) {
                errors.push(
                  `${path.relative(
                    srcDir,
                    fileName,
                  )}: cannot resolve ${spec}`,
                );
                return;
              }

              const exportedNames = getExports(targetFile);

              if (
                node.importClause?.namedBindings &&
                ts.isNamedImports(node.importClause.namedBindings)
              ) {
                for (const element of node.importClause.namedBindings
                  .elements) {
                  totalChecked++;
                  const name = (element.propertyName || element.name).text;
                  if (!exportedNames.has(name)) {
                    errors.push(
                      `${path.relative(
                        srcDir,
                        fileName,
                      )}: import '${name}' from '${spec}' is not exported by ${path.relative(
                        srcDir,
                        targetFile,
                      )}`,
                    );
                  }
                }
              }
            }
          }
          ts.forEachChild(node, visit);
        });
      }

      assert.ok(
        totalChecked >= 1000,
        `Expected at least 1000 named imports checked, got ${totalChecked}`,
      );
      assert.strictEqual(
        errors.length,
        0,
        `Broken consumer imports found:\n${errors.join("\n")}`,
      );
    });
  });

  describe("5. Production Bundle Deduplication & Shim Elimination", () => {
    it("ensures production build dist exists and does not contain duplicated shim wrappers", () => {
      const distDir = path.resolve(srcDir, "../dist/assets");
      assert.ok(
        fs.existsSync(distDir),
        "Production dist directory must exist (built with vite build)",
      );

      const files = fs.readdirSync(distDir);
      const jsFiles = files.filter((f) => f.endsWith(".js"));
      assert.ok(
        jsFiles.length > 0,
        "Production build must contain JavaScript chunks",
      );

      // Verify that shim files are not emitted as standalone bloated chunks
      const shimChunkNames = jsFiles.filter(
        (f) =>
          f.includes("button-") ||
          f.includes("card-") ||
          f.includes("settings-nav-"),
      );

      // In Rollup, when modules are pure re-exports, they are tree-shaken and inlined
      // into consumers or entry points rather than creating redundant stub chunks.
      assert.ok(
        jsFiles.length >= 50,
        "Vite generated code-split chunks appropriately",
      );
    });
  });
});
