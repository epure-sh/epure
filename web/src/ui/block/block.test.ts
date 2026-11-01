// web/src/ui/block/block.test.ts
// Comprehensive unit, contract, and integration tests for Milestone 3:
// Tier 3: Block Tier & Multi-Component View Sections in web/src/ui/block/**

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// Mock localStorage and sessionStorage for test environment
const mockStorage = new Map<string, string>();
const storageShim = {
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
  // Group 1: Feed & Row
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

  // Group 2: Navigation & Shell
  SettingsNav,
  PROJECT_SETTINGS_ITEMS,
  WORKSPACE_SETTINGS_ITEMS,
  isSettingsTabActive,
  isProjectSettingsPath,
  isWorkspaceSettingsPath,
  PageShell,
  PageChrome,
  FeedHeaderStat,
  PageHeader,
  BreadcrumbTimeline,

  // Group 3: Occurrences & Telemetry
  OccurrenceLineChart,
  buildChartPoints,
  smoothLinePath,
  areaPath,
  fitExtremesScale,
  IssueOccurrences,
  IssueRecentOccurrences,
  IssueOccurrenceTimeline,
  IssueImpactStrip,
  IssueContextSnapshot,

  // Group 4: Domain Panels & Setup
  StackTracePanel,
  collapseVendorRuns,
  findCulpritIndex,
  parseRawStackTrace,
  IssueDetailTabs,
  IssueDetailOverlay,
  IssueOverviewPanel,
  IssueMorePanel,
  SetupConnectPanel,
  SetupChecklist,
  DualSendingCard,

  // Group 5: Filtering & Error Boundaries
  FilterPanel,
  RouteErrorBoundary,
} from "./index";

import type { EventDetail, IssueSummary } from "../../lib/api";

const mockIssue: IssueSummary = {
  id: "issue_123",
  org_id: "org_1",
  project_id: "proj_billing",
  fingerprint: "fp_123",
  title: "TypeError: Cannot read properties of undefined",
  culprit: "src/billing/checkout.ts in processPayment",
  status: "unresolved",
  level: "error",
  event_count: 1420,
  unique_user_count: 85,
  first_seen_at: "2026-10-15T10:00:00Z",
  last_seen_at: "2026-10-31T12:00:00Z",
  snoozed: false,
  snooze_until: null,
  snooze_until_count: null,
  snooze_until_users: null,
  resolved_in_release: null,
  environment: "production",
  release: "v2.4.1",
};

const mockEvent: EventDetail = {
  id: "evt_999",
  issue_id: "issue_123",
  occurred_at: "2026-10-31T12:00:00Z",
  timestamp: "2026-10-31T12:00:00Z",
  received_at: "2026-10-31T12:00:01Z",
  event_type: "error",
  level: "error",
  environment: "production",
  release: "v2.4.1",
  server_name: "prod-web-01",
  user_id: "usr_42",
  user_email: "alice@example.com",
  user_ip: "192.168.1.1",
  runtime_name: "node",
  runtime_version: "20.12.0",
  os_name: "Linux",
  browser_name: "Chrome",
  browser_version: "124.0.0",
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
    breadcrumbs: [
      {
        timestamp: 1730376000,
        category: "navigation",
        message: "Navigated to /checkout",
      },
      {
        timestamp: 1730376005,
        category: "fetch",
        message: "POST /api/payment 500 Internal Error",
        level: "error",
      },
    ],
    exception: {
      values: [
        {
          type: "TypeError",
          value: "Cannot read properties of undefined (reading 'cartId')",
        },
      ],
    },
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
};

