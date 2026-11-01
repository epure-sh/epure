// web/src/ui/components/components.test.ts
// Contract, integration, and behavioral test suite for Milestone 2:
// Component Tier & Variant Consolidation in web/src/ui/components/**

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import * as React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// Mock localStorage for test environment
const mockStorage = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
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
}

import {
  // Cluster 1
  CopyButton,
  ApplyWithAiButton,
  InlineCopyButton,
  // Cluster 2
  Banner,
  FairUseBanner,
  RegressionStrip,
  IssuesContextStrip,
  IssuesHomeHint,
  SetupWaitingBanner,
  TestDataBanner,
  // Cluster 3
  CodeBlock,
  SourceCodeBlock,
  CodeFrame,
  // Cluster 4
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardBody,
  CardFooter,
  CardAction,
  PolarCard,
  PolarCardHeader,
  PolarCardTitle,
  PolarCardDescription,
  PolarCardBody,
  PolarCardFooter,
  PolarCardOpenHint,
  SectionCard,
  // Cluster 5
  AiCopilotCard,
  AskAgentCard,
  IssueAiCopilotCard,
  extractCulprit,
  generateAiDiagnosis,
  // Cluster 6
  EmptyState,
  Empty,
  ErrorState,
  NotFoundState,
  ForbiddenState,
  // Tier 2 Composites
  ActionButton,
  FilterChip,
  SharedProjectBadge,
  isSharedProjectRole,
  IssuePriorityIcon,
  IssuePriorityBadge,
  resolveIssuePriority,
  getIssuePriorityLabel,
  StepIndicator,
  Sparkline,
  inferTrendStatus,
  fillSparklineWindow,
  downsampleSparkValues,
  sparklineBarCountForWindow,
  SPARKLINE_BAR_COUNT,
  StatBar,
  CopyDsnBlock,
  CopyCurlBlock,
  buildCurlFromRequest,
  SdkSnippetBlock,
  EventHttpRequest,
  parseEventHttpRequest,
  buildCurl,
  OccurrencePicker,
  SetupPlatformMark,
  SetupDocsLink,
  SetupStepSection,
  KeyboardHintsFooter,
  ListRow,
  Section,
  SectionHeader,
  ToastProvider,
  useToast,
} from "./index";
import { TooltipProvider } from "../primitives";
import type { EventDetail, IssueSummary } from "@/lib/api";

