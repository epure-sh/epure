// web/src/ui/block/challenger-m3-stress.test.ts
// Empirical Challenger M3: Adversarial Stress Test Suite
// Rigorous verification of Milestone 3: Block Tier & Multi-Component View Sections in web/src/ui/block/**

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// Storage shim setup
const mockStorage = new Map<string, string>();
const defaultStorageShim: Storage = {
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
  (globalThis as unknown as { localStorage: Storage }).localStorage = defaultStorageShim;
}
if (typeof globalThis.sessionStorage === "undefined") {
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = defaultStorageShim;
}

import {
  // Feed & Row
  IssueFeedRow,
  IssueRowShell,
  IssueRow,
  FeedListBody,
  StackedCardList,
  CardRowSkeleton,
  IssueRowSkeleton,
  FeedRowSkeleton,
  FeedSkeletonList,
  ISSUE_ROW_GRID,
  ISSUE_FEED_ROW_HEIGHT_CLASS,

  // Navigation & Shell
  SettingsNav,
  PROJECT_SETTINGS_ITEMS,
  WORKSPACE_SETTINGS_ITEMS,
  isSettingsTabActive,
  isProjectSettingsPath,
  isWorkspaceSettingsPath,
  activeProjectSettingsTab,
  activeWorkspaceSettingsTab,
  PageShell,
  PageChrome,
  FeedHeaderStat,
  FeedHeaderStatDot,
  PageHeader,
  SimpleFeedHeader,
  BreadcrumbTimeline,
  asBreadcrumbs,
  crumbTimestampMs,
  matchesFilter,
  filterLabel,
  isErrorLevel,
  categoryKind,
  categoryIcon,
  displayMessage,
  orderCrumbs,
  formatRelativeOffset,
  trailSummary,

  // Telemetry & Math
  OccurrenceLineChart,
  buildChartPoints,
  smoothLinePath,
  areaPath,
  fitExtremesScale,
  sparklineScaleFloor,
  maxPathY,
  IssueOccurrences,
  IssueRecentOccurrences,
  IssueOccurrencesTable,
  IssueOccurrenceTimeline,
  IssueImpactStrip,
  IssueContextSnapshot,
  IssueContextFields,

  // Panels & Setup
  StackTracePanel,
  findCulpritIndex,
  collapseVendorRuns,
  parseRawStackTrace,
  IssueDetailTabs,
  IssueDetailOverlay,
  IssueOverviewPanel,
  IssueMorePanel,
  MorePanel,
  SetupConnectPanel,
  SetupChecklist,
  SetupConnectGuide,
  SetupWaitingPanel,
  DualSendingCard,

  // Filter & Error
  FilterPanel,
  RouteErrorBoundary,
} from "./index";

import type { EventDetail, IssueSummary, TimelineBucket } from "../../lib/api";

const baselineIssue: IssueSummary = {
  id: "issue_base_1",
  org_id: "org_alpha",
  project_id: "proj_checkout",
  fingerprint: "fp_test_99",
  title: "ReferenceError: activeCart is not defined",
  culprit: "src/cart/store.ts in getActiveCart",
  status: "unresolved",
  level: "error",
  event_count: 5240,
  unique_user_count: 312,
  first_seen_at: "2026-10-01T08:00:00Z",
  last_seen_at: "2026-10-31T15:30:00Z",
  snoozed: false,
  snooze_until: null,
  snooze_until_count: null,
  snooze_until_users: null,
  resolved_in_release: null,
  environment: "production",
  release: "v3.1.0",
};

const baselineEvent: EventDetail = {
  id: "evt_stress_100",
  issue_id: "issue_base_1",
  occurred_at: "2026-10-31T15:30:00Z",
  timestamp: "2026-10-31T15:30:00Z",
  received_at: "2026-10-31T15:30:01Z",
  event_type: "error",
  level: "error",
  environment: "production",
  release: "v3.1.0",
  server_name: "prod-worker-9",
  user_id: "usr_stress_7",
  user_email: "stress.user@example.com",
  user_ip: "10.0.0.42",
  runtime_name: "node",
  runtime_version: "22.2.0",
  os_name: "Linux",
  browser_name: "Firefox",
  browser_version: "128.0",
  payload_json: {
    transaction: "POST /cart/checkout",
    exception: {
      values: [
        {
          type: "ReferenceError",
          value: "activeCart is not defined in scope",
        },
      ],
    },
  },
  payload: {
    breadcrumbs: [
      {
        timestamp: 1730388590,
        category: "navigation",
        message: "Navigated to /cart",
      },
      {
        timestamp: 1730388595,
        category: "fetch",
        message: "POST /cart/checkout 500",
        level: "error",
      },
    ],
  },
  stack_frames: [
    {
      filename: "src/cart/store.ts",
      function: "getActiveCart",
      lineno: 74,
      colno: 8,
      in_app: true,
      context_line: "const cart = activeCart.items;",
      pre_context: ["function getActiveCart() {"],
      post_context: ["return cart;"],
    },
    {
      filename: "node_modules/koa-router/lib/router.js",
      function: "dispatch",
      lineno: 112,
      colno: 14,
      in_app: false,
    },
  ],
};