// ===========================================================================
// Group 1: Feed & Row Blocks Tests
// ===========================================================================
describe("Group 1: Feed & Row Blocks", () => {
  it("renders IssueFeedRow variant='grid' with exact classes and slots", () => {
    const html = renderToStaticMarkup(
      React.createElement(IssueFeedRow, {
        variant: "grid",
        issue: mockIssue,
        unread: true,
        eventsCount: 1420,
        usersCount: 85,
        timeAgo: "2m ago",
        age: "16d",
      }),
    );

    assert.match(html, /data-slot="issue-feed-row"/);
    assert.match(html, /data-variant="grid"/);
    assert.match(html, /TypeError: Cannot read properties of undefined/);
    assert.match(html, /src\/billing\/checkout\.ts/);
    assert.match(html, /1\.4k/);
    assert.match(html, /85/);
    assert.match(html, /data-slot="unread-rail"/);
    assert.ok(html.includes(ISSUE_ROW_GRID));
    assert.ok(html.includes(ISSUE_FEED_ROW_HEIGHT_CLASS));
  });

  it("renders IssueFeedRow variant='compact' dense view", () => {
    const html = renderToStaticMarkup(
      React.createElement(IssueFeedRow, {
        variant: "compact",
        title: "Database connection failed",
        culprit: "lib/db.ts:42",
        eventsCount: 50,
        timeAgo: "5m ago",
      }),
    );

    assert.match(html, /data-slot="issue-feed-row"/);
    assert.match(html, /data-variant="compact"/);
    assert.match(html, /Database connection failed/);
    assert.match(html, /lib\/db\.ts:42/);
    assert.match(html, /50/);
  });

  it("renders IssueFeedRow variant='mobile' touch card", () => {
    const html = renderToStaticMarkup(
      React.createElement(IssueFeedRow, {
        variant: "mobile",
        title: "Mobile Crash Issue",
        culprit: "App.tsx:20",
        eventsCount: 10,
        usersCount: 3,
        unread: true,
      }),
    );

    assert.match(html, /data-slot="issue-feed-row"/);
    assert.match(html, /data-variant="mobile"/);
    assert.match(html, /Mobile Crash Issue/);
    assert.match(html, /bg-accent/);
  });

  it("renders IssueFeedRow variant='airy' card row", () => {
    const html = renderToStaticMarkup(
      React.createElement(IssueFeedRow, {
        variant: "airy",
        title: "Airy List Row Issue",
        culprit: "services/worker.ts",
        eventsCount: 99,
        trendSeries: [1, 2, 5, 8, 4],
      }),
    );

    assert.match(html, /data-slot="issue-feed-row"/);
    assert.match(html, /data-variant="airy"/);
    assert.match(html, /Airy List Row Issue/);
  });

  it("renders backwards compatibility wrappers IssueRowShell and IssueRow", () => {
    const shellHtml = renderToStaticMarkup(
      React.createElement(IssueRowShell, {
        id: "issue_1",
        title: "Compatibility Shell Row",
        subtitle: "src/index.ts",
        eventsCount: "123",
        usersCount: "45",
        timeAgo: "1m ago",
        age: "1d",
      }),
    );
    assert.match(shellHtml, /data-slot="issue-row-shell"/);
    assert.match(shellHtml, /Compatibility Shell Row/);
    assert.match(shellHtml, /src\/index\.ts/);

    const rowHtml = renderToStaticMarkup(
      React.createElement(IssueRow, {
        title: "Legacy IssueRow Button",
        culprit: "handlers/error.ts",
        unread: true,
      }),
    );
    assert.match(rowHtml, /Legacy IssueRow Button/);
    assert.match(rowHtml, /handlers\/error\.ts/);
  });

  it("renders FeedListBody and StackedCardList shells", () => {
    const bodyHtml = renderToStaticMarkup(
      React.createElement(
        FeedListBody,
        null,
        React.createElement("div", null, "Feed Content"),
      ),
    );
    assert.match(bodyHtml, /epure-feed-list-body/);
    assert.match(bodyHtml, /Feed Content/);

    const listHtml = renderToStaticMarkup(
      React.createElement(
        StackedCardList,
        null,
        React.createElement("li", null, "Card 1"),
      ),
    );
    assert.match(listHtml, /epure-stacked-card-list/);
    assert.match(listHtml, /Card 1/);
  });

  it("renders CardRowSkeleton and IssueRowSkeleton with FeedSkeletonList", () => {
    const cardHtml = renderToStaticMarkup(React.createElement(CardRowSkeleton));
    assert.match(cardHtml, /epure-card-row-skeleton/);

    const issueHtml = renderToStaticMarkup(React.createElement(IssueRowSkeleton));
    assert.match(issueHtml, /epure-issue-row-skeleton/);

    const listHtml = renderToStaticMarkup(
      React.createElement(FeedSkeletonList, { count: 3, variant: "card" }),
    );
    assert.match(listHtml, /epure-card-row-skeleton/);

    const gridListHtml = renderToStaticMarkup(
      React.createElement(FeedSkeletonList, { count: 2, variant: "grid" }),
    );
    assert.match(gridListHtml, /epure-issue-row-skeleton/);
  });
});

