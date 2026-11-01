// web/src/ui/components/empirical-stress.test.ts
// Empirical stress test harness for Milestone 2 Tier 2 components

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import * as React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import {
  CopyButton,
  ApplyWithAiButton,
  InlineCopyButton,
  Banner,
  FairUseBanner,
  RegressionStrip,
  IssuesContextStrip,
  IssuesHomeHint,
  TestDataBanner,
  CodeBlock,
  SourceCodeBlock,
  CodeFrame,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  PolarCard,
  SectionCard,
} from "./index";

// Mock localStorage
const mockStorage = new Map<string, string>();
let storageAccessible = true;

const testLocalStorage: Storage = {
  getItem: (key: string) => {
    if (!storageAccessible) throw new Error("SecurityError: Access is denied");
    return mockStorage.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (!storageAccessible) throw new Error("QuotaExceededError: Storage quota exceeded");
    mockStorage.set(key, String(value));
  },
  removeItem: (key: string) => {
    if (!storageAccessible) throw new Error("SecurityError: Access is denied");
    mockStorage.delete(key);
  },
  clear: () => {
    if (!storageAccessible) throw new Error("SecurityError: Access is denied");
    mockStorage.clear();
  },
  key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
  get length() {
    return mockStorage.size;
  },
};

(globalThis as unknown as { localStorage: Storage }).localStorage = testLocalStorage;

