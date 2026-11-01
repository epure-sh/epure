// web/src/ui/block/challenger-m3-2-stress.test.ts
// Challenger 2: Empirical Stress Test Suite for Milestone 3 (Block Tier & View Sections)
// Covers:
// 1. Occurrences & Telemetry (issue-occurrences, occurrence-line-chart, occurrence-line-chart-path)
// 2. Domain Panels & Setup Blocks (stack-trace-panel, issue-detail-overlay, setup-connect-panel, dual-sending-card, filter-panel)

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// Storage shim setup
const mockStorage = new Map<string, string>();
const storageShim: Storage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    mockStorage.set(key, String(value));
  },
  removeItem: (key: string) => {
    mockStorage.delete(key);
  },
  clear: () => {
    mockStorage.clear();
  },
  key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
  get length() {
    return mockStorage.size;
  },
};

if (typeof globalThis.localStorage === "undefined") {
  (globalThis as unknown as { localStorage: Storage }).localStorage = storageShim;
}
if (typeof globalThis.sessionStorage === "undefined") {
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = storageShim;
}

import {
  // Occurrences & Telemetry
  IssueOccurrences,
  IssueRecentOccurrences,
  IssueOccurrencesTable,
  OccurrenceLineChart,
  buildChartPoints,
  smoothLinePath,
  areaPath,
  fitExtremesScale,
  sparklineScaleFloor,
  maxPathY,
  IssueOccurrenceTimeline,
  IssueImpactStrip,
  IssueContextSnapshot,

  // Domain Panels & Setup
  StackTracePanel,
  isVendorFrame,
  dedupeStackFrames,
  buildStackList,
  collapseVendorRuns,
  findCulpritIndex,
  parseRawStackTrace,
  formatFullStackTrace,
  IssueDetailOverlay,
  SetupConnectPanel,
  DualSendingCard,
  FilterPanel,
  DEFAULT_FILTER_PRESETS,
  IssueDetailTabs,
  IssueOverviewPanel,
  IssueMorePanel,
} from "./index";

import type { EventDetail, IssueSummary } from "../../lib/api";
import type { StackFrame } from "./stack-trace-panel";

// Fixtures
const testIssue: IssueSummary = {
  id: "issue_c2_001",
  org_id: "org_test",
  project_id: "proj_checkout",
  fingerprint: "fp_checkout_err_99",
  title: "TypeError: Cannot read properties of undefined (reading 'cartId')",
  culprit: "src/billing/checkout.ts in processPayment",
  status: "unresolved",
  level: "error",
  event_count: 14250,
  unique_user_count: 850,
  first_seen_at: "2026-10-10T10:00:00Z",
  last_seen_at: "2026-10-31T19:00:00Z",
  snoozed: false,
  snooze_until: null,
  snooze_until_count: null,
  snooze_until_users: null,
  resolved_in_release: null,
  environment: "production",
  release: "v2.5.0",
};

function createTestEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: "evt_c2_1001",
    issue_id: "issue_c2_001",
    occurred_at: "2026-10-31T19:00:00Z",
    timestamp: "2026-10-31T19:00:00Z",
    received_at: "2026-10-31T19:00:01Z",
    event_type: "error",
    level: "error",
    environment: "production",
    release: "v2.5.0",
    server_name: "prod-api-worker-01",
    user_id: "usr_alice",
    user_email: "alice@example.com",
    user_ip: "192.168.1.100",
    runtime_name: "node",
    runtime_version: "20.12.0",
    os_name: "Linux",
    browser_name: "Chrome",
    browser_version: "128.0.0",
    payload_json: {
      transaction: "POST /api/v1/checkout",
      exception: {
        values: [
          {
            type: "TypeError",
            value: "Cannot read properties of undefined (reading 'cartId')",
          },
        ],
      },
    },
    payload: {
      transaction: "POST /api/v1/checkout",
      breadcrumbs: [],
    },
    stack_frames: [
      {
        filename: "src/billing/checkout.ts",
        function: "processPayment",
        lineno: 142,
        colno: 12,
        in_app: true,
        context_line: "const cartId = session.cart.cartId;",
        pre_context: ["function processPayment(session: CheckoutSession) {"],
        post_context: ["return executeCharge(cartId);"],
      },
      {
        filename: "node_modules/express/lib/router/layer.js",
        function: "handleRequest",
        lineno: 95,
        colno: 5,
        in_app: false,
      },
    ],
    ...overrides,
  };
}