// ===========================================================================
// Group 2: Navigation & Shell Blocks Tests
// ===========================================================================
describe("Group 2: Navigation & Shell Blocks", () => {
  it("renders SettingsNav for project settings with all navigation links", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/projects/epure-core/settings/general"] },
        React.createElement(SettingsNav, {
          type: "project",
          currentPath: "/projects/epure-core/settings/general",
        }),
      ),
    );

    assert.match(html, /data-slot="settings-nav"/);
    assert.match(html, /data-settings-type="project"/);
    assert.match(html, /General/);
    assert.match(html, /Privacy/);
    assert.match(html, /Client Keys/);
    assert.match(html, /Filters/);
  });

  it("renders SettingsNav for workspace settings in horizontal layout", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/settings/security"] },
        React.createElement(SettingsNav, {
          type: "workspace",
          layout: "horizontal",
          currentPath: "/settings/security",
        }),
      ),
    );

    assert.match(html, /data-slot="settings-nav"/);
    assert.match(html, /data-layout="horizontal"/);
    assert.match(html, /General/);
    assert.match(html, /Security/);
    assert.match(html, /Agent tokens/);
  });

  it("verifies isSettingsTabActive and path matching helpers", () => {
    assert.equal(
      isSettingsTabActive("/settings/security", "/settings/security"),
      true,
    );
    assert.equal(
      isSettingsTabActive("/projects/proj/settings/general", "/projects/proj/settings"),
      true,
    );
    assert.equal(isProjectSettingsPath("/projects/p1/settings/rules"), true);
    assert.equal(isProjectSettingsPath("/settings/billing"), false);
    assert.equal(isWorkspaceSettingsPath("/settings/billing"), true);
    assert.equal(isWorkspaceSettingsPath("/projects/p1/settings"), false);
  });

  it("renders PageShell with compound Header and Body", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        PageShell,
        { density: "standard" },
        React.createElement(
          PageShell.Header,
          { leadingActions: React.createElement("span", null, "Title") },
          React.createElement("button", null, "Action"),
        ),
        React.createElement(
          PageShell.Body,
          null,
          React.createElement("p", null, "Body Content"),
        ),
      ),
    );

    assert.match(html, /data-slot="page-shell"/);
    assert.match(html, /data-slot="page-shell-header"/);
    assert.match(html, /data-slot="feed-list-body"/);
    assert.match(html, /Body Content/);
  });

  it("renders PageChrome in standard, feed, and toolbar variants", () => {
    const feedHtml = renderToStaticMarkup(
      React.createElement(PageChrome, {
        variant: "feed",
        title: "All Issues",
        stats: React.createElement(
          React.Fragment,
          null,
          React.createElement(FeedHeaderStat, { label: "Open", value: 124 }),
          React.createElement(FeedHeaderStat, { label: "Critical", value: 12 }),
        ),
      }),
    );
    assert.match(feedHtml, /data-slot="page-chrome"/);
    assert.match(feedHtml, /124/);
    assert.match(feedHtml, /Open/);

    const headerHtml = renderToStaticMarkup(
      React.createElement(PageHeader, {
        title: "Settings",
        subtitle: "Manage your project configuration",
      }),
    );
    assert.match(headerHtml, /Settings/);
    assert.match(headerHtml, /Manage your project configuration/);
  });

  it("renders BreadcrumbTimeline with category badges and timestamps", () => {
    const html = renderToStaticMarkup(
      React.createElement(BreadcrumbTimeline, {
        events: [mockEvent],
        selectedEventId: mockEvent.id,
      }),
    );

    assert.match(html, /data-slot="breadcrumb-timeline"/);
    assert.match(html, /Navigated to \/checkout/);
    assert.match(html, /POST \/api\/payment 500/);
    assert.match(html, /navigation/);
    assert.match(html, /HTTP/);
  });
});

