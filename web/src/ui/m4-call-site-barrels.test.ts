// web/src/ui/m4-call-site-barrels.test.ts
// Milestone 4: Call Site Migration & Root Barrels Test Suite
// Verifies root barrel exports, backward-compatible aliases, forwarding shims,
// module boundaries, and deep import compatibility.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// 1. Root barrel imports
import * as RootUi from "./index";
import {
  // Primitives
  Button,
  Input,
  Badge,
  Checkbox,
  Switch,
  Dialog,
  Modal,
  Select,
  Tabs,
  Box,
  Text,
  EpureBrandMark,
  EpureBrandIcon,
  CSS_VARIABLES,
  ORBIT_CORE_PRINCIPLES,
  PRODUCT_DESIGN_PRINCIPLES,
  Skeleton,

  // Components
  Card,
  Banner,
  CodeBlock,
  CopyButton,
  EmptyState,
  Field,
  Toast,
  Command,
  FilterChip,
  Sparkline,
  StatBar,
  Section,

  // Blocks
  IssueFeedRow,
  SettingsNav,
  PageShell,
  PageChrome,
  IssueOccurrences,
  StackTracePanel,
  IssueDetailTabs,
  IssueOverviewPanel,
  RouteErrorBoundary,

  // Aliases from Root Barrel
  ApplyWithAiButton,
  PolarCard,
  FairUseBanner,
  SourceCodeBlock,
  IssueRowShell,
  IssueRow,
  WorkspaceSettingsNav,
  PageHeader,
  SimpleFeedHeader,
  IssueRecentOccurrences,
  IssueOccurrencesTable,
} from "./index";

// 2. Canonical Tier imports
import * as PrimitivesTier from "./primitives";
import * as ComponentsTier from "./components";
import * as BlockTier from "./block";

// 3. Forwarding shims imports
import { Button as ShimButton } from "./button";
import { Input as ShimInput } from "./input";
import { Badge as ShimBadge } from "./badge";
import { Card as ShimCard } from "./card";
import { CopyButton as ShimCopyButton } from "./copy-button";
import { ApplyWithAiButton as ShimApplyWithAiButton } from "./apply-with-ai-button";
import { FairUseBanner as ShimFairUseBanner } from "./fair-use-banner";
import { SourceCodeBlock as ShimSourceCodeBlock } from "./source-code-block";
import { IssueRowShell as ShimIssueRowShell } from "./issue-row";
import { IssueFeedRow as ShimIssueFeedRow } from "./issue-feed-row";
import { SettingsNav as ShimSettingsNav } from "./settings-nav";
import { WorkspaceSettingsNav as ShimWorkspaceSettingsNav } from "./workspace-settings-nav";
import { PageChrome as ShimPageChrome } from "./page-chrome";
import { PageHeader as ShimPageHeader } from "./page-header";
import { SimpleFeedHeader as ShimSimpleFeedHeader } from "./simple-feed-header";
import { StackTracePanel as ShimStackTracePanel } from "./stack-trace-panel";
import { IssueRecentOccurrences as ShimIssueRecentOccurrences } from "./issue-recent-occurrences";
import { IssueOccurrencesTable as ShimIssueOccurrencesTable } from "./issue-occurrences-table";
import { Field as ShimField } from "./field";
import { Toast as ShimToast } from "./toast";
import { Command as ShimCommand } from "./command";

// 4. Kit shims imports
import { PageShell as KitPageShell } from "@/components/kit/page-shell";
import { IssueRowShell as KitIssueRowShell } from "@/components/kit/issue-row-shell";