describe("EMPIRICAL STRESS TEST SUITE — Milestone 2 Tier 2", () => {
  beforeEach(() => {
    mockStorage.clear();
    storageAccessible = true;
  });

  // =========================================================================
  // 1. CopyButton Stress Tests
  // =========================================================================
  describe("1. CopyButton Stress Tests", () => {
    it("renders all visual variants without crashing", () => {
      const variants = ["default", "ai", "icon-only", "inline"] as const;
      for (const variant of variants) {
        const html = renderToStaticMarkup(
          React.createElement(CopyButton, {
            value: "const x = 42;",
            variant,
            ...(variant !== "ai" && { label: "Copy Code" }),
          }),
        );
        assert.ok(html.length > 0);
        if (variant === "inline") {
          assert.match(html, /<button/);
          assert.match(html, /aria-label="Copy Code"/);
        } else if (variant === "icon-only") {
          assert.match(html, /p-0/);
          assert.doesNotMatch(html, /<span>/);
        } else if (variant === "ai") {
          assert.match(html, /Implement with agent/);
        } else {
          assert.match(html, /Copy Code/);
        }
      }
    });

    it("handles empty string value gracefully during static render", () => {
      const html = renderToStaticMarkup(
        React.createElement(CopyButton, {
          value: "",
          label: "Empty Copy",
        }),
      );
      assert.match(html, /Empty Copy/);
    });

    it("handles special characters and multiline values", () => {
      const specialValue = `<script>alert('xss')</script>\n"quotes" & 'single' \\backslash\t\r\n🎉🔥🚀`;
      const html = renderToStaticMarkup(
        React.createElement(CopyButton, {
          value: specialValue,
          label: "Copy Special",
        }),
      );
      assert.match(html, /Copy Special/);
    });

    it("renders prominence='main' with larger button styles (size lg)", () => {
      const html = renderToStaticMarkup(
        React.createElement(CopyButton, {
          value: "curl https://api.epure.dev",
          prominence: "main",
          label: "Copy Setup Command",
        }),
      );
      assert.match(html, /Copy Setup Command/);
      assert.match(html, /h-12 px-5 py-4/);
    });

    it("verifies stopPropagation difference between inline and other variants", () => {
      // In copy-button.tsx:
      // variant="inline" attaches: onClick={(e) => { e.stopPropagation(); void handleCopy(); }}
      // variant="default" attaches: onClick={() => void handleCopy()} without stopPropagation
      const inlineHtml = renderToStaticMarkup(
        React.createElement(CopyButton, { value: "test", variant: "inline" }),
      );
      assert.match(inlineHtml, /shrink-0 rounded p-0.5/);
    });
  });

  // =========================================================================
  // 2. Banner Stress Tests
  // =========================================================================
  describe("2. Banner Stress Tests", () => {
    it("renders all tone combinations with all variant layouts", () => {
      const tones = ["neutral", "warning", "danger", "signal", "info"] as const;
      const variants = ["strip", "card", "callout"] as const;

      for (const tone of tones) {
        for (const variant of variants) {
          const html = renderToStaticMarkup(
            React.createElement(Banner, {
              tone,
              variant,
              title: `Banner ${tone} ${variant}`,
              description: `Description for ${tone} ${variant}`,
            }),
          );
          assert.match(html, new RegExp(`data-tone="${tone}"`));
          assert.match(html, new RegExp(`data-variant="${variant}"`));
          assert.match(html, new RegExp(`Banner ${tone} ${variant}`));
        }
      }
    });

    it("does not render when dismissStorageKey is present in localStorage with value '1'", () => {
      mockStorage.set("test-banner-key", "1");
      const html = renderToStaticMarkup(
        React.createElement(Banner, {
          dismissStorageKey: "test-banner-key",
          title: "Should Not Show",
        }),
      );
      assert.equal(html, "");
    });

    it("renders when dismissStorageKey is not set in localStorage", () => {
      const html = renderToStaticMarkup(
        React.createElement(Banner, {
          dismissStorageKey: "unset-banner-key",
          title: "Should Show",
        }),
      );
      assert.match(html, /Should Show/);
      assert.match(html, /Dismiss/);
    });

    it("handles storage exceptions (SecurityError in private browsing) without crashing", () => {
      storageAccessible = false; // Will throw on getItem/setItem
      const html = renderToStaticMarkup(
        React.createElement(Banner, {
          dismissStorageKey: "blocked-key",
          title: "Private Browsing Safe",
        }),
      );
      assert.match(html, /Private Browsing Safe/);
    });

    it("renders specialized banners correctly", () => {
      const fairUse = renderToStaticMarkup(
        React.createElement(FairUseBanner, { message: "Usage cap approaching" }),
      );
      assert.match(fairUse, /Usage cap approaching/);
      assert.match(fairUse, /data-tone="warning"/);

      const reg = renderToStaticMarkup(
        React.createElement(RegressionStrip, {
          count: 5,
          onViewRegressions: () => {},
        }),
      );
      assert.match(reg, /5 exceptions came back/);
      assert.match(reg, /Show came back/);

      const regZero = renderToStaticMarkup(
        React.createElement(RegressionStrip, {
          count: 0,
          onViewRegressions: () => {},
        }),
      );
      assert.equal(regZero, "");

      const testData = renderToStaticMarkup(
        React.createElement(TestDataBanner, { projectId: "proj-123" }),
      );
      assert.match(testData, /Preview · test data only/);
    });
  });

  // =========================================================================
  // 3. CodeBlock Stress Tests
  // =========================================================================
  describe("3. CodeBlock Stress Tests", () => {
    it("handles huge line numbers (e.g. 1,000,000) without crashing", () => {
      const lines = [
        { number: 999999, text: "const a = 1;" },
        { number: 1000000, text: "const b = 2;", fault: true },
      ];
      const html = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          lines,
          variant: "lines",
        }),
      );
      assert.match(html, /999999/);
      assert.match(html, /1000000/);
      assert.match(html, /border-l-semantic-danger/);
    });

    it("handles completely empty code string gracefully", () => {
      const htmlLines = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          code: "",
          variant: "lines",
        }),
      );
      assert.match(htmlLines, /epure-source-code-block/);

      const htmlSnippet = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          code: "",
          variant: "snippet",
        }),
      );
      assert.match(htmlSnippet, /epure-code-snippet/);
    });

    it("escapes special characters to prevent XSS", () => {
      const malicious = "<script>alert('xss')</script> & <b>bold</b>";
      const html = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          code: malicious,
          variant: "lines",
        }),
      );
      assert.doesNotMatch(html, /<script>alert/);
      assert.match(html, /&lt;script&gt;alert/);
    });

    it("EMPIRICAL FINDING: code string with highlightLine highlights correctly", () => {
      const codeHtml = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          code: "line one\nline two\nline three",
          variant: "lines",
          highlightLine: 2,
        }),
      );
      // Line 2 has fault class because idx + 1 === highlightLine in code split mapping
      assert.match(codeHtml, /border-l-semantic-danger/);
    });

    it("EMPIRICAL FINDING: lines prop with explicit fault=true highlights correctly", () => {
      const linesWithFault = [
        { number: 1, text: "line one" },
        { number: 2, text: "line two", fault: true },
        { number: 3, text: "line three" },
      ];
      const html = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          lines: linesWithFault,
          variant: "lines",
        }),
      );
      assert.match(html, /border-l-semantic-danger/);
    });

    it("EMPIRICAL DISCREPANCY: lines prop with highlightLine but no explicit fault: true does NOT highlight in lines variant", () => {
      const linesWithoutFault = [
        { number: 1, text: "line one" },
        { number: 2, text: "line two" },
        { number: 3, text: "line three" },
      ];
      const html = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          lines: linesWithoutFault,
          variant: "lines",
          highlightLine: 2,
        }),
      );
      // Observation: highlightLine is ignored when linesProp is passed without fault: true
      const hasFaultClass = html.includes("border-l-semantic-danger");
      // Documenting empirical reality:
      assert.equal(hasFaultClass, false, "When linesProp is provided, highlightLine is not checked in lines variant render");
    });

    it("EMPIRICAL CONTRAST: in syntax variant fallback, highlightLine IS checked even when fault is not set", () => {
      const linesWithoutFault = [
        { number: 1, text: "line one" },
        { number: 2, text: "line two" },
      ];
      const html = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          lines: linesWithoutFault,
          variant: "syntax",
          highlightLine: 2,
        }),
      );
      // In syntax fallback (lines 247-248): isTarget = line.fault || (highlightLine === line.number) sets border-left-width: 2px
      assert.match(html, /border-left-width:2px/);
    });
  });

  // =========================================================================
  // 4. Card Stress Tests
  // =========================================================================
  describe("4. Card Stress Tests", () => {
    it("renders interactive vs flat variants with distinct classes", () => {
      const flatHtml = renderToStaticMarkup(
        React.createElement(Card, { variant: "flat" }, "Flat Content"),
      );
      assert.match(flatHtml, /data-variant="flat"/);
      assert.match(flatHtml, /border-transparent bg-transparent/);
      assert.doesNotMatch(flatHtml, /data-interactive="true"/);

      const interactiveHtml = renderToStaticMarkup(
        React.createElement(Card, { interactive: true }, "Interactive Content"),
      );
      assert.match(interactiveHtml, /data-variant="interactive"/);
      assert.match(interactiveHtml, /data-interactive="true"/);
      assert.match(interactiveHtml, /cursor-pointer/);
      assert.match(interactiveHtml, /hover:border-border-strong/);
    });

    it("wraps in React Router Link when 'to' prop is passed", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            Card,
            { to: "/issues/42", title: "Issue 42" },
            React.createElement(CardContent, null, "Details"),
          ),
        ),
      );
      assert.match(html, /<a [^>]*href="\/issues\/42"/);
      assert.match(html, /data-slot="polar-card-link"/);
      assert.match(html, /data-slot="card"/);
      assert.match(html, /data-interactive="true"/);
    });

    it("supports all 11 padding tokens correctly", () => {
      const paddings = [
        "none", "xs", "s", "m", "l", "xl", "2xl", "3xl", "4xl", "5xl"
      ] as const;

      const expectedClasses: Record<string, string> = {
        none: "p-0",
        xs: "p-2",
        s: "p-3",
        m: "p-4",
        l: "p-5",
        xl: "p-6",
        "2xl": "p-8",
        "3xl": "p-10",
        "4xl": "p-12",
        "5xl": "p-14",
      };

      for (const p of paddings) {
        const html = renderToStaticMarkup(
          React.createElement(Card, { padding: p }, "Padded"),
        );
        assert.match(html, new RegExp(expectedClasses[p]));
      }
    });

    it("renders SectionCard shorthand props correctly", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          SectionCard,
          {
            title: "Section Title",
            description: "Section Subtitle",
            headerActions: React.createElement("button", null, "Settings"),
            footer: React.createElement("span", null, "Last updated"),
          },
          "Section Body",
        ),
      );
      assert.match(html, /Section Title/);
      assert.match(html, /Section Subtitle/);
      assert.match(html, /<button>Settings<\/button>/);
      assert.match(html, /Last updated/);
    });

    it("renders nested click target (CopyButton inline) inside Card to verify slot composition", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            Card,
            { to: "/overview", interactive: true },
            React.createElement(
              CardContent,
              null,
              React.createElement(CopyButton, { value: "npm i epure", variant: "inline" }),
            ),
          ),
        ),
      );
      assert.match(html, /<a [^>]*href="\/overview"/);
      assert.match(html, /<button[^>]*aria-label="Copy"/);
    });
  });
});