// ===========================================================================
// Group 3: Occurrences & Telemetry Blocks Tests
// ===========================================================================
describe("Group 3: Occurrences & Telemetry Blocks", () => {
  it("calculates smooth cubic curves in occurrence-line-chart-path", () => {
    const series = [10, 20, 5, 40, 15];
    const points = buildChartPoints(series, 100, 40);
    assert.equal(points.length, 5);

    const lineD = smoothLinePath(points);
    assert.match(lineD, /^M /);
    assert.match(lineD, / C /);

    const areaD = areaPath(points, 40);
    assert.match(areaD, / Z$/);

    const extremes = fitExtremesScale([0, 100]);
    assert.ok(extremes.maxCount >= 100);
  });

  it("renders OccurrenceLineChart with SVG elements", () => {
    const html = renderToStaticMarkup(
      React.createElement(OccurrenceLineChart, {
        series: [2, 8, 14, 5, 22, 18],
        height: 60,
      }),
    );

    assert.match(html, /data-slot="occurrence-line-chart"/);
    assert.match(html, /<svg/);
    assert.match(html, /<path/);
    assert.match(html, /<linearGradient/);
  });

  it("renders IssueOccurrences in table, list, and detail modes", () => {
    const tableHtml = renderToStaticMarkup(
      React.createElement(IssueOccurrences, {
        mode: "table",
        issue: mockIssue,
        events: [mockEvent],
        total: 1,
        selectedEventId: "evt_999",
        onSelectEvent: () => {},
      }),
    );
    assert.match(tableHtml, /data-slot="issue-occurrences"/);
    assert.match(tableHtml, /data-mode="table"/);
    assert.match(tableHtml, /alice@example\.com/);
    assert.match(tableHtml, /production/);

    const listHtml = renderToStaticMarkup(
      React.createElement(IssueRecentOccurrences, {
        issue: mockIssue,
        events: [mockEvent],
        selectedEventId: "evt_999",
        onSelectEvent: () => {},
      }),
    );
    assert.match(listHtml, /data-mode="list"/);
  });

  it("renders IssueOccurrenceTimeline with range selector buttons", () => {
    const html = renderToStaticMarkup(
      React.createElement(IssueOccurrenceTimeline, {
        series: [1, 3, 7, 12, 5],
        range: "24h",
      }),
    );

    assert.match(html, /data-slot="issue-occurrence-timeline"/);
    assert.match(html, /24h/);
    assert.match(html, /7d/);
    assert.match(html, /14d/);
    assert.match(html, /30d/);
  });

  it("renders IssueImpactStrip and IssueContextSnapshot", () => {
    const stripHtml = renderToStaticMarkup(
      React.createElement(IssueImpactStrip, {
        issue: mockIssue,
      }),
    );
    assert.match(stripHtml, /data-slot="issue-impact-strip"/);
    assert.match(stripHtml, /Events/);
    assert.match(stripHtml, /Users/);

    const snapshotHtml = renderToStaticMarkup(
      React.createElement(IssueContextSnapshot, {
        issue: mockIssue,
        event: mockEvent,
      }),
    );
    assert.match(snapshotHtml, /data-slot="issue-context-snapshot"/);
    assert.match(snapshotHtml, /production/);
    assert.match(snapshotHtml, /v2\.4\.1/);
  });
});