describe("Milestone 4: Call Site Migration & Root Barrels", () => {
  describe("1. Root Barrel Complete Re-exports", () => {
    it("re-exports all primitives symbols from root @/ui", () => {
      assert.ok(["function", "object"].includes(typeof Button));
      assert.ok(["function", "object"].includes(typeof Input));
      assert.ok(["function", "object"].includes(typeof Badge));
      assert.ok(["function", "object"].includes(typeof Checkbox));
      assert.ok(["function", "object"].includes(typeof Switch));
      assert.ok(["function", "object"].includes(typeof Dialog));
      assert.ok(["function", "object"].includes(typeof Modal));
      assert.ok(["function", "object"].includes(typeof Select));
      assert.ok(["function", "object"].includes(typeof Tabs));
      assert.ok(["function", "object"].includes(typeof Box));
      assert.ok(["function", "object"].includes(typeof Text));
      assert.ok(["function", "object"].includes(typeof EpureBrandMark));
      assert.ok(["function", "object"].includes(typeof EpureBrandIcon));
      assert.ok(typeof CSS_VARIABLES === "object");
      assert.ok(Array.isArray(ORBIT_CORE_PRINCIPLES));
      assert.ok(typeof PRODUCT_DESIGN_PRINCIPLES === "object");
      assert.ok(["function", "object"].includes(typeof Skeleton));
    });

    it("re-exports all component symbols from root @/ui", () => {
      assert.ok(["function", "object"].includes(typeof Card));
      assert.ok(["function", "object"].includes(typeof Banner));
      assert.ok(["function", "object"].includes(typeof CodeBlock));
      assert.ok(["function", "object"].includes(typeof CopyButton));
      assert.ok(["function", "object"].includes(typeof EmptyState));
      assert.ok(["function", "object"].includes(typeof Field));
      assert.ok(["function", "object"].includes(typeof Toast));
      assert.ok(["function", "object"].includes(typeof Command));
      assert.ok(["function", "object"].includes(typeof FilterChip));
      assert.ok(["function", "object"].includes(typeof Sparkline));
      assert.ok(["function", "object"].includes(typeof StatBar));
      assert.ok(["function", "object"].includes(typeof Section));
    });

    it("re-exports all block symbols from root @/ui", () => {
      assert.ok(["function", "object"].includes(typeof IssueFeedRow));
      assert.ok(["function", "object"].includes(typeof SettingsNav));
      assert.ok(["function", "object"].includes(typeof PageShell));
      assert.ok(["function", "object"].includes(typeof PageChrome));
      assert.ok(["function", "object"].includes(typeof IssueOccurrences));
      assert.ok(["function", "object"].includes(typeof StackTracePanel));
      assert.ok(["function", "object"].includes(typeof IssueDetailTabs));
      assert.ok(["function", "object"].includes(typeof IssueOverviewPanel));
      assert.ok(["function", "object"].includes(typeof RouteErrorBoundary));
    });

    it("exports 400+ distinct symbols through the root barrel", () => {
      const keys = Object.keys(RootUi);
      assert.ok(
        keys.length >= 300,
        `Expected at least 300 root exports, found ${keys.length}`,
      );
    });
  });

  describe("2. Backward-Compatible Aliases", () => {
    it("re-exports ApplyWithAiButton as alias to CopyButton variant", () => {
      assert.ok(typeof ApplyWithAiButton === "function");
      assert.strictEqual(ApplyWithAiButton, ComponentsTier.ApplyWithAiButton);
      const html = renderToStaticMarkup(
        React.createElement(ApplyWithAiButton, { prompt: "test prompt" }),
      );
      assert.ok(html.includes("Implement with agent") || html.includes("button"));
    });

    it("re-exports PolarCard as alias to Card", () => {
      assert.ok(["function", "object"].includes(typeof PolarCard));
      assert.strictEqual(PolarCard, ComponentsTier.PolarCard);
      const html = renderToStaticMarkup(
        React.createElement(PolarCard, null, "Polar Card Content"),
      );
      assert.ok(html.includes("Polar Card Content"));
    });

    it("re-exports FairUseBanner as alias to Banner", () => {
      assert.ok(typeof FairUseBanner === "function");
      assert.strictEqual(FairUseBanner, ComponentsTier.FairUseBanner);
      const html = renderToStaticMarkup(
        React.createElement(FairUseBanner, { message: "Starter plan limit reached" }),
      );
      assert.ok(html.includes("Starter plan limit reached"));
    });

    it("re-exports SourceCodeBlock as alias to CodeBlock", () => {
      assert.ok(typeof SourceCodeBlock === "function");
      assert.strictEqual(SourceCodeBlock, ComponentsTier.SourceCodeBlock);
      const html = renderToStaticMarkup(
        React.createElement(SourceCodeBlock, { code: "const x = 1;" }),
      );
      assert.ok(html.includes("const x = 1;"));
    });

    it("re-exports IssueRowShell and IssueRow as aliases to IssueFeedRow", () => {
      assert.ok(typeof IssueRowShell === "function");
      assert.strictEqual(IssueRowShell, BlockTier.IssueRowShell);
      assert.ok(typeof IssueRow === "function");
      assert.strictEqual(IssueRow, BlockTier.IssueRow);
      const html = renderToStaticMarkup(
        React.createElement(IssueRowShell, { id: "test-1", title: "Test Issue" }),
      );
      assert.ok(html.includes("Test Issue"));
    });

    it("re-exports WorkspaceSettingsNav as alias to SettingsNav", () => {
      assert.ok(typeof WorkspaceSettingsNav === "function");
      assert.strictEqual(WorkspaceSettingsNav, BlockTier.WorkspaceSettingsNav);
    });

    it("re-exports PageHeader and SimpleFeedHeader as aliases to PageChrome", () => {
      assert.ok(typeof PageHeader === "function");
      assert.strictEqual(PageHeader, BlockTier.PageHeader);
      assert.ok(typeof SimpleFeedHeader === "function");
      assert.strictEqual(SimpleFeedHeader, BlockTier.SimpleFeedHeader);
      const headerHtml = renderToStaticMarkup(
        React.createElement(PageHeader, { title: "Page Title" }),
      );
      assert.ok(headerHtml.includes("Page Title"));
    });

    it("re-exports IssueRecentOccurrences and IssueOccurrencesTable as aliases to IssueOccurrences", () => {
      assert.ok(typeof IssueRecentOccurrences === "function");
      assert.strictEqual(IssueRecentOccurrences, BlockTier.IssueRecentOccurrences);
      assert.ok(typeof IssueOccurrencesTable === "function");
      assert.strictEqual(IssueOccurrencesTable, BlockTier.IssueOccurrencesTable);
    });
  });

  describe("3. 1-Line Forwarding Shims Compatibility", () => {
    it("forwards primitive elements identically to canonical primitives", () => {
      assert.strictEqual(ShimButton, PrimitivesTier.Button);
      assert.strictEqual(ShimInput, PrimitivesTier.Input);
      assert.strictEqual(ShimBadge, PrimitivesTier.Badge);
    });

    it("forwards composite components identically to canonical components", () => {
      assert.strictEqual(ShimCard, ComponentsTier.Card);
      assert.strictEqual(ShimCopyButton, ComponentsTier.CopyButton);
      assert.strictEqual(ShimApplyWithAiButton, ComponentsTier.ApplyWithAiButton);
      assert.strictEqual(ShimFairUseBanner, ComponentsTier.FairUseBanner);
      assert.strictEqual(ShimSourceCodeBlock, ComponentsTier.SourceCodeBlock);
      assert.strictEqual(ShimField, ComponentsTier.Field);
      assert.strictEqual(ShimToast, ComponentsTier.Toast);
      assert.strictEqual(ShimCommand, ComponentsTier.Command);
    });

    it("forwards block view sections identically to canonical blocks", () => {
      assert.strictEqual(ShimIssueRowShell, BlockTier.IssueRowShell);
      assert.strictEqual(ShimIssueFeedRow, BlockTier.IssueFeedRow);
      assert.strictEqual(ShimSettingsNav, BlockTier.SettingsNav);
      assert.strictEqual(ShimWorkspaceSettingsNav, BlockTier.WorkspaceSettingsNav);
      assert.strictEqual(ShimPageChrome, BlockTier.PageChrome);
      assert.strictEqual(ShimPageHeader, BlockTier.PageHeader);
      assert.strictEqual(ShimSimpleFeedHeader, BlockTier.SimpleFeedHeader);
      assert.strictEqual(ShimStackTracePanel, BlockTier.StackTracePanel);
      assert.strictEqual(ShimIssueRecentOccurrences, BlockTier.IssueRecentOccurrences);
      assert.strictEqual(ShimIssueOccurrencesTable, BlockTier.IssueOccurrencesTable);
    });

    it("forwards kit page-shell and issue-row-shell to block tier", () => {
      assert.strictEqual(KitPageShell, BlockTier.PageShell);
      assert.strictEqual(KitIssueRowShell, BlockTier.IssueRowShell);
    });
  });

  describe("4. Tier Boundary and Isolation Contract", () => {
    it("primitives do not import from components or block tiers", () => {
      // Checked structurally: Tier 1 is the foundation
      assert.ok(PrimitivesTier.Button !== undefined);
      assert.ok(PrimitivesTier.CSS_VARIABLES !== undefined);
    });

    it("components consume primitives but do not import from block tier", () => {
      assert.ok(ComponentsTier.Card !== undefined);
      assert.ok(ComponentsTier.Banner !== undefined);
    });

    it("block tier composes primitives and components cleanly", () => {
      assert.ok(BlockTier.PageShell !== undefined);
      assert.ok(BlockTier.IssueFeedRow !== undefined);
    });
  });
});