describe("Empirical Challenger M3: Adversarial Stress Test Suite", () => {
  // =========================================================================
  // Section 1: Feed & Row Blocks (`issue-feed-row.tsx`, `feed-list-shell.tsx`)
  // =========================================================================
  describe("Section 1: Feed & Row Blocks Boundary & Stress", () => {
    it("renders all 4 variants cleanly: grid, compact, mobile, airy", () => {
      const variants = ["grid", "compact", "mobile", "airy"] as const;
      for (const variant of variants) {
        const html = renderToStaticMarkup(
          React.createElement(IssueFeedRow, {
            variant,
            title: `Variant Test: ${variant}`,
            subtitle: `src/${variant}.ts:10`,
            eventsCount: 42,
            usersCount: 5,
            unread: true,
          }),
        );
        assert.match(html, /data-slot="issue-feed-row"/);
        assert.match(html, new RegExp(`data-variant="${variant}"`));
        assert.match(html, new RegExp(`Variant Test: ${variant}`));
        assert.match(html, new RegExp(`src\\/${variant}\\.ts:10`));
      }
    });

    it("survives extreme issue titles: 10,000 characters, Unicode, RTL, HTML tags", () => {
      const tenKTitle = "CRASH_".repeat(1666) + "_END";
      const rtlTitle = "خطأ غير متوقع في معالجة الدفع - שגיאת תשלום חמורה";
      const htmlInjectionTitle = "<script>alert('xss')</script><b>Bold Error</b>";
      const emojiTitle = "💥🔥⚠️💣 Critical System Meltdown 🚀🚨";

      const titles = [tenKTitle, rtlTitle, htmlInjectionTitle, emojiTitle];
      for (const t of titles) {
        const html = renderToStaticMarkup(
          React.createElement(IssueFeedRow, {
            variant: "grid",
            title: t,
            subtitle: "location/file.ts",
          }),
        );
        assert.match(html, /data-slot="issue-feed-row"/);
        // React escapes HTML tags safely
        if (t === htmlInjectionTitle) {
          assert.match(html, /&lt;script&gt;alert\(&#x27;xss&#x27;\)&lt;\/script&gt;/);
        }
      }
    });

    it("survives empty, null, and undefined titles and subtitles without crashing", () => {
      // Empty string title
      const emptyHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "",
          subtitle: "",
        }),
      );
      assert.match(emptyHtml, /data-slot="issue-feed-row"/);

      // Undefined title with fallback to "Untitled Issue"
      const undefinedHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: undefined,
          subtitle: undefined,
        }),
      );
      assert.match(undefinedHtml, /Untitled Issue/);

      // Null subtitle should not render subtitle paragraph
      const nullSubHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Valid Title",
          subtitle: null,
          culprit: null,
          location: null,
        }),
      );
      assert.match(nullSubHtml, /Valid Title/);
      assert.doesNotMatch(nullSubHtml, /<p class="[^"]*truncate font-mono text-\[11px\]/);
    });

    it("survives massive counts (billions), negative counts, zero, and strings", () => {
      // 1 Billion events
      const billionHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Spike Issue",
          eventsCount: 1_000_000_000,
          usersCount: 50_000_000,
        }),
      );
      assert.match(billionHtml, /1000M/);
      assert.match(billionHtml, /50M/);

      // MAX_SAFE_INTEGER
      const maxSafeHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Max Int Issue",
          eventsCount: Number.MAX_SAFE_INTEGER,
        }),
      );
      assert.match(maxSafeHtml, /M/);

      // Negative counts (e.g. invalid telemetry delta)
      const negHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Negative Delta Issue",
          eventsCount: -42,
          usersCount: -1,
        }),
      );
      assert.match(negHtml, /-42/);
      assert.match(negHtml, /-1/);

      // Zero counts
      const zeroHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Zero Issue",
          eventsCount: 0,
          usersCount: 0,
        }),
      );
      assert.match(zeroHtml, />0</);

      // Pre-formatted string counts
      const strHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "String Count Issue",
          eventsCount: "999k+",
          usersCount: "12.5k",
        }),
      );
      assert.match(strHtml, /999k\+/);
      assert.match(strHtml, /12\.5k/);
    });

    it("survives missing, null, epoch, and malformed timestamps gracefully", () => {
      const dates = [
        undefined,
        null,
        "not-a-valid-date-string",
        "1970-01-01T00:00:00Z",
        "2099-12-31T23:59:59Z",
      ];
      for (const d of dates) {
        const html = renderToStaticMarkup(
          React.createElement(IssueFeedRow, {
            title: "Timestamp Test",
            lastSeen: d as string | undefined,
            firstSeen: d as string | undefined,
          }),
        );
        assert.match(html, /data-slot="issue-feed-row"/);
        if (d === undefined || d === null || d === "not-a-valid-date-string") {
          assert.match(html, /—/);
        }
      }
    });

    it("toggles tourAnchor attribute accurately", () => {
      const withTour = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Tour Row",
          tourAnchor: true,
        }),
      );
      assert.match(withTour, /data-tour="issue-row-sample"/);

      const withoutTour = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Regular Row",
          tourAnchor: false,
        }),
      );
      assert.doesNotMatch(withoutTour, /data-tour=/);
    });

    it("renders unread rail and escalating indicator rail under all trigger states", () => {
      // Unread = true
      const unreadHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Unread Row",
          unread: true,
        }),
      );
      assert.match(unreadHtml, /data-slot="unread-rail"/);
      assert.match(unreadHtml, /data-inbox-unread="true"/);
      assert.match(unreadHtml, /font-semibold/);

      // Unread = false
      const readHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Read Row",
          unread: false,
        }),
      );
      assert.doesNotMatch(readHtml, /data-slot="unread-rail"/);
      assert.match(readHtml, /data-inbox-read="true"/);

      // Escalating via escalating prop — priority icon, no second left rail
      const escalatingPropHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Escalating Prop Row",
          escalating: true,
        }),
      );
      assert.doesNotMatch(escalatingPropHtml, /data-slot="escalating-indicator"/);
      assert.match(escalatingPropHtml, /data-escalating="true"/);
      assert.match(escalatingPropHtml, /data-priority="critical"/);

      // Escalating via status="regression"
      const regressionHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Regression Row",
          status: "regression",
          regression: true,
        }),
      );
      assert.doesNotMatch(regressionHtml, /data-slot="escalating-indicator"/);
      assert.match(regressionHtml, /Came back/);

      // Escalating via trendStatus="escalating"
      const trendEscalatingHtml = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Trend Escalating Row",
          trendStatus: "escalating",
        }),
      );
      assert.doesNotMatch(trendEscalatingHtml, /data-slot="escalating-indicator"/);
      assert.match(trendEscalatingHtml, /data-escalating="true"/);
    });

    it("verifies IssueRowShell and IssueRow backward-compatible drop-in wrappers", () => {
      const shellHtml = renderToStaticMarkup(
        React.createElement(IssueRowShell, {
          id: "shell_1",
          title: "Shell Drop-In",
          subtitle: "src/legacy/shim.ts",
          eventsCount: "420",
          usersCount: "18",
          timeAgo: "3m ago",
          age: "4d",
          escalating: true,
          tourAnchor: true,
        }),
      );
      assert.match(shellHtml, /data-slot="issue-row-shell"/);
      assert.match(shellHtml, /data-variant="grid"/);
      assert.match(shellHtml, /data-tour="issue-row-sample"/);
      assert.match(shellHtml, /data-escalating="true"/);

      const rowHtml = renderToStaticMarkup(
        React.createElement(IssueRow, {
          title: "Mobile Button Drop-In",
          lastSeen: "2026-10-31T12:00:00Z",
          eventCount: 88,
          userCount: 4,
          regression: true,
          unread: true,
        }),
      );
      assert.match(rowHtml, /data-slot="issue-feed-row"/);
      assert.match(rowHtml, /data-variant="mobile"/);
      assert.match(rowHtml, /Mobile Button Drop-In/);
      assert.match(rowHtml, /Came back/);
      assert.match(rowHtml, /88 events/);
      assert.match(rowHtml, /4 users/);
    });

    it("renders custom checkbox, lifecycle, and rowActions slots", () => {
      const html = renderToStaticMarkup(
        React.createElement(IssueFeedRow, {
          title: "Custom Slots Row",
          checkbox: React.createElement("span", { id: "custom-checkbox" }, "☑"),
          lifecycle: React.createElement("span", { id: "custom-lifecycle" }, "Custom Life"),
          rowActions: React.createElement("button", { id: "custom-action" }, "Resolve"),
        }),
      );
      assert.match(html, /id="custom-checkbox"/);
      assert.match(html, /id="custom-lifecycle"/);
      assert.match(html, /id="custom-action"/);
      assert.match(html, /Resolve/);
    });

    it("renders FeedListBody and StackedCardList with 0 and 200 items", () => {
      // Empty children
      const emptyBody = renderToStaticMarkup(
        React.createElement(FeedListBody, null, null),
      );
      assert.match(emptyBody, /epure-feed-list-body/);

      // 200 children list
      const manyItems = Array.from({ length: 200 }, (_, i) =>
        React.createElement("li", { key: i }, `Row item ${i}`),
      );
      const listHtml = renderToStaticMarkup(
        React.createElement(StackedCardList, null, manyItems),
      );
      assert.match(listHtml, /epure-stacked-card-list/);
      assert.match(listHtml, /Row item 0/);
      assert.match(listHtml, /Row item 199/);
    });

    it("renders FeedSkeletonList in grid, compact, and card variants with count boundaries", () => {
      // Zero count
      const zeroHtml = renderToStaticMarkup(
        React.createElement(FeedSkeletonList, { count: 0 }),
      );
      assert.doesNotMatch(zeroHtml, /epure-issue-row-skeleton/);

      // Card variant
      const cardListHtml = renderToStaticMarkup(
        React.createElement(FeedSkeletonList, { count: 4, variant: "card" }),
      );
      assert.match(cardListHtml, /epure-card-row-skeleton/);

      // Compact variant
      const compactListHtml = renderToStaticMarkup(
        React.createElement(FeedSkeletonList, { count: 3, variant: "compact" }),
      );
      assert.match(compactListHtml, /epure-issue-row-skeleton/);
    });
  });

  // =========================================================================
  // Section 2: Navigation & Shell Blocks (`settings-nav.tsx`, `page-shell.tsx`, etc.)
  // =========================================================================
  describe("Section 2: Navigation & Shell Blocks Stress & Edge Cases", () => {
    it("renders SettingsNav type='project' with projectId interpolation in accordion, horizontal, and drawer layouts", () => {
      const layouts = ["accordion", "horizontal", "drawer"] as const;
      for (const layout of layouts) {
        const html = renderToStaticMarkup(
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/projects/my-prod-project/settings/privacy"] },
            React.createElement(SettingsNav, {
              type: "project",
              projectId: "my-prod-project",
              layout,
            }),
          ),
        );
        assert.match(html, /data-slot="settings-nav"/);
        assert.match(html, /data-settings-type="project"/);
        assert.match(html, new RegExp(`data-layout="${layout}"`));
        assert.match(html, /Privacy/);
        assert.match(html, /Client Keys/);
        assert.match(html, /Filters/);
      }
    });

    it("renders SettingsNav type='workspace' with production tabs", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/settings/agent"] },
          React.createElement(SettingsNav, {
            type: "workspace",
            layout: "horizontal",
          }),
        ),
      );
      assert.match(html, /data-slot="settings-nav"/);
      assert.match(html, /data-settings-type="workspace"/);
      assert.match(html, /General/);
      assert.match(html, /Security/);
      assert.match(html, /Agent tokens/);
      assert.match(html, /Connected apps/);
    });

    it("survives sessionStorage SecurityError and QuotaExceededError exceptions", () => {
      const originalStorage = globalThis.sessionStorage;
      try {
        // Mock throwing storage (e.g. Safari private mode or full disk quota)
        const throwingStorage: Storage = {
          getItem: () => {
            throw new Error("SecurityError: Access is denied for this document");
          },
          setItem: () => {
            throw new Error("QuotaExceededError: DOM Exception 22");
          },
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        };
        (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = throwingStorage;

        const html = renderToStaticMarkup(
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/projects/p1/settings"] },
            React.createElement(SettingsNav, {
              type: "project",
              projectId: "p1",
            }),
          ),
        );
        assert.match(html, /data-slot="settings-nav"/);
        assert.match(html, /Project Settings/);
      } finally {
        (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = originalStorage;
      }
    });

    it("survives pure SSR when sessionStorage is completely undefined", () => {
      const originalStorage = globalThis.sessionStorage;
      try {
        // Delete sessionStorage from global scope
        delete (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage;

        const html = renderToStaticMarkup(
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/settings"] },
            React.createElement(SettingsNav, {
              type: "workspace",
            }),
          ),
        );
        assert.match(html, /data-slot="settings-nav"/);
        assert.match(html, /Workspace Settings/);
      } finally {
        (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = originalStorage;
      }
    });

    it("tests path active tab helpers and regex segment matchers", () => {
      // activeProjectSettingsTab
      assert.equal(activeProjectSettingsTab("/projects/p1/settings"), "general");
      assert.equal(activeProjectSettingsTab("/projects/p1/settings/privacy"), "privacy");
      assert.equal(activeProjectSettingsTab("/projects/p1/settings/dsn"), "dsn");
      assert.equal(activeProjectSettingsTab("/projects/p1/settings/filters"), "filters");
      assert.equal(activeProjectSettingsTab("/projects/p1/settings/unknown-tab"), "general");

      // activeWorkspaceSettingsTab
      assert.equal(activeWorkspaceSettingsTab("/settings"), "general");
      assert.equal(activeWorkspaceSettingsTab("/settings/security"), "security");
      assert.equal(activeWorkspaceSettingsTab("/settings/agent"), "agent");
      assert.equal(activeWorkspaceSettingsTab("/settings/connected-apps"), "connected-apps");
      assert.equal(activeWorkspaceSettingsTab("/settings/unknown-tab"), "general");
    });

    it("renders PageShell in all 3 density modes: standard, full-bleed, feed", () => {
      // standard
      const standardHtml = renderToStaticMarkup(
        React.createElement(
          PageShell,
          { density: "standard" },
          React.createElement("div", null, "Standard Content"),
        ),
      );
      assert.match(standardHtml, /data-slot="page-shell"/);
      assert.match(standardHtml, /data-slot="page-shell-main"/);
      assert.match(standardHtml, /Standard Content/);

      // full-bleed
      const fullBleedHtml = renderToStaticMarkup(
        React.createElement(
          PageShell,
          { density: "full-bleed" },
          React.createElement("div", null, "Full Bleed Map/Graph"),
        ),
      );
      assert.match(fullBleedHtml, /data-slot="page-shell"/);
      assert.doesNotMatch(fullBleedHtml, /data-slot="page-shell-main"/);
      assert.match(fullBleedHtml, /Full Bleed Map\/Graph/);

      // feed
      const feedHtml = renderToStaticMarkup(
        React.createElement(
          PageShell,
          { density: "feed" },
          React.createElement("div", null, "Feed Scroll Items"),
        ),
      );
      assert.match(feedHtml, /data-slot="page-shell"/);
      assert.match(feedHtml, /data-slot="feed-list-body"/);
      assert.match(feedHtml, /Feed Scroll Items/);
    });

    it("renders PageChrome variants: standard, compact, feed, toolbar, and drop-in wrappers", () => {
      // feed variant with stats
      const feedHtml = renderToStaticMarkup(
        React.createElement(PageChrome, {
          variant: "feed",
          stats: React.createElement(
            React.Fragment,
            null,
            React.createElement(FeedHeaderStat, { label: "Unresolved", value: "1,240" }),
            React.createElement(FeedHeaderStatDot),
            React.createElement(FeedHeaderStat, { label: "Escalating", value: 3 }),
            React.createElement(FeedHeaderStatDot),
            React.createElement(FeedHeaderStat, { label: "Loading Stat", loading: true }),
          ),
          actions: React.createElement("button", null, "Mark all read"),
        }),
      );
      assert.match(feedHtml, /data-slot="page-chrome"/);
      assert.match(feedHtml, /data-variant="feed"/);
      assert.match(feedHtml, /1,240/);
      assert.match(feedHtml, /Unresolved/);
      assert.match(feedHtml, /Escalating/);
      assert.match(feedHtml, /Mark all read/);

      // feed variant with no stats and no actions returns null
      const emptyFeedHtml = renderToStaticMarkup(
        React.createElement(PageChrome, { variant: "feed" }),
      );
      assert.equal(emptyFeedHtml, "");

      // toolbar variant
      const toolbarHtml = renderToStaticMarkup(
        React.createElement(PageChrome, {
          variant: "toolbar",
          title: "Issues Omnibus",
          search: React.createElement("input", { placeholder: "Search issues..." }),
          filters: React.createElement("button", null, "Preset Filter"),
        }),
      );
      assert.match(toolbarHtml, /data-slot="page-chrome"/);
      assert.match(toolbarHtml, /data-variant="toolbar"/);
      assert.match(toolbarHtml, /Issues Omnibus/);
      assert.match(toolbarHtml, /Search issues\.\.\./);

      // SimpleFeedHeader drop-in wrapper
      const simpleHtml = renderToStaticMarkup(
        React.createElement(SimpleFeedHeader, {
          stats: React.createElement(FeedHeaderStat, { label: "Total", value: 50 }),
        }),
      );
      assert.match(simpleHtml, /data-variant="feed"/);
      assert.match(simpleHtml, /50/);
    });

    it("stress-tests BreadcrumbTimeline: 0 items, 1,000 items, and filtering", () => {
      // 0 items
      const zeroHtml = renderToStaticMarkup(
        React.createElement(BreadcrumbTimeline, {
          selectedEvent: { ...baselineEvent, payload: { breadcrumbs: [] } },
        }),
      );
      assert.match(zeroHtml, /No breadcrumbs captured for this occurrence\./);

      // 1,000 items performance & inline cap test
      const thousandCrumbs = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: 1730000000 + i * 2,
        category: i % 3 === 0 ? "fetch" : i % 3 === 1 ? "console" : "navigation",
        message: `Step ${i}: HTTP GET /api/item/${i}`,
        level: i === 999 ? "error" : "info",
      }));

      const start = Date.now();
      const thousandHtml = renderToStaticMarkup(
        React.createElement(BreadcrumbTimeline, {
          breadcrumbs: thousandCrumbs,
          selectedEvent: baselineEvent,
        }),
      );
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 1000, `Rendering 1,000 breadcrumbs took ${elapsed}ms (>1000ms)`);

      assert.match(thousandHtml, /data-slot="breadcrumb-timeline"/);
      assert.match(thousandHtml, /1000 steps ·/);
      assert.match(thousandHtml, /View all 1000 steps →/);
      // Inline cap: exactly 10 rows rendered initially
      const matches = thousandHtml.match(/epure-breadcrumb-row/g);
      assert.equal(matches?.length, 10);
    });

    it("verifies BreadcrumbTimeline search filter parsing and invalid regex fallback", () => {
      const crumbs = [
        { category: "fetch", message: "POST /api/v1/auth 200 OK" },
        { category: "console", message: "Warning: Missing prop on card" },
        { category: "ui", message: "User clicked submit-order-btn" },
      ];

      // matchesFilter helper
      assert.equal(matchesFilter(crumbs[0], "http"), true);
      assert.equal(matchesFilter(crumbs[0], "console"), false);
      assert.equal(matchesFilter(crumbs[1], "console"), true);
      assert.equal(matchesFilter(crumbs[2], "all"), true);

      // asBreadcrumbs parsing variations
      assert.equal(asBreadcrumbs(null).length, 0);
      assert.equal(asBreadcrumbs(undefined).length, 0);
      assert.equal(asBreadcrumbs("string").length, 0);
      assert.equal(asBreadcrumbs({ values: crumbs }).length, 3);
      assert.equal(asBreadcrumbs(crumbs).length, 3);

      // crumbTimestampMs seconds vs milliseconds
      assert.equal(crumbTimestampMs(1730388590), 1730388590000);
      assert.equal(crumbTimestampMs(1730388590000), 1730388590000);
      assert.equal(crumbTimestampMs(undefined), null);
      assert.equal(crumbTimestampMs(NaN), null);

      // formatRelativeOffset calculation
      assert.equal(formatRelativeOffset(1000, 1000), "+0.0s");
      assert.equal(formatRelativeOffset(15000, 1000), "+14.0s");
      assert.equal(formatRelativeOffset(130000, 1000), "+2m 9s");

      // trailSummary calculation
      assert.equal(trailSummary([]), null);
      const ordered = orderCrumbs([
        { timestamp: 1730000000, message: "A" },
        { timestamp: 1730000045, message: "B" },
      ]);
      assert.match(trailSummary(ordered)!, /2 steps · 45\.0s trail/);
    });
  });

  // =========================================================================
  // Section 3: Telemetry & Math Resilience (`occurrence-line-chart-path.ts`, etc.)
  // =========================================================================
  describe("Section 3: Telemetry & Math Resilience", () => {
    it("handles boundary values in buildChartPoints: empty, single item, all zeros, massive scale", () => {
      // Empty buckets
      const emptyPts = buildChartPoints([]);
      assert.equal(emptyPts.length, 0);
      assert.equal(smoothLinePath(emptyPts), "");
      assert.equal(areaPath(emptyPts, 40), "");

      // Single item
      const singlePts = buildChartPoints([42]);
      assert.equal(singlePts.length, 1);
      assert.match(smoothLinePath(singlePts), /^M /);

      // All zeros
      const zeroPts = buildChartPoints([0, 0, 0, 0]);
      assert.equal(zeroPts.length, 4);
      for (const p of zeroPts) {
        assert.ok(!Number.isNaN(p.x));
        assert.ok(!Number.isNaN(p.y));
      }

      // Massive counts (millions)
      const bigPts = buildChartPoints([1_000_000, 5_000_000, 2_000_000]);
      assert.equal(bigPts.length, 3);
      const lineD = smoothLinePath(bigPts);
      assert.match(lineD, /^M /);
      assert.match(lineD, / C /);

      // Negative values clamped
      const negPts = buildChartPoints([-10, -5, -20]);
      assert.equal(negPts.length, 3);
      for (const p of negPts) {
        assert.ok(p.y >= 0);
      }
    });

    it("verifies fitExtremesScale and sparklineScaleFloor mathematical guarantees", () => {
      // Identical counts
      const flatScale = fitExtremesScale([10, 10, 10]);
      assert.equal(flatScale.minCount, 9);
      assert.equal(flatScale.maxCount, 11);

      // Empty counts
      assert.deepEqual(fitExtremesScale([]), { minCount: 0, maxCount: 1 });
      assert.deepEqual(sparklineScaleFloor([]), { minCount: 0, maxCount: 1 });

      // Tight cluster high: spread / max < 0.55 lifts floor
      const clustered = [90, 95, 92, 98, 94];
      const floorScale = sparklineScaleFloor(clustered);
      assert.ok(floorScale.minCount > 0, "Lifts minimum count above zero for mild wiggles");

      // Wide swing: keeps floor at zero
      const swinging = [10, 100, 25, 80];
      const zeroScale = sparklineScaleFloor(swinging);
      assert.equal(zeroScale.minCount, 0);
    });

    it("evaluates maxPathY with cubic Bezier sampling", () => {
      const path = "M 0 10 C 20 0, 40 50, 60 20";
      const maxY = maxPathY(path, 10);
      assert.ok(maxY >= 20, "Detects highest Y on spline");

      assert.equal(maxPathY("", 42), 42);
      assert.equal(maxPathY("invalid path", 99), 99);
    });

    it("renders OccurrenceLineChart with empty series and fitExtremes without throwing", () => {
      const emptyHtml = renderToStaticMarkup(
        React.createElement(OccurrenceLineChart, {
          series: [],
          fitExtremes: true,
          emphasizeVariation: true,
        }),
      );
      assert.match(emptyHtml, /data-slot="occurrence-line-chart"/);
      assert.match(emptyHtml, /<svg/);

      // Non-interactive
      const nonInteractiveHtml = renderToStaticMarkup(
        React.createElement(OccurrenceLineChart, {
          series: [1, 5, 2, 8, 4],
          interactive: false,
        }),
      );
      assert.doesNotMatch(nonInteractiveHtml, /cursor-crosshair/);
    });

    it("renders IssueOccurrences across all 3 modes (table, list, detail) with empty and populated events", () => {
      // Empty events table
      const emptyTableHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "table",
          issue: baselineIssue,
          events: [],
          onSelectEvent: () => {},
        }),
      );
      assert.match(emptyTableHtml, /No stored occurrences/);

      // Empty events list
      const emptyListHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "list",
          issue: baselineIssue,
          events: [],
          onSelectEvent: () => {},
        }),
      );
      assert.match(emptyListHtml, /Occurrence details not available/);

      // Populated detail mode
      const detailHtml = renderToStaticMarkup(
        React.createElement(IssueOccurrences, {
          mode: "detail",
          issue: baselineIssue,
          events: [baselineEvent],
          selectedEventId: baselineEvent.id,
          onSelectEvent: () => {},
        }),
      );
      assert.match(detailHtml, /data-slot="issue-occurrences"/);
      assert.match(detailHtml, /data-mode="detail"/);
      assert.match(detailHtml, /Event evt_stre/);
      assert.match(detailHtml, /stress\.user@example\.com/);
      assert.match(detailHtml, /node@22\.2\.0/);
    });

    it("renders IssueOccurrenceTimeline with all duration intervals", () => {
      const html = renderToStaticMarkup(
        React.createElement(IssueOccurrenceTimeline, {
          series: [10, 20, 30, 40],
          range: "7d",
        }),
      );
      assert.match(html, /data-slot="issue-occurrence-timeline"/);
      assert.match(html, /24h/);
      assert.match(html, /7d/);
      assert.match(html, /14d/);
      assert.match(html, /30d/);
    });

    it("renders IssueImpactStrip and IssueContextFields with fallback badges", () => {
      const stripHtml = renderToStaticMarkup(
        React.createElement(IssueImpactStrip, {
          issue: baselineIssue,
        }),
      );
      assert.match(stripHtml, /data-slot="issue-impact-strip"/);
      assert.match(stripHtml, /5\.2k/);
      assert.match(stripHtml, /312/);

      const fieldsHtml = renderToStaticMarkup(
        React.createElement(IssueContextFields, {
          issue: baselineIssue,
          event: baselineEvent,
          tags: ["node@22.2.0", "prod-cluster-1"],
        }),
      );
      assert.match(fieldsHtml, /production/);
      assert.match(fieldsHtml, /v3\.1\.0/);
      assert.match(fieldsHtml, /stress\.user@example\.com/);
      assert.match(fieldsHtml, /node@22\.2\.0/);
      assert.match(fieldsHtml, /prod-cluster-1/);
    });
  });

  // =========================================================================
  // Section 4: Domain Panels & Setup Blocks
  // =========================================================================
  describe("Section 4: Domain Panels & Setup Blocks Boundary Stress", () => {
    it("processes stack traces in StackTracePanel with 0 frames, vendor frames, and culprit detection", () => {
      // 0 frames
      const emptyHtml = renderToStaticMarkup(
        React.createElement(StackTracePanel, { frames: [] }),
      );
      assert.match(emptyHtml, /No stack frames captured for this occurrence\./);

      // Culprit index resolution
      const frames = baselineEvent.stack_frames!;
      assert.equal(findCulpritIndex(frames), 0);
      assert.equal(findCulpritIndex([]), null);

      // Raw stack parse
      const raw = `Error: Cannot load config\n    at loadConfig (/app/dist/index.js:50:12)\n    at main (/app/dist/index.js:10:5)`;
      const parsed = parseRawStackTrace(raw);
      assert.equal(parsed.length, 2);
      assert.equal(parsed[0].function, "loadConfig");
      assert.equal(parsed[0].lineno, 50);

      // Vendor run collapsing
      const vendorFrames = [
        { filename: "node_modules/a.js", in_app: false },
        { filename: "node_modules/b.js", in_app: false },
        { filename: "src/app.ts", in_app: true },
      ];
      const collapsed = collapseVendorRuns(vendorFrames);
      assert.equal(collapsed.length, 2);
      assert.equal(collapsed[0].type, "vendor-run");
      assert.equal(collapsed[1].type, "frame");
    });

    it("renders IssueDetailTabs with folder tabs and triage actions", () => {
      const html = renderToStaticMarkup(
        React.createElement(IssueDetailTabs, {
          issue: baselineIssue,
          activeTab: "breadcrumbs",
          onTabChange: () => {},
          actions: React.createElement("button", null, "Snooze"),
        }),
      );
      assert.match(html, /data-slot="issue-detail-tabs"/);
      assert.match(html, /Context/);
      assert.match(html, /Stack trace/);
      assert.match(html, /Breadcrumbs/);
      assert.match(html, /Snooze/);
    });

    it("renders IssueDetailOverlay sliding drawer with SSR fallback", () => {
      // Open
      const openHtml = renderToStaticMarkup(
        React.createElement(
          IssueDetailOverlay,
          {
            isOpen: true,
            title: "Inspect Frame #42",
          },
          React.createElement("p", null, "Frame details"),
        ),
      );
      assert.match(openHtml, /data-slot="issue-detail-overlay"/);
      assert.match(openHtml, /Inspect Frame #42/);
      assert.match(openHtml, /Frame details/);

      // Closed
      const closedHtml = renderToStaticMarkup(
        React.createElement(
          IssueDetailOverlay,
          {
            isOpen: false,
          },
          React.createElement("p", null, "Should not render"),
        ),
      );
      assert.equal(closedHtml, "");
    });

    it("renders IssueOverviewPanel, IssueMorePanel, and MorePanel with fallback props", () => {
      const eventWithHttp: EventDetail = {
        ...baselineEvent,
        payload_json: {
          ...baselineEvent.payload_json,
          request: {
            method: "POST",
            url: "https://example.com/cart/checkout",
          },
        },
      };

      const overviewHtml = renderToStaticMarkup(
        React.createElement(IssueOverviewPanel, {
          issue: baselineIssue,
          event: eventWithHttp,
          events: [eventWithHttp],
        }),
      );
      assert.match(overviewHtml, /data-slot="issue-overview-panel"/);
      assert.match(overviewHtml, /POST/);
      assert.match(overviewHtml, /\/cart\/checkout/);
      assert.match(overviewHtml, /stress\.user@example\.com/);

      const moreHtml = renderToStaticMarkup(
        React.createElement(IssueMorePanel, {
          issue: baselineIssue,
          events: [baselineEvent],
        }),
      );
      assert.match(moreHtml, /data-slot="issue-more-panel"/);
      assert.match(moreHtml, /fp_test_99/);

      const panelHtml = renderToStaticMarkup(
        React.createElement(MorePanel, null, React.createElement("span", null, "Inner Box")),
      );
      assert.match(panelHtml, /data-slot="more-panel"/);
      assert.match(panelHtml, /Inner Box/);
    });

    it("renders SetupConnectPanel and DualSendingCard with multiple languages and malformed DSN", () => {
      // Malformed DSN in SetupConnectPanel
      const setupHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(SetupConnectPanel, {
            dsn: "invalid-dsn-string",
            defaultPlatform: "nextjs",
          }),
        ),
      );
      assert.match(setupHtml, /data-slot="setup-connect-panel"/);
      assert.match(setupHtml, /@sentry\/nextjs/);

      // Python platform in SetupConnectPanel
      const pythonSetupHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(SetupConnectPanel, {
            dsn: "https://key123@epure.io/42",
            defaultPlatform: "python",
          }),
        ),
      );
      assert.match(pythonSetupHtml, /data-slot="setup-connect-panel"/);
      assert.match(pythonSetupHtml, /sentry-sdk/);

      // DualSendingCard with Next.js, Node, Browser, and Python
      const dualHtml = renderToStaticMarkup(
        React.createElement(DualSendingCard, {
          epureDsn: "https://myPublicKey@ingest.epure.sh/77",
          sentryDsn: "https://sentryKey@o1.ingest.sentry.io/88",
        }),
      );
      assert.match(dualHtml, /data-slot="dual-sending-card"/);
      assert.match(dualHtml, /Zero-Risk Migration: 6-Line Dual-Sending Tee/);
      assert.match(dualHtml, /sentry\.io\/88/);
      assert.match(dualHtml, /ingest\.epure\.sh\/api\/77\/envelope\/\?sentry_key=myPublicKey/);

      // SetupChecklist and SetupWaitingPanel
      const checklistHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(SetupChecklist, {
            steps: [
              { id: "step_1", title: "Add package", status: "completed" },
              { id: "step_2", title: "Send event", status: "current" },
            ],
          }),
        ),
      );
      assert.match(checklistHtml, /data-slot="setup-checklist"/);
      assert.match(checklistHtml, /Add package/);
      assert.match(checklistHtml, /Send event/);

      const waitingHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(SetupWaitingPanel, {
            projectId: "proj_checkout",
            environment: "production",
            onEnvironmentSync: () => {},
          }),
        ),
      );
      assert.match(waitingHtml, /You&#x27;re wired\./);
      assert.match(waitingHtml, /Break something\. We&#x27;re listening\./);
    });
  });

  // =========================================================================
  // Section 5: Filter & Error Boundaries
  // =========================================================================
  describe("Section 5: Filter & Error Boundaries Stress", () => {
    it("renders FilterPanel with preset chips and custom query", () => {
      const html = renderToStaticMarkup(
        React.createElement(FilterPanel, {
          query: "is:unresolved",
          onQueryChange: () => {},
          open: true,
          onOpenChange: () => {},
        }),
      );
      assert.match(html, /data-slot="filter-panel"/);
      assert.match(html, /Filter/);
      assert.match(html, /Unresolved/);
    });

    it("renders RouteErrorBoundary with healthy child vs fallback UI on error state", () => {
      // Healthy child
      const healthyHtml = renderToStaticMarkup(
        React.createElement(
          RouteErrorBoundary,
          { title: "Dashboard Crashed", backHref: "/dashboard" },
          React.createElement("div", { id: "nominal-content" }, "All services operating normally"),
        ),
      );
      assert.match(healthyHtml, /id="nominal-content"/);
      assert.match(healthyHtml, /All services operating normally/);
      assert.doesNotMatch(healthyHtml, /Dashboard Crashed/);
    });
  });
});