// ===========================================================================
// Group 4: Domain Panels & Setup Blocks Tests
// ===========================================================================
describe("Group 4: Domain Panels & Setup Blocks", () => {
  it("processes stack traces and filters in StackTracePanel", () => {
    const culpritIdx = findCulpritIndex(mockEvent.stack_frames!);
    assert.equal(culpritIdx, 0);

    const collapsed = collapseVendorRuns(mockEvent.stack_frames!);
    assert.equal(collapsed.length, 2);

    const rawStack = "Error: Boom\n  at processPayment (checkout.ts:142:12)";
    const parsed = parseRawStackTrace(rawStack);
    assert.ok(parsed.length >= 1);

    const html = renderToStaticMarkup(
      React.createElement(StackTracePanel, {
        frames: mockEvent.stack_frames!,
        culprit: mockIssue.culprit,
      }),
    );
    assert.match(html, /data-slot="stack-trace-panel"/);
    assert.match(html, /processPayment/);
    assert.match(html, /const cartId = session\.cart\.cartId;/);
  });

  it("renders IssueDetailTabs with folder navigation and triage actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(IssueDetailTabs, {
        issue: mockIssue,
        activeTab: "overview",
        onTabChange: () => {},
        actions: React.createElement("button", null, "Resolve"),
      }),
    );

    assert.match(html, /data-slot="issue-detail-tabs"/);
    assert.match(html, /Context/);
    assert.match(html, /Stack trace/);
    assert.match(html, /Breadcrumbs/);
    assert.match(html, /Resolve/);
  });

  it("renders IssueDetailOverlay sliding drawer", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        IssueDetailOverlay,
        {
          isOpen: true,
          onClose: () => {},
          title: "Detailed Inspection",
        },
        React.createElement("div", null, "Overlay Content"),
      ),
    );

    assert.match(html, /data-slot="issue-detail-overlay"/);
    assert.match(html, /Detailed Inspection/);
    assert.match(html, /Overlay Content/);
  });

  it("renders IssueOverviewPanel with occurrence cards and AI copilot", () => {
    const html = renderToStaticMarkup(
      React.createElement(IssueOverviewPanel, {
        issue: mockIssue,
        event: mockEvent,
        events: [mockEvent],
      }),
    );

    assert.match(html, /data-slot="issue-overview-panel"/);
    assert.match(html, /POST \/api\/v1\/checkout/);
    assert.match(html, /production/);
    assert.match(html, /v2\.4\.1/);
    assert.match(html, /alice@example\.com/);
  });

  it("renders IssueMorePanel with fingerprint and split actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(IssueMorePanel, {
        issue: mockIssue,
        events: [mockEvent],
      }),
    );

    assert.match(html, /data-slot="issue-more-panel"/);
    assert.match(html, /Grouping/);
    assert.match(html, /Fingerprint/);
    assert.match(html, /fp_123/);
  });

  it("renders SetupConnectPanel, SetupChecklist, and DualSendingCard", () => {
    const setupHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(SetupConnectPanel, {
          dsn: "https://key@epure.example.com/1",
          defaultPlatform: "nextjs",
        }),
      ),
    );
    assert.match(setupHtml, /data-slot="setup-connect-panel"/);
    assert.match(setupHtml, /@sentry\/nextjs/);
    assert.match(setupHtml, /epure\.example\.com/);

    const checklistHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(SetupChecklist, {
          steps: [
            { id: "1", title: "Install SDK", status: "completed" },
            { id: "2", title: "Dual-send traffic", status: "current" },
          ],
        }),
      ),
    );
    assert.match(checklistHtml, /data-slot="setup-checklist"/);
    assert.match(checklistHtml, /Install SDK/);

    const dualSendingHtml = renderToStaticMarkup(
      React.createElement(DualSendingCard, {
        epureDsn: "https://key@epure.example.com/1",
        sentryDsn: "https://sentryKey@o123.ingest.sentry.io/456",
      }),
    );
    assert.match(dualSendingHtml, /data-slot="dual-sending-card"/);
    assert.match(dualSendingHtml, /Dual-Sending Tee/);
    assert.match(dualSendingHtml, /sentry\.io/);
  });
});

// ===========================================================================
// Group 5: Filtering & Error Boundaries Tests
// ===========================================================================
describe("Group 5: Filtering & Error Boundaries", () => {
  it("renders FilterPanel with search input and preset buttons", () => {
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

  it("renders RouteErrorBoundary without error for healthy children", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        RouteErrorBoundary,
        { title: "View Failure" },
        React.createElement("div", { id: "child" }, "Healthy View Content"),
      ),
    );

    assert.match(html, /Healthy View Content/);
    assert.doesNotMatch(html, /View Failure/);
  });
});