describe("Milestone 2: Component Tier & Variant Consolidation Suite", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  // =========================================================================
  // Cluster 1: Unified Copy & Action Button
  // =========================================================================
  describe("Cluster 1: CopyButton & Variants", () => {
    it("renders default copy button with text value and copy label", () => {
      const html = renderToStaticMarkup(
        React.createElement(CopyButton, { value: "export EPURE_KEY=123", label: "Copy Secret" }),
      );
      assert.match(html, /Copy Secret/);
      assert.match(html, /aria-label="Copy Secret"/);
      assert.match(html, /svg/);
    });

    it("renders AI variant with vendor avatars and default Implement with agent label", () => {
      const html = renderToStaticMarkup(
        React.createElement(CopyButton, { prompt: "Analyze memory leak", variant: "ai" }),
      );
      assert.match(html, /Implement with agent/);
      assert.match(html, /aria-label="Implement with agent, copy prompt"/);
    });

    it("renders icon-only variant with accessible aria-label", () => {
      const html = renderToStaticMarkup(
        React.createElement(CopyButton, { value: "test-token", variant: "icon-only", label: "Copy Token" }),
      );
      assert.match(html, /aria-label="Copy Token"/);
      assert.doesNotMatch(html, /<span>Copy Token<\/span>/);
    });

    it("renders inline variant for code frame headers", () => {
      const html = renderToStaticMarkup(
        React.createElement(InlineCopyButton, { value: "src/main.ts:42" }),
      );
      assert.match(html, /<button/);
      assert.match(html, /aria-label="Copy"/);
    });

    it("supports prominence='main' for prominent onboarding triggers", () => {
      const html = renderToStaticMarkup(
        React.createElement(ApplyWithAiButton, { prompt: "npm test", prominence: "main" }),
      );
      assert.match(html, /Implement with agent/);
      assert.match(html, /<button[^>]*>/);
    });
  });

  // =========================================================================
  // Cluster 2: Unified Banners & Context Strips
  // =========================================================================
  describe("Cluster 2: Banner & Context Strips", () => {
    it("renders warning callout banner with left border accent", () => {
      const html = renderToStaticMarkup(
        React.createElement(Banner, {
          tone: "warning",
          variant: "callout",
          title: "Fair Use Policy",
          description: "Monthly ingestion limit reached 80%",
        }),
      );
      assert.match(html, /Fair Use Policy/);
      assert.match(html, /Monthly ingestion limit reached 80%/);
      assert.match(html, /data-tone="warning"/);
      assert.match(html, /border-l-semantic-warning/);
    });

    it("renders danger strip banner with action button", () => {
      const html = renderToStaticMarkup(
        React.createElement(RegressionStrip, {
          count: 3,
          onViewRegressions: () => {},
        }),
      );
      assert.match(html, /3 exceptions came back after you resolved them\./);
      assert.match(html, /Show came back/);
      assert.match(html, /data-tone="danger"/);
    });

    it("returns null when RegressionStrip count is zero or negative", () => {
      const html = renderToStaticMarkup(
        React.createElement(RegressionStrip, {
          count: 0,
          onViewRegressions: () => {},
        }),
      );
      assert.equal(html, "");
    });

    it("persists dismissal state via dismissStorageKey", () => {
      const key = "epure.dismiss.test-banner";
      mockStorage.set(key, "1");

      const html = renderToStaticMarkup(
        React.createElement(Banner, {
          dismissStorageKey: key,
          title: "Dismissible Notice",
        }),
      );
      assert.equal(html, "", "Banner should not render when dismissStorageKey is flagged 1 in localStorage");
    });

    it("renders FairUseBanner backwards compatibility wrapper", () => {
      const html = renderToStaticMarkup(
        React.createElement(FairUseBanner, { message: "Fair use warning notice" }),
      );
      assert.match(html, /Fair use warning notice/);
      assert.match(html, /epure-fair-use-banner/);
    });

    it("renders SetupWaitingBanner and TestDataBanner with project links", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(SetupWaitingBanner, { projectId: "proj_123" }),
        ),
      );
      assert.match(html, /No errors received yet/);
      assert.match(html, /quickstart/);
      assert.match(html, /href="\/p\/proj_123\/setup"/);
    });
  });

  // =========================================================================
  // Cluster 3: Unified Code Block & Frame
  // =========================================================================
  describe("Cluster 3: CodeBlock & Syntax Frames", () => {
    it("renders line-numbered code block with fault line highlighting", () => {
      const lines = [
        { number: 10, text: "const x = fetchUser();" },
        { number: 11, text: "x.profile.name = 'Alex';", fault: true },
        { number: 12, text: "return x;" },
      ];

      const html = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          variant: "lines",
          lines,
          filename: "src/service.ts",
          functionName: "updateUser",
          lineno: 11,
          copyValue: "src/service.ts:11 in updateUser",
        }),
      );

      assert.match(html, /src\/service\.ts:11 in updateUser/);
      assert.match(html, /const x = fetchUser\(\);/);
      assert.match(html, /x\.profile\.name = &#x27;Alex&#x27;;/);
      assert.match(html, /text-semantic-danger/);
    });

    it("renders snippet variant cleanly without line gutters", () => {
      const html = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          variant: "snippet",
          code: "npm install @epure/sdk",
        }),
      );
      assert.match(html, /epure-code-snippet/);
      assert.match(html, /npm install @epure\/sdk/);
    });

    it("renders syntax variant with frame header and language pill", () => {
      const html = renderToStaticMarkup(
        React.createElement(CodeBlock, {
          variant: "syntax",
          code: "console.log('Hello Epure');",
          language: "typescript",
          filename: "index.ts",
        }),
      );
      assert.match(html, /data-slot="code-frame"/);
      assert.match(html, /index\.ts/);
      assert.match(html, /typescript/);
      assert.match(html, /Hello Epure/);
    });

    it("supports SourceCodeBlock and CodeFrame aliases", () => {
      const sourceHtml = renderToStaticMarkup(
        React.createElement(SourceCodeBlock, {
          filename: "app.ts",
          lines: [{ number: 1, text: "const a = 1;" }],
        }),
      );
      assert.match(sourceHtml, /app\.ts/);

      const frameHtml = renderToStaticMarkup(
        React.createElement(CodeFrame, {
          code: "const b = 2;",
          language: "javascript",
        }),
      );
      assert.match(frameHtml, /javascript/);
    });
  });

  // =========================================================================
  // Cluster 4: Unified Card System
  // =========================================================================
  describe("Cluster 4: Card System & PolarCard Aliases", () => {
    it("renders standard card with subcomponents", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Card,
          { variant: "default", padding: "m" },
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Card Title")),
          React.createElement(CardContent, null, "Card body content"),
          React.createElement(CardFooter, null, "Card footer"),
        ),
      );
      assert.match(html, /data-slot="card"/);
      assert.match(html, /Card Title/);
      assert.match(html, /Card body content/);
      assert.match(html, /Card footer/);
    });

    it("renders interactive card with hover lift attributes", () => {
      const html = renderToStaticMarkup(
        React.createElement(Card, { variant: "interactive" }, "Interactive Card"),
      );
      assert.match(html, /data-interactive="true"/);
      assert.match(html, /data-variant="interactive"/);
    });

    it("wraps card in react-router Link when 'to' prop is provided", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(Card, { to: "/issues/123" }, "Linked Card"),
        ),
      );
      assert.match(html, /data-slot="polar-card-link"/);
      assert.match(html, /href="\/issues\/123"/);
      assert.match(html, /Linked Card/);
    });

    it("renders PolarCard and SectionCard backward compatible components", () => {
      const polarHtml = renderToStaticMarkup(
        React.createElement(
          PolarCard,
          { padding: "xl", selected: true },
          React.createElement(PolarCardTitle, null, "Polar Title"),
          React.createElement(PolarCardDescription, null, "Polar Desc"),
        ),
      );
      assert.match(polarHtml, /Polar Title/);
      assert.match(polarHtml, /data-variant="selected"/);

      const sectionHtml = renderToStaticMarkup(
        React.createElement(
          SectionCard,
          { title: "Section Header", flush: true },
          React.createElement("div", null, "Chart Container"),
        ),
      );
      assert.match(sectionHtml, /Section Header/);
      assert.match(sectionHtml, /Chart Container/);
    });
  });

  // =========================================================================
  // Cluster 5: Unified AI Copilot Diagnostic Card
  // =========================================================================
  describe("Cluster 5: AiCopilotCard & Heuristic Engine", () => {
    const dummyIssue: IssueSummary = {
      id: "iss_456",
      short_id: "EP-456",
      project_id: "proj_1",
      title: "TypeError: Cannot read properties of undefined (reading 'token')",
      status: "unresolved",
      level: "error",
      event_count: 142,
      user_count: 28,
      first_seen: "2026-10-30T10:00:00Z",
      last_seen: "2026-10-31T12:00:00Z",
    };

    const dummyEvent: EventDetail = {
      id: "evt_789",
      issue_id: "iss_456",
      project_id: "proj_1",
      occurred_at: "2026-10-31T12:00:00Z",
      payload_json: {
        culprit: "auth/middleware.ts:54",
      },
      stack_frames: [{ filename: "auth/middleware.ts", lineno: 54 }],
    };

    it("extracts culprit correctly from payload or stack frames", () => {
      const culprit = extractCulprit(dummyIssue, dummyEvent);
      assert.equal(culprit, "auth/middleware.ts:54");
    });

    it("generates deterministic AI diagnosis for TypeError", () => {
      const diagnosis = generateAiDiagnosis(dummyIssue, dummyEvent);
      assert.equal(diagnosis.confidence, "High");
      assert.match(diagnosis.cause, /Null or undefined reference dereferenced/);
      assert.match(diagnosis.fix, /optional chaining/);
    });

    it("generates deterministic AI diagnosis for database timeouts", () => {
      const timeoutIssue: IssueSummary = {
        ...dummyIssue,
        title: "Database connection timeout after 5000ms",
      };
      const diagnosis = generateAiDiagnosis(timeoutIssue, null);
      assert.match(diagnosis.cause, /Network or database connection timed out/);
      assert.match(diagnosis.fix, /connection pooling limits/);
    });

    it("renders diagnosis variant with culprit badge and actions", () => {
      const html = renderToStaticMarkup(
        React.createElement(AiCopilotCard, {
          variant: "diagnosis",
          issue: dummyIssue,
          event: dummyEvent,
        }),
      );
      assert.match(html, /Starting point for your AI agent/);
      assert.match(html, /auth\/middleware\.ts:54/);
      assert.match(html, /Heuristic cause:/);
      assert.match(html, /Copy for agent/);
    });

    it("renders compact variant for side panels and wizards", () => {
      const html = renderToStaticMarkup(
        React.createElement(AiCopilotCard, {
          compact: true,
          promptText: "Fix the memory leak",
        }),
      );
      assert.match(html, /data-variant="compact"/);
      assert.match(html, /Ask agent/);
    });

    it("renders prompt variant with docs URL", () => {
      const html = renderToStaticMarkup(
        React.createElement(AskAgentCard, {
          title: "Setup Agent Prompt",
          docsUrl: "https://docs.epure.ai/agents",
        }),
      );
      assert.match(html, /Setup Agent Prompt/);
      assert.match(html, /href="https:\/\/docs\.epure\.ai\/agents"/);
    });
  });

  // =========================================================================
  // Cluster 6: Unified Empty & Error State
  // =========================================================================
  describe("Cluster 6: EmptyState & Error States", () => {
    it("renders zen inbox zero status with serene pulse animation", () => {
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, { status: "zen" }),
      );
      assert.match(html, /Inbox Zero · Production is Calm/);
      assert.match(html, /Ingestion: 100% Nominal/);
      assert.match(html, /Spike Valve: Active/);
    });

    it("renders search empty status with SearchX icon", () => {
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "search",
          title: "No issues found",
          description: "Try adjusting your filters",
        }),
      );
      assert.match(html, /No issues found/);
      assert.match(html, /Try adjusting your filters/);
    });

    it("renders error state with collapsible stack trace and reload button", () => {
      const error = new Error("Gateway timeout");
      const stack = "Error: Gateway timeout\n    at proxy (gateway.ts:88)";

      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          status: "error",
          title: "Service Outage",
          error,
          stack,
          showReload: true,
        }),
      );

      assert.match(html, /Service Outage/);
      assert.match(html, /Reload page/);
      assert.match(html, /<details/);
      assert.match(html, /gateway\.ts:88/);
    });

    it("renders safe router fallback anchor outside router context", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotFoundState, {
          title: "Page Not Found",
          backHref: "/home",
          backLabel: "Return to Feed",
        }),
      );
      assert.match(html, /<a[^>]*href="\/home"[^>]*>Return to Feed<\/a>/);
    });

    it("renders ForbiddenState with access denied headline", () => {
      const html = renderToStaticMarkup(
        React.createElement(ForbiddenState, null),
      );
      assert.match(html, /Access denied/);
      assert.match(html, /You do not have permission/);
    });
  });

  // =========================================================================
  // Tier 2 Composite Components
  // =========================================================================
  describe("Tier 2 Composite Components Suite", () => {
    it("renders ActionButton with tooltip when disabled", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          TooltipProvider,
          null,
          React.createElement(
            ActionButton,
            {
              disabled: true,
              tooltip: "Action unavailable in staging",
            },
            "Deploy",
          ),
        ),
      );
      assert.match(html, /Deploy/);
      assert.match(html, /disabled/);
    });

    it("renders FilterChip in preset and query variants", () => {
      const presetHtml = renderToStaticMarkup(
        React.createElement(FilterChip, { label: "Production", active: true }),
      );
      assert.match(presetHtml, /Production/);

      const queryHtml = renderToStaticMarkup(
        React.createElement(FilterChip, {
          variant: "query",
          filterKey: "environment",
          label: "staging",
          onRemove: () => {},
        }),
      );
      assert.match(queryHtml, /environment/);
      assert.match(queryHtml, /staging/);
      assert.match(queryHtml, /Remove staging filter/);
    });

    it("detects shared project role and renders SharedProjectBadge", () => {
      assert.equal(isSharedProjectRole("member"), true);
      assert.equal(isSharedProjectRole("admin"), false);
      assert.equal(isSharedProjectRole("owner"), false);

      const html = renderToStaticMarkup(
        React.createElement(
          TooltipProvider,
          null,
          React.createElement(SharedProjectBadge, null),
        ),
      );
      assert.match(html, /Shared/);
    });

    it("resolves issue priorities and renders 4-bar priority meter", () => {
      assert.equal(resolveIssuePriority("fatal", "unresolved"), "critical");
      assert.equal(resolveIssuePriority("error", "unresolved"), "high");
      assert.equal(resolveIssuePriority("warning", "unresolved"), "medium");
      assert.equal(resolveIssuePriority("info", "unresolved"), "low");
      assert.equal(resolveIssuePriority("info", "regression"), "critical");

      assert.equal(getIssuePriorityLabel("fatal", null), "Critical");
      assert.equal(getIssuePriorityLabel("warning", null), "Medium");

      const iconHtml = renderToStaticMarkup(
        React.createElement(IssuePriorityIcon, { level: "fatal", showLabel: true }),
      );
      assert.match(iconHtml, /Critical/);
      assert.match(iconHtml, /<svg/);

      const badgeHtml = renderToStaticMarkup(
        React.createElement(IssuePriorityBadge, { level: "error" }),
      );
      assert.match(badgeHtml, /High/);
    });

    it("renders StepIndicator in pills and bar modes", () => {
      const steps = [
        { id: "s1", label: "Install SDK", complete: true },
        { id: "s2", label: "Verify DSN", active: true },
        { id: "s3", label: "Trigger Error" },
      ];

      const pillsHtml = renderToStaticMarkup(
        React.createElement(StepIndicator, { steps, variant: "pills" }),
      );
      assert.match(pillsHtml, /Install SDK/);
      assert.match(pillsHtml, /Verify DSN/);

      const barHtml = renderToStaticMarkup(
        React.createElement(StepIndicator, { steps, variant: "bar" }),
      );
      assert.match(barHtml, /role="progressbar"/);
      assert.match(barHtml, /Step 2 of 3/);
    });

    it("evaluates Sparkline trend inferencing and window bucket packing", () => {
      assert.equal(inferTrendStatus([10, 10, 10, 10, 10, 10, 10, 10]), "ongoing");
      assert.equal(inferTrendStatus([5, 5, 5, 5, 50, 50, 50, 50]), "escalating");
      assert.equal(inferTrendStatus([50, 50, 50, 50, 5, 5, 5, 5]), "declining");

      assert.equal(sparklineBarCountForWindow("24h"), SPARKLINE_BAR_COUNT);
      assert.equal(SPARKLINE_BAR_COUNT, 24);

      const buckets = [
        { start: new Date(Date.now() - 3600000).toISOString(), count: 42 },
      ];
      const filled = fillSparklineWindow(buckets, "24h");
      assert.equal(filled.length, 24);

      const downsampled = downsampleSparkValues([1, 2, 3, 4, 5, 6], undefined, 3);
      assert.equal(downsampled.values.length, 3);

      const sparkHtml = renderToStaticMarkup(
        React.createElement(Sparkline, { values: [10, 20, 30], status: "ongoing" }),
      );
      assert.match(sparkHtml, /epure-sparkline/);
      assert.match(sparkHtml, /Ongoing/);
    });

    it("renders StatBar with compact metric values", () => {
      const items = [
        { label: "Unresolved", value: 1420 },
        { label: "Regressions", value: 4 },
        { label: "Users", value: 890 },
      ];

      const html = renderToStaticMarkup(
        React.createElement(StatBar, { items, inline: true }),
      );
      assert.match(html, /1\.4k unresolved/);
      assert.match(html, /4 regressions/);
      assert.match(html, /890 users/);
    });

    it("renders CopyDsnBlock with hide/show toggle and Copy button", () => {
      const html = renderToStaticMarkup(
        React.createElement(CopyDsnBlock, { dsn: "https://key@epure.sh/1" }),
      );
      assert.match(html, /Connection string \(DSN\)/);
      assert.match(html, /data-copy-value="https:\/\/key@epure\.sh\/1"/);
      assert.match(html, /aria-label="Show Connection string \(DSN\)"/);
      assert.match(html, /•{8,}/);
    });

    it("constructs and renders CopyCurlBlock with request headers and body", () => {
      const curl = buildCurlFromRequest("https://api.epure.sh/ingest", "POST", {
        Authorization: "Bearer sec_123",
      }, { exception: "TypeError" });

      assert.match(curl, /curl -X POST "https:\/\/api\.epure\.sh\/ingest"/);
      assert.match(curl, /-H "Authorization: Bearer sec_123"/);
      assert.match(curl, /-d/);

      const html = renderToStaticMarkup(
        React.createElement(CopyCurlBlock, {
          url: "https://api.epure.sh/ingest",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
      assert.match(html, /cURL Command/);
      assert.match(html, /https:\/\/api\.epure\.sh\/ingest/);
    });

    it("renders SdkSnippetBlock platform tabs and code", () => {
      const html = renderToStaticMarkup(
        React.createElement(SdkSnippetBlock, {
          dsn: "https://key@epure.sh/1",
        }),
      );
      assert.match(html, /JavaScript/);
      assert.match(html, /Node/);
      assert.match(html, /Python/);
    });

    it("parses EventHttpRequest payload and generates curl snippet", () => {
      const event: EventDetail = {
        id: "evt_1",
        issue_id: "iss_1",
        project_id: "proj_1",
        occurred_at: "2026-10-31T12:00:00Z",
        payload_json: {
          request: {
            method: "POST",
            url: "https://my-app.com/api/checkout",
            headers: { "Content-Type": "application/json" },
            data: { cart_id: 101 },
          },
          response: {
            status_code: 500,
          },
        },
      };

      const parsed = parseEventHttpRequest(event);
      assert.notEqual(parsed, null);
      assert.equal(parsed?.method, "POST");
      assert.equal(parsed?.path, "/api/checkout");
      assert.equal(parsed?.status, 500);

      const curlCmd = buildCurl(parsed!);
      assert.match(curlCmd, /curl -X POST "https:\/\/my-app\.com\/api\/checkout"/);
      assert.match(curlCmd, /"Content-Type: application\/json"/);

      const html = renderToStaticMarkup(
        React.createElement(EventHttpRequest, { event }),
      );
      assert.match(html, /HTTP request/);
      assert.match(html, /POST/);
      assert.match(html, /500/);
    });

    it("renders OccurrencePicker menu labels and navigation stepper", () => {
      const events: EventDetail[] = [
        {
          id: "evt_1",
          issue_id: "iss_1",
          project_id: "proj_1",
          occurred_at: "2026-10-31T12:00:00Z",
          user_email: "alice@acme.com",
        },
        {
          id: "evt_2",
          issue_id: "iss_1",
          project_id: "proj_1",
          occurred_at: "2026-10-31T12:05:00Z",
          user_email: "bob@acme.com",
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(OccurrencePicker, {
          events,
          selectedEventId: "evt_1",
          onSelectEvent: () => {},
          showNav: true,
        }),
      );
      assert.match(html, /Previous occurrence/);
      assert.match(html, /Next occurrence/);
      assert.match(html, /1\/2/);
    });

    it("renders SetupPlatformMark framework icons", () => {
      const html = renderToStaticMarkup(
        React.createElement(SetupPlatformMark, { logo: "react", size: "md" }),
      );
      assert.match(html, /src="\/frameworks\/react\.svg"/);
    });

    it("renders SetupDocsLink and SetupStepSection", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          SetupStepSection,
          {
            step: 1,
            title: "Configure your DSN",
            docHref: "https://docs.epure.ai/dsn",
          },
          React.createElement("p", null, "Step body content"),
        ),
      );
      assert.match(html, /1\./);
      assert.match(html, /Configure your DSN/);
      assert.match(html, /Step body content/);
      assert.match(html, /href="https:\/\/docs\.epure\.ai\/dsn"/);
    });

    it("renders KeyboardHintsFooter shortcuts popover trigger", () => {
      const html = renderToStaticMarkup(
        React.createElement(KeyboardHintsFooter, null),
      );
      assert.match(html, /data-tour="keyboard-hints"/);
      assert.match(html, /\?/);
    });

    it("renders ListRow with polymorphic variants and accents", () => {
      const airyHtml = renderToStaticMarkup(
        React.createElement(ListRow, { variant: "airy", accent: "danger" }, "Airy Row"),
      );
      assert.match(airyHtml, /epure-list-row--airy/);
      assert.match(airyHtml, /border-l-semantic-danger/);

      const flatHtml = renderToStaticMarkup(
        React.createElement(ListRow, { variant: "flat", accent: "signal" }, "Flat Row"),
      );
      assert.match(flatHtml, /border-l-signal/);
    });

    it("renders Section and SectionHeader with marker tone dots", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Section,
          { variant: "inset" },
          React.createElement(SectionHeader, {
            title: "Live Telemetry",
            markerTone: "healthy",
            description: "Real-time exception streams",
          }),
          React.createElement("div", null, "Telemetry Chart"),
        ),
      );
      assert.match(html, /epure-overview-section/);
      assert.match(html, /Live Telemetry/);
      assert.match(html, /bg-healthy/);
      assert.match(html, /Real-time exception streams/);
    });

    it("evaluates useToast and ToastProvider safely", () => {
      function Consumer() {
        const { toast } = useToast();
        return React.createElement(
          "button",
          { onClick: () => toast("Hello toast") },
          "Trigger Toast",
        );
      }

      const html = renderToStaticMarkup(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(Consumer, null),
        ),
      );
      assert.match(html, /Trigger Toast/);
    });
  });
});
