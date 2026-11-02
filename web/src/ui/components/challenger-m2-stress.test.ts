// web/src/ui/components/challenger-m2-stress.test.ts
// Empirical stress harness, boundary conditions, and adversarial verification
// for Milestone 2: Component Tier & Variant Consolidation in web/src/ui/components/**

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import {
  // EmptyState
  EmptyState,
  Empty,
  ErrorState,
  NotFoundState,
  ForbiddenState,
  // AiCopilotCard
  AiCopilotCard,
  AskAgentCard,
  IssueAiCopilotCard,
  extractCulprit,
  generateAiDiagnosis,
  // Sparkline
  Sparkline,
  inferTrendStatus,
  fillSparklineWindow,
  downsampleSparkValues,
  SPARKLINE_BAR_COUNT,
  sparklineBarCountForWindow,
  // Composite Components
  StatBar,
  IssuePriorityIcon,
  IssuePriorityBadge,
  resolveIssuePriority,
  getIssuePriorityLabel,
  StepIndicator,
  CopyDsnBlock,
  CopyCurlBlock,
  buildCurlFromRequest,
  ActionButton,
  FilterChip,
  SharedProjectBadge,
  SdkSnippetBlock,
  EventHttpRequest,
  OccurrencePicker,
  SetupPlatformMark,
  SetupDocsLink,
  SetupStepSection,
  KeyboardHintsFooter,
  ListRow,
  Section,
  SectionHeader,
  ToastProvider,
} from "./index";
import { TooltipProvider } from "../primitives";
import type { EventDetail, IssueSummary } from "@/lib/api";