describe("Challenger 2: Milestone 3 Empirical Stress Suite", () => {
  // =========================================================================
  // Focus Area 1: Occurrences & Telemetry
  // =========================================================================
  describe("Focus 1: Occurrences & Telemetry", () => {
    it("verifies mode='table', 'list', and 'detail' in IssueOccurrences", () => {
      const event = createTestEvent();

      // 1. Table mode
      const tableHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "table",
          issue: testIssue,
          events: [event],
          total: 1,
          selectedEventId: event.id,
          onSelectEvent: () => {},
        }),
      );
      assert.match(tableHtml, /data-slot="issue-occurrences"/);
      assert.match(tableHtml, /data-mode="table"/);
      assert.match(tableHtml, /alice@example\.com/);
      assert.match(tableHtml, /production/);
      assert.match(tableHtml, /POST \/api\/v1\/checkout/);

      // 2. List mode
      const listHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "list",
          issue: testIssue,
          events: [event],
          selectedEventId: event.id,
          onSelectEvent: () => {},
        }),
      );
      assert.match(listHtml, /data-slot="issue-occurrences"/);
      assert.match(listHtml, /data-mode="list"/);
      assert.match(listHtml, /Recent occurrences/);
      assert.match(listHtml, /alice@example\.com/);

      // 3. Detail mode
      const detailHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "detail",
          issue: testIssue,
          events: [event],
          selectedEventId: event.id,
          onSelectEvent: () => {},
        }),
      );
      assert.match(detailHtml, /data-slot="issue-occurrences"/);
      assert.match(detailHtml, /data-mode="detail"/);
      assert.match(detailHtml, /Event evt_c2_1/);
      assert.match(detailHtml, /TypeError: Cannot read properties of undefined/);
      assert.match(detailHtml, /node@20\.12\.0/);

      // 4. Drop-in wrapper compatibility: IssueRecentOccurrences & IssueOccurrencesTable
      const recentWrapper = renderToStaticMarkup(
        React.createElement(IssueRecentOccurrences, {
          issue: testIssue,
          events: [event],
          selectedEventId: event.id,
          onSelectEvent: () => {},
        }),
      );
      assert.match(recentWrapper, /data-mode="list"/);

      const tableWrapper = renderToStaticMarkup(
        React.createElement(IssueOccurrencesTable, {
          issue: testIssue,
          events: [event],
          total: 100,
          hasMore: false,
          loading: false,
          loadingMore: false,
          selectedEventId: event.id,
          onSelectEvent: () => {},
          onLoadMore: () => {},
        }),
      );
      assert.match(tableWrapper, /data-mode="table"/);
    });

    it("handles 0 occurrences across loading and idle states", () => {
      // 0 occurrences, loading
      const loadingHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "table",
          issue: testIssue,
          events: [],
          loading: true,
          total: 0,
          onSelectEvent: () => {},
        }),
      );
      assert.match(loadingHtml, /Loading occurrences…/);

      // 0 occurrences, idle (loaded)
      const emptyTableHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "table",
          issue: testIssue,
          events: [],
          loading: false,
          total: 0,
          onSelectEvent: () => {},
        }),
      );
      assert.match(emptyTableHtml, /No stored occurrences — counter may reflect pruned history\./);

      // 0 occurrences in list mode
      const emptyListHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "list",
          issue: testIssue,
          events: [],
          onSelectEvent: () => {},
        }),
      );
      assert.match(emptyListHtml, /Occurrence details not available — counter may reflect pruned history\./);
    });

    it("stress tests 10,000 occurrences and verifies infinite scroll sentinel", () => {
      const totalCount = 10000;
      const massiveEvents: EventDetail[] = new Array(totalCount).fill(null).map((_, i) => ({
        id: `evt_stress_${i}`,
        issue_id: "issue_c2_001",
        occurred_at: "2026-10-31T18:00:00Z",
        timestamp: "2026-10-31T18:00:00Z",
        received_at: "2026-10-31T18:00:01Z",
        event_type: "error",
        level: "error",
        environment: "production",
        release: "v2.5.0",
        server_name: "prod-worker",
        user_id: `usr_${i}`,
        user_email: `user_${i}@corp.internal`,
        user_ip: "10.0.0.1",
        runtime_name: "node",
        runtime_version: "20.12.0",
        os_name: "Linux",
        browser_name: "Chrome",
        browser_version: "128.0",
        payload_json: { transaction: `POST /job/${i}` },
        payload: {},
        stack_frames: [],
        breadcrumbs: [],
      }));

      // In list mode, only slices up to limit
      const listHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "list",
          issue: testIssue,
          events: massiveEvents,
          limit: 5,
          onSelectEvent: () => {},
        }),
      );
      assert.match(listHtml, /data-mode="list"/);
      assert.match(listHtml, /Showing last 10000 stored of 14,250 total/);

      // In table mode with hasMore=true, renders sentinel
      const tableHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "table",
          issue: testIssue,
          events: massiveEvents.slice(0, 100), // 100 loaded rows
          total: totalCount,
          hasMore: true,
          loadingMore: false,
          onSelectEvent: () => {},
          onLoadMore: () => {},
        }),
      );
      assert.match(tableHtml, /100 of 10,000 loaded/);
      assert.match(tableHtml, /Scroll for more/);

      // With loadingMore=true
      const loadingMoreHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "table",
          issue: testIssue,
          events: massiveEvents.slice(0, 100),
          total: totalCount,
          hasMore: true,
          loadingMore: true,
          onSelectEvent: () => {},
        }),
      );
      assert.match(loadingMoreHtml, /Loading more…/);
    });

    it("resiliently handles missing, sparse, and empty event detail fields", () => {
      const minimalEvent: EventDetail = {
        id: "evt_min",
        issue_id: "issue_c2_001",
        occurred_at: "2026-10-31T12:00:00Z",
        timestamp: "2026-10-31T12:00:00Z",
        received_at: "2026-10-31T12:00:00Z",
        event_type: "error",
        level: "error",
        environment: null,
        release: null,
        platform: null,
        runtime_name: null,
        runtime_version: null,
        browser_name: null,
        os_name: null,
        user_id: null,
        user_email: null,
        payload_json: {},
        payload: {},
        stack_frames: null,
        breadcrumbs: null,
      };

      const tableHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "table",
          issue: { ...testIssue, environment: null },
          events: [minimalEvent],
          total: 1,
          selectedEventId: minimalEvent.id,
          onSelectEvent: () => {},
        }),
      );
      assert.match(tableHtml, /data-mode="table"/);
      // Fallback em-dashes for missing user, env, release, runtime, etc.
      assert.match(tableHtml, /—/);

      const detailHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "detail",
          issue: testIssue,
          events: [minimalEvent],
          selectedEventId: minimalEvent.id,
          onSelectEvent: () => {},
        }),
      );
      assert.match(detailHtml, /data-mode="detail"/);
      assert.match(detailHtml, /User: <\/span><span class="font-mono text-fg-primary">—<\/span>/);
      assert.match(detailHtml, /Runtime: <\/span><span class="font-mono text-fg-primary">—<\/span>/);
      assert.match(detailHtml, /Error: <\/span><span class="font-mono text-fg-primary">—<\/span>/);
    });

    it("stress tests bezier path math with NaN, extreme values, and identical values", () => {
      // 1. Empty data
      assert.deepEqual(buildChartPoints([]), []);
      assert.equal(smoothLinePath([]), "");
      assert.equal(areaPath([], 50), "");
      assert.equal(maxPathY("", 50), 50);

      // 2. Single value
      const single = buildChartPoints([100], 100, 40);
      assert.equal(single.length, 1);
      assert.equal(single[0].x, 0);
      assert.match(smoothLinePath(single), /^M 0 /);
      assert.match(areaPath(single, 40), /L 0 40 L 0 40 Z$/);

      // 3. Two identical points (slope = 0)
      const identical = buildChartPoints([42, 42], 100, 40);
      assert.equal(identical.length, 2);
      assert.equal(identical[0].y, identical[1].y);
      const lineD = smoothLinePath(identical);
      assert.match(lineD, /^M 0 /);
      assert.doesNotMatch(lineD, /NaN/);

      // 4. All zeros
      const allZeros = buildChartPoints([0, 0, 0, 0, 0], 100, 40);
      assert.equal(allZeros.length, 5);
      for (const pt of allZeros) {
        assert.ok(!Number.isNaN(pt.x));
        assert.ok(!Number.isNaN(pt.y));
      }
      const zerosLine = smoothLinePath(allZeros);
      assert.doesNotMatch(zerosLine, /NaN/);

      // 5. Extreme values (0 to 1,000,000,000)
      const extremes = buildChartPoints([0, 1e9, 500, 1e9], 100, 40);
      assert.equal(extremes.length, 4);
      for (const pt of extremes) {
        assert.ok(!Number.isNaN(pt.y));
        assert.ok(pt.y >= 0);
      }
      const extremeLine = smoothLinePath(extremes);
      assert.doesNotMatch(extremeLine, /NaN/);

      // 6. fitExtremesScale guarantees
      assert.deepEqual(fitExtremesScale([]), { minCount: 0, maxCount: 1 });
      assert.deepEqual(fitExtremesScale([0, 0]), { minCount: 0, maxCount: 1 });
      assert.deepEqual(fitExtremesScale([50, 50]), { minCount: 49, maxCount: 51 });
      assert.deepEqual(fitExtremesScale([10, 100]), { minCount: 10, maxCount: 100 });

      // 7. sparklineScaleFloor guarantees
      assert.deepEqual(sparklineScaleFloor([]), { minCount: 0, maxCount: 1 });
      assert.deepEqual(sparklineScaleFloor([0, 0]), { minCount: 0, maxCount: 1 });
      const tightCluster = sparklineScaleFloor([100, 105, 110]);
      assert.ok(tightCluster.minCount > 0, "Floor lifted for tight high cluster");

      // 8. maxPathY sampling
      const samplePath = "M 0 10 C 20 0, 40 50, 60 20";
      const sampleMaxY = maxPathY(samplePath, 10);
      assert.ok(sampleMaxY >= 20);
    });

    it("renders OccurrenceLineChart with SVG elements, fitExtremes, and series prop", () => {
      // With number[] series
      const chartHtml = renderToStaticMarkup(
        React.createElement(OccurrenceLineChart, {
          series: [5, 12, 8, 25, 18, 30],
          height: 60,
          fitExtremes: true,
        }),
      );
      assert.match(chartHtml, /data-slot="occurrence-line-chart"/);
      assert.match(chartHtml, /<svg/);
      assert.match(chartHtml, /<path/);
      assert.match(chartHtml, /<linearGradient/);
      assert.doesNotMatch(chartHtml, /NaN/);

      // With empty series
      const emptyChartHtml = renderToStaticMarkup(
        React.createElement(OccurrenceLineChart, {
          series: [],
          height: 40,
        }),
      );
      assert.match(emptyChartHtml, /data-slot="occurrence-line-chart"/);

      // With TimelineBucket array
      const bucketChartHtml = renderToStaticMarkup(
        React.createElement(OccurrenceLineChart, {
          buckets: [
            { start: "2026-10-31T10:00:00Z", count: 10 },
            { start: "2026-10-31T11:00:00Z", count: 25 },
          ],
          height: 50,
          interactive: false,
        }),
      );
      assert.match(bucketChartHtml, /data-slot="occurrence-line-chart"/);
    });
  });

  // =========================================================================
  // Focus Area 2: Domain Panels & Setup Blocks
  // =========================================================================
  describe("Focus 2: Domain Panels & Setup Blocks", () => {
    it("processes stack traces in StackTracePanel with 0 frames, auto-vendor detection, and massive traces", () => {
      // 1. 0 frames captured
      const emptyPanelHtml = renderToStaticMarkup(
        React.createElement(StackTracePanel, {
          frames: [],
        }),
      );
      assert.match(emptyPanelHtml, /data-slot="stack-trace-panel"/);
      assert.match(emptyPanelHtml, /No stack frames captured for this occurrence\./);

      // 2. Missing in_app flag auto-detection
      const frameNode: StackFrame = {
        filename: "node_modules/@sentry/browser/dist/index.js",
        function: "captureException",
        lineno: 42,
        colno: 5,
      };
      const frameNext: StackFrame = {
        filename: "next/dist/compiled/next-server/app-page.runtime.prod.js",
        function: "renderToHTML",
        lineno: 10,
        colno: 2,
      };
      const framePython: StackFrame = {
        filename: "/usr/local/lib/python3.11/site-packages/django/core/handlers/base.py",
        function: "get_response",
        lineno: 140,
      };
      const frameRust: StackFrame = {
        filename: "/rustc/1.75.0/library/core/src/ops/function.rs",
        function: "core::ops::function::Fn::call",
        lineno: 250,
      };
      const frameAppWithContext: StackFrame = {
        filename: "src/billing/checkout.ts",
        function: "processPayment",
        lineno: 142,
        context_line: "const cartId = session.cart.cartId;",
      };
      const frameAppNoContext: StackFrame = {
        filename: "src/billing/validator.ts",
        function: "validateCart",
        lineno: 30,
      };

      assert.equal(isVendorFrame(frameNode), true);
      assert.equal(isVendorFrame(frameNext), true);
      assert.equal(isVendorFrame(framePython), true);
      assert.equal(isVendorFrame(frameRust), true);
      assert.equal(isVendorFrame(frameAppWithContext), false);
      assert.equal(isVendorFrame(frameAppNoContext), false);

      // 3. Vendor run collapse
      const mixedFrames = [
        frameAppWithContext,
        frameNode,
        frameNext,
        framePython,
        frameRust,
        frameAppNoContext,
      ];
      const collapsed = collapseVendorRuns(mixedFrames);
      assert.equal(collapsed.length, 3);
      assert.equal(collapsed[0].type, "frame");
      assert.equal(collapsed[1].type, "vendor-run");
      if (collapsed[1].type === "vendor-run") {
        assert.equal(collapsed[1].frames.length, 4);
      }
      assert.equal(collapsed[2].type, "frame");

      // 4. Culprit highlighting
      // App frame with context is prioritized as culprit
      const culpritIndexWithContext = findCulpritIndex(mixedFrames);
      assert.equal(culpritIndexWithContext, 0); // index 0 is frameAppWithContext

      // When no source context, non-vendor is selected
      const framesNoContext = [frameNode, frameNext, frameAppNoContext];
      const culpritNoContext = findCulpritIndex(framesNoContext);
      assert.equal(culpritNoContext, 2);

      // When all frames are vendor, falls back to frame 0
      const allVendorFrames = [frameNode, frameNext];
      assert.equal(findCulpritIndex(allVendorFrames), 0);

      // When empty, returns null
      assert.equal(findCulpritIndex([]), null);

      // 5. Massive stack trace (1,500 frames)
      const massiveFrames: StackFrame[] = [];
      for (let i = 0; i < 1500; i++) {
        if (i % 15 === 0) {
          massiveFrames.push({
            filename: `src/deep/module_${i}.ts`,
            function: `executeStep_${i}`,
            lineno: i,
            in_app: true,
            context_line: `step(${i});`,
          });
        } else {
          massiveFrames.push({
            filename: `node_modules/lib_${i % 10}/runtime.js`,
            function: `trampoline_${i}`,
            lineno: i,
            in_app: false,
          });
        }
      }

      const massivePanelHtml = renderToStaticMarkup(
        React.createElement(StackTracePanel, {
          frames: massiveFrames,
        }),
      );
      assert.match(massivePanelHtml, /data-slot="stack-trace-panel"/);
      assert.match(massivePanelHtml, /All 1500/);
      assert.match(massivePanelHtml, /In-app 100/);

      // 6. Raw stack parsing & copy formatting
      const rawSample = `TypeError: boom\n    at testFn (src/test.ts:10:20)\n    at node_modules/express/index.js:5:1`;
      const parsedRaw = parseRawStackTrace(rawSample);
      assert.equal(parsedRaw.length, 2);
      assert.equal(parsedRaw[0].function, "testFn");
      assert.equal(parsedRaw[0].in_app, true);
      assert.equal(parsedRaw[1].in_app, false);

      const copyOutput = formatFullStackTrace(
        { type: "TypeError", message: "boom" },
        dedupeStackFrames(parsedRaw),
      );
      assert.match(copyOutput, /^TypeError: boom\n/);
      assert.match(copyOutput, /at testFn \(src\/test\.ts:10:20\)/);
    });

    it("verifies SSR environment resilience when document is undefined in IssueDetailOverlay", () => {
      // 1. SSR test: temporarily remove document to verify SSR-safe branch
      const originalDocument = globalThis.document;
      try {
        // @ts-expect-error Simulating server environment
        delete globalThis.document;

        const ssrOverlayHtml = renderToStaticMarkup(
          React.createElement(
            IssueDetailOverlay,
            {
              isOpen: true,
              title: "SSR Issue Inspection",
            },
            React.createElement("div", { id: "ssr-content" }, "Overlay SSR Body"),
          ),
        );

        assert.match(ssrOverlayHtml, /data-slot="issue-detail-overlay"/);
        assert.match(ssrOverlayHtml, /SSR Issue Inspection/);
        assert.match(ssrOverlayHtml, /Overlay SSR Body/);
        assert.match(ssrOverlayHtml, /epure-issue-detail-backdrop/);
      } finally {
        globalThis.document = originalDocument;
      }

      // 2. Closed overlay returns null
      const closedOverlayHtml = renderToStaticMarkup(
        React.createElement(
          IssueDetailOverlay,
          {
            isOpen: false,
            title: "Closed Overlay",
          },
          React.createElement("div", null, "Hidden"),
        ),
      );
      assert.equal(closedOverlayHtml, "");

      // 3. Fullscreen overlay width style
      const fullscreenHtml = renderToStaticMarkup(
        React.createElement(
          IssueDetailOverlay,
          {
            isOpen: true,
            isFullscreen: true,
            title: "Fullscreen Overlay",
          },
          React.createElement("div", null, "Full Content"),
        ),
      );
      assert.match(fullscreenHtml, /style="width:100vw;max-width:100vw"/);
      assert.doesNotMatch(fullscreenHtml, /role="separator"/);
    });

    it("stress tests DSN parsing, copy triggers, and platform snippets in SetupConnectPanel and DualSendingCard", () => {
      // 1. Standard DSN parsing
      const stdDsn = "https://public_api_key@ingest.epure.sh/42";
      const dualCardHtml = renderToStaticMarkup(
        React.createElement(DualSendingCard, {
          epureDsn: stdDsn,
          sentryDsn: "https://sentryKey@o1.ingest.sentry.io/100",
        }),
      );
      assert.match(dualCardHtml, /data-slot="dual-sending-card"/);
      assert.match(dualCardHtml, /sentry_key=public_api_key/);
      assert.match(dualCardHtml, /42\/envelope/);
      assert.match(dualCardHtml, /Zero-Risk Migration: 6-Line Dual-Sending Tee/);
      assert.match(dualCardHtml, /makeDualTransport/);
      assert.match(dualCardHtml, /serializeEnvelope/);

      // 2. Custom host, port, and non-numeric segment DSN
      const customDsn = "http://dev_token@localhost:9000/my-org/project-x";
      const customCardHtml = renderToStaticMarkup(
        React.createElement(DualSendingCard, {
          epureDsn: customDsn,
        }),
      );
      assert.match(customCardHtml, /sentry_key=dev_token/);
      assert.match(customCardHtml, /my-org\/project-x\/envelope/);

      // 3. Malformed DSN (should never throw or crash)
      const badDsn = "this-is-not-a-valid-url";
      const fallbackCardHtml = renderToStaticMarkup(
        React.createElement(DualSendingCard, {
          epureDsn: badDsn,
          publicKey: "custom_key",
          dsnSegment: "default_seg",
        }),
      );
      assert.match(fallbackCardHtml, /sentry_key=custom_key/);
      assert.match(fallbackCardHtml, /default_seg\/envelope/);

      // 4. SetupConnectPanel with Next.js, Python, and Sentry migration tee
      const nextjsSetupHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(SetupConnectPanel, {
            dsn: stdDsn,
            setupPath: "fresh",
            defaultPlatform: "nextjs",
          }),
        ),
      );
      assert.match(nextjsSetupHtml, /data-slot="setup-connect-panel"/);
      assert.match(nextjsSetupHtml, /@sentry\/nextjs/);
      assert.match(nextjsSetupHtml, /Install/);
      assert.match(nextjsSetupHtml, /DSN/);

      const sentrySetupHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(SetupConnectPanel, {
            dsn: stdDsn,
            setupPath: "sentry",
            defaultPlatform: "python",
          }),
        ),
      );
      assert.match(sentrySetupHtml, /data-slot="setup-connect-panel"/);
      assert.match(sentrySetupHtml, /Dual-Send \(Tee\)/);
      assert.match(sentrySetupHtml, /sentry-sdk/);
    });

    it("verifies FilterPanel preset selection, active chips, and query token replacement", () => {
      // 1. Initial active chips match active query tokens
      const filterHtml = renderToStaticMarkup(
        React.createElement(FilterPanel, {
          query: "is:unresolved environment:production",
          onQueryChange: () => {},
        }),
      );
      assert.match(filterHtml, /data-slot="filter-panel"/);
      assert.match(filterHtml, /Unresolved/);
      assert.match(filterHtml, /Production only/);

      // 2. Select dropdown triggers (timeWindow and sort)
      const selectFilterHtml = renderToStaticMarkup(
        React.createElement(FilterPanel, {
          query: "is:unresolved",
          onQueryChange: () => {},
          timeWindow: "14d",
          timeWindowOptions: [
            { value: "24h", label: "24 hours" },
            { value: "14d", label: "14 days" },
          ],
          onTimeWindowChange: () => {},
          sort: "users",
          sortOptions: [
            { value: "events", label: "Events" },
            { value: "users", label: "Users" },
          ],
          onSortChange: () => {},
        }),
      );
      assert.match(selectFilterHtml, /aria-label="Time range"/);
      assert.match(selectFilterHtml, /aria-label="Sort issues"/);

      // 3. Custom presets array
      const customPresets = [
        { label: "Critical Fatalities", token: "level:fatal" },
        { label: "Staging Fleet", token: "environment:staging" },
      ];
      const customFilterHtml = renderToStaticMarkup(
        React.createElement(FilterPanel, {
          query: "level:fatal",
          presets: customPresets,
          onQueryChange: () => {},
        }),
      );
      assert.match(customFilterHtml, /Critical Fatalities/);
    });

    it("renders IssueDetailTabs, IssueOverviewPanel, and IssueMorePanel", () => {
      const event = createTestEvent();

      // IssueDetailTabs
      const tabsHtml = renderToStaticMarkup(
        React.createElement(IssueDetailTabs, {
          issue: testIssue,
          activeTab: "overview",
          onTabChange: () => {},
          actions: React.createElement("button", null, "Resolve"),
        }),
      );
      assert.match(tabsHtml, /data-slot="issue-detail-tabs"/);
      assert.match(tabsHtml, /Context/);
      assert.match(tabsHtml, /Stack trace/);
      assert.match(tabsHtml, /Breadcrumbs/);
      assert.match(tabsHtml, /Resolve/);

      // IssueOverviewPanel
      const overviewHtml = renderToStaticMarkup(
        React.createElement(IssueOverviewPanel, {
          issue: testIssue,
          event,
          events: [event],
        }),
      );
      assert.match(overviewHtml, /data-slot="issue-overview-panel"/);
      assert.match(overviewHtml, /POST \/api\/v1\/checkout/);
      assert.match(overviewHtml, /alice@example\.com/);
      assert.match(overviewHtml, /Starting point for your AI agent/);

      // IssueMorePanel
      const moreHtml = renderToStaticMarkup(
        React.createElement(IssueMorePanel, {
          issue: testIssue,
          events: [event],
        }),
      );
      assert.match(moreHtml, /data-slot="issue-more-panel"/);
      assert.match(moreHtml, /Grouping/);
      assert.match(moreHtml, /Fingerprint/);
      assert.match(moreHtml, /fp_checkout_err_99/);
    });
  });
});
