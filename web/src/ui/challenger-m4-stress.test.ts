// web/src/ui/challenger-m4-stress.test.ts
// Challenger 1 (Milestone 4): Adversarial Stress Suite for Call Site Migration & Root Barrels
// Verifies:
// 1. Referential identity (===) across legacy shims, canonical tiers, and root barrel for ALL symbols
// 2. Exhaustive shim coverage across all 81 legacy files in src/ui/
// 3. Kit forwarding shims (kit/page-shell, kit/issue-row-shell)
// 4. Backward-compatible aliases runtime behavior and HTML parity
// 5. Stress testing with edge case props and adversarial inputs

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Import all barrels
import * as RootUi from "./index";
import * as PrimitivesTier from "./primitives";
import * as ComponentsTier from "./components";
import * as BlockTier from "./block";

// Import Kit shims
import * as KitPageShellMod from "@/components/kit/page-shell";
import * as KitIssueRowShellMod from "@/components/kit/issue-row-shell";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Challenger 1: Milestone 4 Adversarial Stress Harness", () => {
  describe("1. Systematic Referential Identity across All 81 Legacy Shims", () => {
    const uiDir = path.resolve(__dirname);
    const legacyFiles = fs
      .readdirSync(uiDir)
      .filter(
        (f) =>
          (f.endsWith(".tsx") || f.endsWith(".ts")) &&
          !f.includes(".test.") &&
          f !== "index.ts",
      );

    it("verifies that at least 80 legacy files exist as shims in src/ui/", () => {
      assert.ok(
        legacyFiles.length >= 80,
        `Expected at least 80 legacy shim files, found ${legacyFiles.length}`,
      );
    });

    for (const file of legacyFiles) {
      it(`verifies shim file '${file}' exports values identical (===) to tier and root barrels`, async () => {
        const shimMod = await import(`./${file}`);
        const shimKeys = Object.keys(shimMod);

        assert.ok(
          shimKeys.length > 0,
          `Legacy shim '${file}' must export at least one runtime symbol`,
        );

        for (const key of shimKeys) {
          const shimValue = (shimMod as Record<string, unknown>)[key];

          // 1. Must exist in at least one canonical tier barrel
          let tierValue: unknown = undefined;
          let tierSource = "";

          if (key in PrimitivesTier) {
            tierValue = (PrimitivesTier as Record<string, unknown>)[key];
            tierSource = "primitives";
          } else if (key in ComponentsTier) {
            tierValue = (ComponentsTier as Record<string, unknown>)[key];
            tierSource = "components";
          } else if (key in BlockTier) {
            tierValue = (BlockTier as Record<string, unknown>)[key];
            tierSource = "block";
          }

          assert.ok(
            tierValue !== undefined,
            `Symbol '${key}' from legacy shim '${file}' was not found in any canonical tier barrel!`,
          );

          // 2. Strict referential equality between legacy shim and tier barrel
          assert.strictEqual(
            shimValue,
            tierValue,
            `Referential mismatch: '${key}' in '${file}' !== '${key}' in canonical tier '${tierSource}'!`,
          );

          // 3. Must exist in root barrel @/ui
          assert.ok(
            key in RootUi,
            `Symbol '${key}' from legacy shim '${file}' is missing from root barrel @/ui!`,
          );

          // 4. Strict referential equality between legacy shim and root barrel
          const rootValue = (RootUi as Record<string, unknown>)[key];
          assert.strictEqual(
            shimValue,
            rootValue,
            `Referential mismatch: '${key}' in '${file}' !== '${key}' in root barrel @/ui!`,
          );
        }
      });
    }
  });

  describe("2. Backward-Compatible Aliases Equivalence & Runtime Rendering", () => {
    it("verifies ApplyWithAiButton referential identity and static markup", () => {
      assert.strictEqual(RootUi.ApplyWithAiButton, ComponentsTier.ApplyWithAiButton);
      const element = React.createElement(RootUi.ApplyWithAiButton, {
        prompt: "Refactor this function to be pure",
        children: "AI Optimize",
      });
      const html = renderToStaticMarkup(element);
      assert.ok(html.includes("AI Optimize") || html.includes("Implement with agent"));
    });

    it("verifies PolarCard referential identity across barrels and static markup", () => {
      assert.strictEqual(RootUi.PolarCard, ComponentsTier.PolarCard);
      const polarHtml = renderToStaticMarkup(
        React.createElement(RootUi.PolarCard, { padding: "xl" }, "Polar Content"),
      );
      assert.ok(polarHtml.includes("Polar Content"));
    });

    it("verifies FairUseBanner referential identity across barrels and static markup", () => {
      assert.strictEqual(RootUi.FairUseBanner, ComponentsTier.FairUseBanner);
      const fairUseHtml = renderToStaticMarkup(
        React.createElement(RootUi.FairUseBanner, { message: "Quota warning" }),
      );
      assert.ok(fairUseHtml.includes("Quota warning"));
    });

    it("verifies SourceCodeBlock referential identity across barrels and static markup", () => {
      assert.strictEqual(RootUi.SourceCodeBlock, ComponentsTier.SourceCodeBlock);
      const sourceCodeHtml = renderToStaticMarkup(
        React.createElement(RootUi.SourceCodeBlock, { code: "const answer = 42;" }),
      );
      assert.ok(sourceCodeHtml.includes("const answer = 42;"));
    });

    it("verifies IssueRowShell and IssueRow aliases referential identity", () => {
      assert.strictEqual(RootUi.IssueRowShell, BlockTier.IssueRowShell);
      assert.strictEqual(RootUi.IssueRow, BlockTier.IssueRow);
      const rowProps = { id: "issue-abc", title: "Null pointer in payment handler" };
      const shellHtml = renderToStaticMarkup(React.createElement(RootUi.IssueRowShell, rowProps));
      assert.ok(shellHtml.includes("Null pointer in payment handler"));
    });

    it("verifies WorkspaceSettingsNav alias referential identity", () => {
      assert.strictEqual(RootUi.WorkspaceSettingsNav, BlockTier.WorkspaceSettingsNav);
    });

    it("verifies PageHeader and SimpleFeedHeader aliases referential identity", () => {
      assert.strictEqual(RootUi.PageHeader, BlockTier.PageHeader);
      assert.strictEqual(RootUi.SimpleFeedHeader, BlockTier.SimpleFeedHeader);
      const headerHtml = renderToStaticMarkup(
        React.createElement(RootUi.PageHeader, { title: "Exceptions Monitor" }),
      );
      assert.ok(headerHtml.includes("Exceptions Monitor"));
    });

    it("verifies IssueRecentOccurrences and IssueOccurrencesTable aliases referential identity", () => {
      assert.strictEqual(RootUi.IssueRecentOccurrences, BlockTier.IssueRecentOccurrences);
      assert.strictEqual(RootUi.IssueOccurrencesTable, BlockTier.IssueOccurrencesTable);
    });
  });

  describe("3. Kit Forwarding Shims Compatibility", () => {
    it("verifies @/components/kit/page-shell forwards PageShell with referential identity", () => {
      assert.ok(typeof KitPageShellMod.PageShell === "function");
      assert.strictEqual(KitPageShellMod.PageShell, BlockTier.PageShell);
      assert.strictEqual(KitPageShellMod.PageShell, RootUi.PageShell);
    });

    it("verifies @/components/kit/issue-row-shell forwards IssueRowShell with referential identity", () => {
      assert.ok(typeof KitIssueRowShellMod.IssueRowShell === "function");
      assert.strictEqual(KitIssueRowShellMod.IssueRowShell, BlockTier.IssueRowShell);
      assert.strictEqual(KitIssueRowShellMod.IssueRowShell, RootUi.IssueRowShell);
    });
  });

  describe("4. Adversarial Props and Edge Case Stress", () => {
    it("renders Button across all variant/size combinations from root barrel", () => {
      const variants = [
        "primary",
        "secondary",
        "outline",
        "ghost",
        "danger",
        "signal",
        "link",
        "filterEscalating",
        "filterRegression",
      ] as const;
      const sizes = ["xs", "sm", "md", "default", "toolbar", "lg", "icon", "icon-xs"] as const;

      for (const variant of variants) {
        for (const size of sizes) {
          const html = renderToStaticMarkup(
            React.createElement(
              RootUi.Button,
              { variant, size, hotkey: "K", loading: false, fullWidth: true },
              `Btn-${variant}-${size}`,
            ),
          );
          assert.ok(html.includes(`Btn-${variant}-${size}`));
          assert.ok(html.includes("K"));
        }
      }
    });

    it("renders Card across all variants and edge cases", () => {
      const variants = ["default", "elevated", "interactive", "inset", "borderless"] as const;
      for (const variant of variants) {
        const html = renderToStaticMarkup(
          React.createElement(
            RootUi.Card,
            { variant, className: "test-card-cls" },
            React.createElement("span", null, `Card-${variant}`),
          ),
        );
        assert.ok(html.includes(`Card-${variant}`));
        assert.ok(html.includes("test-card-cls"));
      }
    });

    it("renders Banner with extreme text and different variants safely", () => {
      const hugeText = "Extreme ".repeat(50);
      const html = renderToStaticMarkup(
        React.createElement(RootUi.Banner, {
          title: hugeText,
          variant: "warning",
          dismissible: true,
        }),
      );
      assert.ok(html.includes("Extreme"));
    });

    it("renders EmptyState with empty strings and missing optional props", () => {
      const html = renderToStaticMarkup(
        React.createElement(RootUi.EmptyState, {
          title: "",
          description: "",
        }),
      );
      assert.ok(typeof html === "string");
    });

    it("renders IssueFeedRow in compact and full mode without crashing", () => {
      const fullHtml = renderToStaticMarkup(
        React.createElement(RootUi.IssueFeedRow, {
          id: "issue-full-1",
          title: "Database connection timeout",
          level: "error",
          compact: false,
        }),
      );
      assert.ok(fullHtml.includes("Database connection timeout"));

      const compactHtml = renderToStaticMarkup(
        React.createElement(RootUi.IssueFeedRow, {
          id: "issue-compact-1",
          title: "Database connection timeout",
          level: "error",
          compact: true,
        }),
      );
      assert.ok(compactHtml.includes("Database connection timeout"));
    });

    it("renders PageShell with deep nested content", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          RootUi.PageShell,
          { subtitle: "Testing nested hierarchy" },
          React.createElement("div", { id: "child-level-1" }, "Level 1"),
        ),
      );
      assert.ok(html.includes("Level 1"));
      assert.ok(html.includes("data-slot=\"page-shell\""));
    });
  });

  describe("5. Tier Independence and Architectural Boundaries", () => {
    it("Primitives tier exports foundation tokens and Orbit core principles", () => {
      assert.ok(Array.isArray(PrimitivesTier.ORBIT_CORE_PRINCIPLES));
      assert.strictEqual(PrimitivesTier.ORBIT_CORE_PRINCIPLES.length, 3);
      assert.ok(typeof PrimitivesTier.CSS_VARIABLES === "object");
      assert.ok(PrimitivesTier.BRAND_NAME === "Epure");
    });

    it("Components tier does not expose Block tier components directly", () => {
      // Components tier should NOT re-export IssueFeedRow or PageShell
      assert.strictEqual((ComponentsTier as Record<string, unknown>).PageShell, undefined);
      assert.strictEqual((ComponentsTier as Record<string, unknown>).IssueFeedRow, undefined);
    });

    it("Root barrel unifies all tiers into an ultra-consistent interface", () => {
      assert.ok(Object.keys(RootUi).length >= 300);
    });
  });
});