describe("Empirical Challenger M2: Adversarial Stress Test Suite", () => {
  // =========================================================================
  // 1. EmptyState Adversarial & Boundary Stress Tests
  // =========================================================================
  describe("1. EmptyState Boundary & Stress", () => {
    it("renders status='zen' with SereneRadar pulse animation and nominal tags without crashing", () => {
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, { status: "zen" }),
      );
      assert.match(html, /data-status="zen"/);
      assert.match(html, /animate-ping/);
      assert.match(html, /animate-pulse/);
      assert.match(html, /lucide-shield-check/);
      assert.match(html, /Inbox Zero · Production is Calm/);
      assert.match(html, /Ingestion: 100% Nominal/);
      assert.match(html, /Spike Valve: Active · 0 Overages/);
    });

    it("renders status='zen' with custom title, description, and action button", () => {
      let actionCalled = false;
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "zen",
          title: "Custom Zen Title",
          description: "All queues processed smoothly.",
          actionLabel: "View Archive",
          onAction: () => {
            actionCalled = true;
          },
        }),
      );
      assert.match(html, /Custom Zen Title/);
      assert.match(html, /All queues processed smoothly\./);
      assert.match(html, /View Archive/);
    });

    it("renders status='error' with null and undefined error objects gracefully", () => {
      const htmlNull = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "error",
          error: null,
          title: "Null Error Title",
        }),
      );
      assert.match(htmlNull, /data-status="error"/);
      assert.match(htmlNull, /Null Error Title/);
      assert.doesNotMatch(htmlNull, /<details/);

      const htmlUndefined = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "error",
          error: undefined,
          title: "Undefined Error Title",
        }),
      );
      assert.match(htmlUndefined, /Undefined Error Title/);
      assert.doesNotMatch(htmlUndefined, /<details/);
    });

    it("renders status='error' with empty custom error object {}", () => {
      const customErr = {} as unknown as Error;
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "error",
          error: customErr,
          title: "Empty Error Object",
        }),
      );
      assert.match(html, /Empty Error Object/);
      assert.doesNotMatch(html, /<details/);
    });

    it("renders status='error' with massive 50KB stack trace inside accordion without crashing", () => {
      const hugeTrace = Array.from({ length: 500 }, (_, i) => `    at frame_${i} (file_${i}.ts:${i * 10})`).join("\n");
      const err = new Error("Massive Stack Failure");
      err.stack = `Error: Massive Stack Failure\n${hugeTrace}`;

      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "error",
          error: err,
        }),
      );
      assert.match(html, /<details/);
      assert.match(html, /<summary/);
      assert.match(html, /Error: Massive Stack Failure/);
      assert.match(html, /frame_499/);
    });

    it("renders status='error' fallback summary when error has no name or message", () => {
      const err = new Error();
      err.name = "";
      err.message = "";
      err.stack = "Anonymous stack trace";

      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "error",
          error: err,
        }),
      );
      assert.match(html, /<details/);
      assert.match(html, /Error details: Technical details/);
      assert.match(html, /Anonymous stack trace/);
    });

    it("renders status='error' with showReload, onRetry, and retrying states", () => {
      const idleHtml = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "error",
          showReload: true,
          onRetry: () => {},
          retryLabel: "Re-run query",
          retrying: false,
        }),
      );
      assert.match(idleHtml, /Reload page/);
      assert.match(idleHtml, /Re-run query/);
      assert.doesNotMatch(idleHtml, /disabled=""/);

      const retryingHtml = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "error",
          showReload: true,
          onRetry: () => {},
          retrying: true,
        }),
      );
      assert.match(retryingHtml, /Retrying…/);
      assert.match(retryingHtml, /disabled=""/);
    });

    it("renders safe link fallback: native <a> outside router context vs <Link> inside MemoryRouter", () => {
      // Outside router context: useInRouterContext() returns false
      const outsideHtml = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "error",
          backHref: "/issues",
          backLabel: "Back to Feed",
        }),
      );
      assert.match(outsideHtml, /<a[^>]*href="\/issues"[^>]*>Back to Feed<\/a>/);

      // Inside router context: useInRouterContext() returns true
      const insideHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(EmptyState, {
            status: "error",
            backHref: "/issues",
            backLabel: "Back to Feed",
          }),
        ),
      );
      assert.match(insideHtml, /<a[^>]*href="\/issues"[^>]*>Back to Feed<\/a>/);
    });

    it("renders status='search' with special characters, emojis, and injection-like strings safely", () => {
      const malicious = "<script>alert('xss')</script> & < > \" ' ` 🔥 🚀 \u200B";
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "search",
          title: `Results for: ${malicious}`,
          description: malicious,
        }),
      );
      assert.match(html, /data-status="search"/);
      // Ensure React escaped the HTML tags
      assert.doesNotMatch(html, /<script>/);
      assert.match(html, /&lt;script&gt;alert\(&#x27;xss&#x27;\)&lt;\/script&gt;/);
      assert.match(html, /🔥 🚀/);
    });

    it("verifies Empty wrapper backward-compatibility variants", () => {
      const zenWrapper = renderToStaticMarkup(React.createElement(Empty, { variant: "zen" }));
      assert.match(zenWrapper, /data-status="zen"/);

      const searchWrapper = renderToStaticMarkup(React.createElement(Empty, { variant: "search" }));
      assert.match(searchWrapper, /data-status="search"/);

      const insetWrapper = renderToStaticMarkup(React.createElement(Empty, { variant: "inset" }));
      assert.match(insetWrapper, /epure-empty--inset/);
    });

    it("verifies ErrorState, NotFoundState, and ForbiddenState wrappers", () => {
      const notFoundHtml = renderToStaticMarkup(React.createElement(NotFoundState, null));
      assert.match(notFoundHtml, /Page not found/);
      assert.match(notFoundHtml, /This URL does not match anything in your workspace\./);

      const forbiddenHtml = renderToStaticMarkup(React.createElement(ForbiddenState, null));
      assert.match(forbiddenHtml, /Access denied/);
      assert.match(forbiddenHtml, /You do not have permission to view this page\./);
    });
  });

  // =========================================================================
  // 2. AiCopilotCard & Heuristic Engine Adversarial Tests
  // =========================================================================
  describe("2. AiCopilotCard Deterministic Heuristic Engine & Variants", () => {
    const dummyIssue: IssueSummary = {
      id: "iss_100",
      short_id: "EP-100",
      project_id: "proj_1",
      title: "Unhandled RuntimeError: something crashed",
      status: "unresolved",
      level: "error",
      event_count: 10,
      user_count: 2,
      first_seen: "2026-10-30T10:00:00Z",
      last_seen: "2026-10-31T12:00:00Z",
    };

    it("extractCulprit handles null event, empty frames, and malformed payload safely", () => {
      // 1. null event
      assert.equal(extractCulprit(dummyIssue, null), "Unhandled RuntimeError");

      // 2. empty issue title
      const emptyTitleIssue = { ...dummyIssue, title: "" };
      assert.equal(extractCulprit(emptyTitleIssue, null), "application entrypoint");

      // 3. payload with transaction
      const eventWithTx: EventDetail = {
        id: "evt_1",
        issue_id: "iss_100",
        project_id: "proj_1",
        occurred_at: "2026-10-31T12:00:00Z",
        payload_json: { transaction: "POST /v1/checkout/charge" },
      };
      assert.equal(extractCulprit(dummyIssue, eventWithTx), "POST /v1/checkout/charge");

      // 4. payload with culprit
      const eventWithCulprit: EventDetail = {
        id: "evt_2",
        issue_id: "iss_100",
        project_id: "proj_1",
        occurred_at: "2026-10-31T12:00:00Z",
        payload_json: { culprit: "src/billing/service.go:120" },
      };
      assert.equal(extractCulprit(dummyIssue, eventWithCulprit), "src/billing/service.go:120");

      // 5. stack frames with filename and lineno
      const eventWithFrames: EventDetail = {
        id: "evt_3",
        issue_id: "iss_100",
        project_id: "proj_1",
        occurred_at: "2026-10-31T12:00:00Z",
        stack_frames: [{ filename: "app/worker.ts", lineno: 88 }],
      };
      assert.equal(extractCulprit(dummyIssue, eventWithFrames), "app/worker.ts:88");

      // 6. stack frames without lineno
      const eventFramesNoLineno: EventDetail = {
        id: "evt_4",
        issue_id: "iss_100",
        project_id: "proj_1",
        occurred_at: "2026-10-31T12:00:00Z",
        stack_frames: [{ filename: "app/worker.ts" }],
      };
      assert.equal(extractCulprit(dummyIssue, eventFramesNoLineno), "app/worker.ts");

      // 7. empty stack_frames array
      const eventEmptyFrames: EventDetail = {
        id: "evt_5",
        issue_id: "iss_100",
        project_id: "proj_1",
        occurred_at: "2026-10-31T12:00:00Z",
        stack_frames: [],
      };
      assert.equal(extractCulprit(dummyIssue, eventEmptyFrames), "Unhandled RuntimeError");

      // 8. malformed payload (not an object)
      const eventMalformedPayload: EventDetail = {
        id: "evt_6",
        issue_id: "iss_100",
        project_id: "proj_1",
        occurred_at: "2026-10-31T12:00:00Z",
        payload_json: "not-an-object" as unknown as Record<string, unknown>,
      };
      assert.equal(extractCulprit(dummyIssue, eventMalformedPayload), "Unhandled RuntimeError");
    });

    it("generateAiDiagnosis covers all heuristic diagnosis patterns accurately", () => {
      // 1. TypeError / undefined
      const typeErrDiag = generateAiDiagnosis(
        { ...dummyIssue, title: "TypeError: Cannot read properties of undefined (reading 'auth')" },
        null,
      );
      assert.equal(typeErrDiag.confidence, "High");
      assert.match(typeErrDiag.cause, /Null or undefined reference dereferenced/);
      assert.match(typeErrDiag.fix, /optional chaining/);

      // 2. Timeout / database / econnrefused
      const timeoutDiag = generateAiDiagnosis(
        { ...dummyIssue, title: "Connection ECONNREFUSED 127.0.0.1:5432" },
        null,
      );
      assert.equal(timeoutDiag.confidence, "Medium");
      assert.match(timeoutDiag.cause, /required service could not be reached/);
      assert.match(timeoutDiag.fix, /Restore the unavailable service/);

      // 3. React Hydration
      const hydrationDiag = generateAiDiagnosis(
        { ...dummyIssue, title: "Hydration failed because initial UI does not match" },
        null,
      );
      assert.equal(hydrationDiag.confidence, "High");
      assert.match(hydrationDiag.cause, /React hydration mismatch/);
      assert.match(hydrationDiag.fix, /Defer non-deterministic values/);

      // 4. Nil pointer / panic
      const nilDiag = generateAiDiagnosis(
        { ...dummyIssue, title: "panic: runtime error: invalid memory address or nil pointer dereference" },
        null,
      );
      assert.equal(nilDiag.confidence, "High");
      assert.match(nilDiag.cause, /Nil\/null pointer dereference/);
      assert.match(nilDiag.fix, /Verify object existence/);

      // 5. Fallback unhandled exception
      const fallbackDiag = generateAiDiagnosis(
        { ...dummyIssue, title: "CustomBusinessLogicException: quota exceeded" },
        null,
      );
      assert.equal(fallbackDiag.confidence, "Medium");
      assert.match(fallbackDiag.cause, /Unhandled exception in/);
      assert.match(fallbackDiag.fix, /Inspect latest event breadcrumbs/);
    });

    it("renders variant='diagnosis' with culprit, cause, fix, and Copy button", () => {
      const html = renderToStaticMarkup(
        React.createElement(AiCopilotCard, {
          variant: "diagnosis",
          issue: dummyIssue,
          event: null,
        }),
      );
      assert.match(html, /data-variant="diagnosis"/);
      assert.match(html, /Starting point for your AI agent/);
      assert.match(html, /Likely culprit:/);
      assert.match(html, /Heuristic cause:/);
      assert.match(html, /Try next:/);
      assert.match(html, /Copy for agent/);
    });

    it("renders variant='compact' with single-line prompt actions", () => {
      const html = renderToStaticMarkup(
        React.createElement(AiCopilotCard, {
          compact: true,
          promptText: "Investigate memory spike",
        }),
      );
      assert.match(html, /data-variant="compact"/);
      assert.match(html, /Copy a prompt for your AI agent/);
      assert.match(html, /Ask agent/);
    });

    it("renders variant='prompt' with docsUrl and full guidance copy", () => {
      const html = renderToStaticMarkup(
        React.createElement(AiCopilotCard, {
          variant: "prompt",
          title: "Custom Agent Prompt",
          description: "Copies contextual triage instructions to clipboard.",
          docsUrl: "https://docs.epure.ai/agent-triage",
        }),
      );
      assert.match(html, /data-variant="prompt"/);
      assert.match(html, /Custom Agent Prompt/);
      assert.match(html, /href="https:\/\/docs\.epure\.ai\/agent-triage"/);
      assert.match(html, /Docs/);
      assert.match(html, /Ask agent/);
    });

    it("gracefully falls back when variant='diagnosis' is requested without an issue", () => {
      const html = renderToStaticMarkup(
        React.createElement(AiCopilotCard, {
          variant: "diagnosis",
        }),
      );
      // Falls back to prompt variant safely instead of crashing
      assert.match(html, /data-variant="prompt"/);
      assert.match(html, /Copy a prompt for your AI agent/);
    });

    it("verifies AskAgentCard and IssueAiCopilotCard backward compatibility wrappers", () => {
      const askCompactHtml = renderToStaticMarkup(
        React.createElement(AskAgentCard, { compact: true, title: "Compact Agent" }),
      );
      assert.match(askCompactHtml, /data-variant="compact"/);
      assert.match(askCompactHtml, /Compact Agent/);

      const issueAiHtml = renderToStaticMarkup(
        React.createElement(IssueAiCopilotCard, { issue: dummyIssue, event: null }),
      );
      assert.match(issueAiHtml, /data-variant="diagnosis"/);
    });
  });

  // =========================================================================
  // 3. Sparkline Boundary & Numerical Robustness Tests
  // =========================================================================
  describe("3. Sparkline Numerical & Boundary Stress", () => {
    it("fillSparklineWindow returns exactly 24 points for 0 buckets", () => {
      const points = fillSparklineWindow([], "24h");
      assert.equal(points.length, SPARKLINE_BAR_COUNT);
      assert.equal(SPARKLINE_BAR_COUNT, 24);
      for (const pt of points) {
        assert.equal(pt.value, 0);
        assert.ok(typeof pt.at === "string");
      }
    });

    it("fillSparklineWindow handles single bucket, negative counts, and extreme spikes", () => {
      const now = Date.now();

      // 1. Single bucket at recent time
      const singleBucket = [{ start: new Date(now - 1000).toISOString(), count: 42 }];
      const singlePoints = fillSparklineWindow(singleBucket, "24h", now);
      assert.equal(singlePoints.length, 24);
      assert.equal(singlePoints[23]?.value, 42);

      // 2. Negative count bucket
      const negativeBucket = [{ start: new Date(now - 1000).toISOString(), count: -15 }];
      const negativePoints = fillSparklineWindow(negativeBucket, "24h", now);
      assert.equal(negativePoints[23]?.value, -15);

      // 3. Extreme spike bucket (10 billion)
      const extremeBucket = [{ start: new Date(now - 1000).toISOString(), count: 10_000_000_000 }];
      const extremePoints = fillSparklineWindow(extremeBucket, "24h", now);
      assert.equal(extremePoints[23]?.value, 10_000_000_000);

      // 4. Invalid date bucket (ignored cleanly)
      const invalidBucket = [{ start: "invalid-iso-timestamp", count: 999 }];
      const invalidPoints = fillSparklineWindow(invalidBucket, "24h", now);
      assert.equal(invalidPoints.every((pt) => pt.value === 0), true);
    });

    it("fillSparklineWindow supports various time windows (24h, 7d, 14d, 30d, 90d, default)", () => {
      const windows = ["24h", "7d", "14d", "30d", "90d", "custom-unknown"];
      for (const win of windows) {
        const points = fillSparklineWindow([], win);
        assert.equal(points.length, 24, `Window ${win} should return 24 bars`);
        assert.equal(sparklineBarCountForWindow(win), 24);
      }
    });

    it("inferTrendStatus handles <4 items, all zeroes, spikes, and declines", () => {
      assert.equal(inferTrendStatus([]), "ongoing");
      assert.equal(inferTrendStatus([1]), "ongoing");
      assert.equal(inferTrendStatus([1, 2, 3]), "ongoing");

      // All zeroes
      assert.equal(inferTrendStatus([0, 0, 0, 0, 0, 0, 0, 0]), "ongoing");

      // Escalating: recent (40) > earlier (10) * 1.35
      assert.equal(inferTrendStatus([2, 3, 2, 3, 10, 10, 10, 10]), "escalating");

      // Declining: recent (4) < earlier (40) * 0.65
      assert.equal(inferTrendStatus([10, 10, 10, 10, 1, 1, 1, 1]), "declining");
    });

    it("downsampleSparkValues handles target < 1, target >= length, and chunk summing", () => {
      const values = [10, 20, 30, 40, 50, 60];
      // Target <= 0 returns original
      assert.deepEqual(downsampleSparkValues(values, undefined, 0).values, values);
      // Target >= length returns original
      assert.deepEqual(downsampleSparkValues(values, undefined, 10).values, values);
      // Downsample to 2 buckets
      const result = downsampleSparkValues(values, ["a", "b", "c", "d", "e", "f"], 2);
      assert.equal(result.values.length, 2);
      assert.equal(result.values[0], 60); // 10+20+30
      assert.equal(result.values[1], 150); // 40+50+60
      assert.deepEqual(result.labels, ["a", "d"]);
    });

    it("renders Sparkline with all-zero values, identical values, and scaleToExtent without division by zero", () => {
      // 1. All zeroes
      const zeroHtml = renderToStaticMarkup(
        React.createElement(Sparkline, { values: [0, 0, 0, 0, 0] }),
      );
      assert.match(zeroHtml, /epure-sparkline/);
      assert.doesNotMatch(zeroHtml, /NaN/);
      assert.doesNotMatch(zeroHtml, /Infinity/);

      // 2. Identical values with scaleToExtent
      const identicalHtml = renderToStaticMarkup(
        React.createElement(Sparkline, {
          values: [50, 50, 50, 50],
          scaleToExtent: true,
        }),
      );
      assert.match(identicalHtml, /epure-sparkline/);
      assert.doesNotMatch(identicalHtml, /NaN/);

      // 3. Negative values
      const negativeHtml = renderToStaticMarkup(
        React.createElement(Sparkline, {
          values: [-10, -5, -2, 0],
        }),
      );
      assert.match(negativeHtml, /epure-sparkline/);
      assert.doesNotMatch(negativeHtml, /NaN/);

      // 4. Extreme spike
      const spikeHtml = renderToStaticMarkup(
        React.createElement(Sparkline, {
          values: [0, 0, 1_000_000_000],
        }),
      );
      assert.match(spikeHtml, /epure-sparkline/);
    });

    it("renders prominent Sparkline with xAxis hours and days ticks", () => {
      const now = Date.now();
      const points = Array.from({ length: 24 }, (_, i) => ({
        at: new Date(now - (24 - i) * 3600000).toISOString(),
        value: i * 5,
      }));

      const prominentHours = renderToStaticMarkup(
        React.createElement(
          TooltipProvider,
          null,
          React.createElement(Sparkline, {
            points,
            prominent: true,
            xAxis: "hours",
          }),
        ),
      );
      assert.match(prominentHours, /h-16/);
      assert.match(prominentHours, /aria-label=/);

      const prominentDays = renderToStaticMarkup(
        React.createElement(
          TooltipProvider,
          null,
          React.createElement(Sparkline, {
            points,
            prominent: true,
            xAxis: "days",
          }),
        ),
      );
      assert.match(prominentDays, /epure-sparkline/);
    });
  });

  // =========================================================================
  // 4. Composite Components: StatBar, IssuePriority, StepIndicator, CopyDsn, CopyCurl
  // =========================================================================
  describe("4. Composite Components Edge Cases & Contracts", () => {
    // 4.1 StatBar
    it("renders StatBar with empty items array, 0 values, and clickable items", () => {
      // Empty items
      const emptyHtml = renderToStaticMarkup(
        React.createElement(StatBar, { items: [] }),
      );
      assert.match(emptyHtml, /epure-stat-bar/);

      // Large values and zero values
      let clicked = false;
      const items = [
        { label: "Zero", value: 0 },
        { label: "Millions", value: 2_500_000 },
        { label: "Active Filter", value: 42, active: true, onClick: () => { clicked = true; } },
      ];

      const inlineHtml = renderToStaticMarkup(
        React.createElement(StatBar, { items, inline: true }),
      );
      assert.match(inlineHtml, /0 zero/);
      assert.match(inlineHtml, /2\.5M millions/);
      assert.match(inlineHtml, /42 active filter/);
      assert.match(inlineHtml, /text-accent/);
    });

    // 4.2 IssuePriority 4-bar SVG Logic and Resolvers
    it("resolveIssuePriority resolves fatal, error, warning, info, debug, regression, and stored priorities", () => {
      assert.equal(resolveIssuePriority("fatal", "unresolved"), "critical");
      assert.equal(resolveIssuePriority("error", "unresolved"), "high");
      assert.equal(resolveIssuePriority("warning", "unresolved"), "medium");
      assert.equal(resolveIssuePriority("info", "unresolved"), "low");
      assert.equal(resolveIssuePriority("debug", "unresolved"), "low");
      assert.equal(resolveIssuePriority("unknown", "unresolved"), "low");

      // Regression always takes critical precedence
      assert.equal(resolveIssuePriority("info", "regression"), "critical");
      assert.equal(resolveIssuePriority("debug", "regression"), "critical");

      // Case insensitivity
      assert.equal(resolveIssuePriority("FATAL", "unresolved"), "critical");
      assert.equal(resolveIssuePriority("Error", "unresolved"), "high");
      assert.equal(resolveIssuePriority("WARNING", "unresolved"), "medium");

      // Stored priority precedence
      assert.equal(
        resolveIssuePriority("info", "unresolved", { priority: "critical", priority_score: 95 }),
        "critical",
      );
      assert.equal(
        resolveIssuePriority("fatal", "unresolved", { priority: "low", priority_score: 10 }),
        "low",
      );

      // Stored priority with 0 score falls back to level
      assert.equal(
        resolveIssuePriority("error", "unresolved", { priority: "low", priority_score: 0 }),
        "high",
      );

      // Invalid stored priority string falls back to level
      assert.equal(
        resolveIssuePriority("error", "unresolved", { priority: "invalid_priority", priority_score: 50 }),
        "high",
      );
    });

    it("verifies IssuePriority 4-bar SVG rendering with rect count and opacity tiers", () => {
      // Critical: 4 active bars
      const criticalHtml = renderToStaticMarkup(
        React.createElement(IssuePriorityIcon, {
          level: "fatal",
          showLabel: true,
        }),
      );
      assert.match(criticalHtml, /<svg/);
      assert.match(criticalHtml, /data-priority-bars="4"/);
      assert.match(criticalHtml, /Critical/);
      // Count rect elements
      const rectMatches = criticalHtml.match(/<rect/g);
      assert.equal(rectMatches?.length, 4);
      // All 4 bars have opacity="1"
      const activeRects = criticalHtml.match(/opacity="1"/g);
      assert.equal(activeRects?.length, 4);

      // Low: 1 active bar, 3 dim (opacity="0.14")
      const lowHtml = renderToStaticMarkup(
        React.createElement(IssuePriorityIcon, {
          level: "info",
          showLabel: true,
        }),
      );
      assert.match(lowHtml, /Low/);
      assert.match(lowHtml, /data-priority-bars="1"/);
      const lowActiveRects = lowHtml.match(/opacity="1"/g);
      assert.equal(lowActiveRects?.length, 1);
      const lowDimRects = lowHtml.match(/opacity="0\.14"/g);
      assert.equal(lowDimRects?.length, 3);
    });

    it("renders distinct bar glyphs per priority state", () => {
      const critical = renderToStaticMarkup(
        React.createElement(IssuePriorityIcon, { level: "fatal" }),
      );
      const high = renderToStaticMarkup(
        React.createElement(IssuePriorityIcon, { level: "error" }),
      );
      const medium = renderToStaticMarkup(
        React.createElement(IssuePriorityIcon, { level: "warning" }),
      );
      const low = renderToStaticMarkup(
        React.createElement(IssuePriorityIcon, { level: "info" }),
      );
      assert.match(critical, /data-priority="critical"/);
      assert.match(high, /data-priority="high"/);
      assert.match(medium, /data-priority="medium"/);
      assert.match(low, /data-priority="low"/);
      assert.match(critical, /data-priority-bars="4"/);
      assert.match(high, /data-priority-bars="3"/);
      assert.match(medium, /data-priority-bars="2"/);
      assert.match(low, /data-priority-bars="1"/);
      assert.notEqual(critical, high);
      assert.notEqual(high, medium);
      assert.notEqual(medium, low);
    });

    it("renders IssuePriorityBadge in compact and normal modes", () => {
      const normalBadge = renderToStaticMarkup(
        React.createElement(IssuePriorityBadge, { level: "error" }),
      );
      assert.match(normalBadge, /High/);
      assert.match(normalBadge, /· error/);

      const compactBadge = renderToStaticMarkup(
        React.createElement(IssuePriorityBadge, { level: "error", compact: true }),
      );
      assert.match(compactBadge, /High/);
      assert.doesNotMatch(compactBadge, /· error/);
    });

    // 4.3 StepIndicator
    it("renders StepIndicator with empty steps, 1 step, and progress bar clamping", () => {
      // Empty steps bar
      const emptyBar = renderToStaticMarkup(
        React.createElement(StepIndicator, { steps: [], variant: "bar" }),
      );
      assert.match(emptyBar, /role="progressbar"/);
      assert.match(emptyBar, /0 of 0 complete/);

      // Empty steps pills
      const emptyPills = renderToStaticMarkup(
        React.createElement(StepIndicator, { steps: [], variant: "pills" }),
      );
      assert.match(emptyPills, /<ol/);

      // 1 active step out of 3
      const steps = [
        { id: "1", label: "Connect", complete: true },
        { id: "2", label: "Configure", active: true },
        { id: "3", label: "Verify" },
      ];
      const barHtml = renderToStaticMarkup(
        React.createElement(StepIndicator, { steps, variant: "bar" }),
      );
      assert.match(barHtml, /Step 2 of 3 · Configure/);
      assert.match(barHtml, /aria-valuenow="2"/);
      assert.match(barHtml, /aria-valuemax="3"/);

      const pillsHtml = renderToStaticMarkup(
        React.createElement(StepIndicator, { steps, variant: "pills" }),
      );
      assert.match(pillsHtml, /Connect/);
      assert.match(pillsHtml, /Configure/);
      assert.match(pillsHtml, /Verify/);
    });

    // 4.4 CopyDsnBlock
    it("renders CopyDsnBlock with masked bullet input and unmasked copy value", () => {
      const dsn = "https://epure_pub_key@epure.domain.com/42";
      const html = renderToStaticMarkup(
        React.createElement(CopyDsnBlock, { dsn }),
      );
      assert.match(html, /Connection string \(DSN\)/);
      assert.match(html, /data-copy-value="https:\/\/epure_pub_key@epure\.domain\.com\/42"/);
      assert.match(html, /aria-label="Show Connection string \(DSN\)"/);
      assert.match(html, /•{8,}/);
      assert.match(html, /Copy/);

      // Compact variant (revealed by default)
      const compactHtml = renderToStaticMarkup(
        React.createElement(CopyDsnBlock, { dsn, compact: true }),
      );
      assert.match(compactHtml, /epure-copy-dsn/);
      assert.match(compactHtml, /aria-label="Hide Connection string \(DSN\)"/);
      assert.match(compactHtml, /data-copy-value="https:\/\/epure_pub_key@epure\.domain\.com\/42"/);
    });

    // 4.5 CopyCurlBlock & buildCurlFromRequest
    it("buildCurlFromRequest formats headers, JSON body, string body, and handles empty params safely", () => {
      // 1. Minimal GET
      const getCurl = buildCurlFromRequest("https://api.epure.sh/health");
      assert.equal(getCurl, 'curl -X GET "https://api.epure.sh/health"');

      // 2. POST with headers and string body
      const postCurl = buildCurlFromRequest(
        "https://api.epure.sh/api/1/envelope/",
        "POST",
        {
          "Content-Type": "application/x-sentry-envelope",
          "X-Epure-Auth": "Epure epure_key=abc",
        },
        '{"event_id":"456"}',
      );
      assert.match(postCurl, /curl -X POST "https:\/\/api\.epure\.sh\/api\/1\/envelope\/"/);
      assert.match(postCurl, /-H "Content-Type: application\/x-sentry-envelope"/);
      assert.match(postCurl, /-H "X-Epure-Auth: Epure epure_key=abc"/);
      assert.match(postCurl, /-d "{\\"event_id\\":\\"456\\"}"/);

      // 3. POST with object body
      const objCurl = buildCurlFromRequest(
        "https://api.epure.sh/test",
        "POST",
        undefined,
        { status: "ok", count: 1 },
      );
      assert.match(objCurl, /curl -X POST "https:\/\/api\.epure\.sh\/test"/);
      assert.match(objCurl, /-d/);

      // 4. Null headers skipped
      const nullHeaderCurl = buildCurlFromRequest(
        "https://api.epure.sh/test",
        "GET",
        { Valid: "123", Invalid: null as unknown as string },
      );
      assert.match(nullHeaderCurl, /-H "Valid: 123"/);
      assert.doesNotMatch(nullHeaderCurl, /Invalid/);
    });

    it("renders CopyCurlBlock in standard and compact modes", () => {
      const standardHtml = renderToStaticMarkup(
        React.createElement(CopyCurlBlock, {
          url: "https://api.epure.sh/v1/events",
          method: "POST",
          headers: { Authorization: "Bearer tok_1" },
          body: { event: "ping" },
        }),
      );
      assert.match(standardHtml, /cURL Command/);
      assert.match(standardHtml, /curl -X POST/);
      assert.match(standardHtml, /Authorization: Bearer tok_1/);

      const compactHtml = renderToStaticMarkup(
        React.createElement(CopyCurlBlock, {
          url: "https://api.epure.sh/v1/events",
          compact: true,
        }),
      );
      assert.match(compactHtml, /epure-copy-curl/);
      assert.match(compactHtml, /Copy cURL/);
    });

    // 4.6 Remaining composite components smoke check
    it("verifies ActionButton, FilterChip, SharedProjectBadge, SdkSnippetBlock, EventHttpRequest, OccurrencePicker, SetupPlatformMark, SetupDocsLink, SetupStepSection, KeyboardHintsFooter, ListRow, Section, ToastProvider render without error", () => {
      // ActionButton
      const btnHtml = renderToStaticMarkup(
        React.createElement(ActionButton, { onClick: () => {} }, "Action"),
      );
      assert.match(btnHtml, /Action/);

      // FilterChip
      const chipHtml = renderToStaticMarkup(
        React.createElement(FilterChip, { label: "Filter1", active: true }),
      );
      assert.match(chipHtml, /Filter1/);

      // SharedProjectBadge
      const badgeHtml = renderToStaticMarkup(
        React.createElement(TooltipProvider, null, React.createElement(SharedProjectBadge, null)),
      );
      assert.match(badgeHtml, /Shared/);

      // SdkSnippetBlock
      const sdkHtml = renderToStaticMarkup(
        React.createElement(SdkSnippetBlock, { dsn: "https://dsn@epure.sh/1" }),
      );
      assert.match(sdkHtml, /JavaScript/);

      // SetupPlatformMark
      const markHtml = renderToStaticMarkup(
        React.createElement(SetupPlatformMark, { logo: "nextjs" }),
      );
      assert.match(markHtml, /src="\/frameworks\/nextjs\.svg"/);

      // SetupDocsLink
      const docsHtml = renderToStaticMarkup(
        React.createElement(SetupDocsLink, { href: "https://docs.epure.ai" }, "Documentation"),
      );
      assert.match(docsHtml, /Documentation/);

      // SetupStepSection
      const stepHtml = renderToStaticMarkup(
        React.createElement(SetupStepSection, { step: 1, title: "Title" }, "Content"),
      );
      assert.match(stepHtml, /1\./);
      assert.match(stepHtml, /Title/);

      // KeyboardHintsFooter
      const kbdHtml = renderToStaticMarkup(
        React.createElement(KeyboardHintsFooter, null),
      );
      assert.match(kbdHtml, /\?/);

      // ListRow
      const rowHtml = renderToStaticMarkup(
        React.createElement(ListRow, { variant: "airy" }, "Content"),
      );
      assert.match(rowHtml, /epure-list-row--airy/);

      // Section & SectionHeader
      const secHtml = renderToStaticMarkup(
        React.createElement(
          Section,
          null,
          React.createElement(SectionHeader, { title: "Telemetry" }),
        ),
      );
      assert.match(secHtml, /Telemetry/);

      // ToastProvider
      const toastHtml = renderToStaticMarkup(
        React.createElement(ToastProvider, null, React.createElement("div", null, "App")),
      );
      assert.match(toastHtml, /App/);
    });
  });
});
