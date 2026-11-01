import * as React from "react";
import { Button } from "@/ui/primitives";
import { setupPlatformById } from "@/lib/setup-platform-snippets";
import { ActionButton } from "@/ui/components";
import { ApplyWithAiButton } from "@/ui/components";
import { Badge } from "@/ui/primitives";
import { BreadcrumbTimeline } from "@/ui/block";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components";
import { CodeBlock } from "@/ui/components";
import { CopyButton } from "@/ui/components";
import { CopyDsnBlock } from "@/ui/components";
import { DualSendingCard } from "@/ui/block";
import { Empty } from "@/ui/components";
import { ErrorState } from "@/ui/components";
import { FairUseBanner } from "@/ui/components";
import { FeedListBody, StackedCardList } from "@/ui/block";
import { Field } from "@/ui/components";
import { Input } from "@/components/ui/input";
import { FilterChip } from "@/ui/components";
import { FilterPanel } from "@/ui/block";
import { IssueAiCopilotCard } from "@/ui/components";
import { IssueContextFields } from "@/ui/block";
import { IssueContextSnapshot } from "@/ui/block";
import { IssueDetailOverlay } from "@/ui/block";
import { IssueDetailTabs } from "@/ui/block";
import { IssueFeedRow } from "@/ui/block";
import {
  IssueImpactLine,
  IssueImpactMetrics,
  IssueOccurrenceTrend,
} from "@/ui/block";
import { IssueOccurrenceTimeline } from "@/ui/block";
import { IssueOccurrencesTable } from "@/ui/block";
import { IssueOverviewPanel } from "@/ui/block";
import { IssuePriorityBadge } from "@/ui/components";
import { IssueRecentOccurrences } from "@/ui/block";
import { IssueRow } from "@/ui/block";
import { IssuesContextStrip } from "@/ui/components";
import { IssuesHomeHint } from "@/ui/components";
import { Kbd } from "@/ui/primitives";
import { KeyboardHintsFooter } from "@/ui/components";
import { ListRow } from "@/ui/components";
import { LogoNavButton } from "@/ui/primitives";
import { MorePanel } from "@/ui/block";
import { OccurrenceLineChart } from "@/ui/block";
import { OccurrencePicker } from "@/ui/components";
import { PageChrome } from "@/ui/block";
import { PageHeader } from "@/ui/block";
import { RegressionStrip } from "@/ui/components";
import { RouteErrorBoundary } from "@/ui/block";
import { SdkSnippetBlock } from "@/ui/components";
import { Section, SectionHeader } from "@/ui/components";
import { SettingsNav } from "@/ui/block";
import { SetupChecklist } from "@/ui/block";
import { SetupConnectGuide } from "@/ui/block";
import { SetupConnectPanel } from "@/ui/block";
import { SetupDocsLink } from "@/ui/components";
import { SetupPlatformMark } from "@/ui/components";
import { SetupWaitingBanner } from "@/ui/components";
import { SetupWaitingPanel } from "@/ui/block";
import { SharedProjectBadge } from "@/ui/components";
import { SimpleFeedHeader } from "@/ui/block";
import { IssueRowSkeleton, Skeleton } from "@/ui";
import { SourceCodeBlock } from "@/ui/components";
import { Sparkline } from "@/ui/components";
import { StackTracePanel } from "@/ui/block";
import { StatBar } from "@/ui/components";
import { StepIndicator } from "@/ui/components";
import { Toast } from "@/ui/components";
import { ToastProvider } from "@/ui/components";
import { WorkspaceSettingsNav } from "@/ui/block";
import {
  DESIGN_KIT_SAMPLE_EVENT,
  DESIGN_KIT_SAMPLE_ISSUE,
} from "../../fixtures/sample-issue";
import {
  DESIGN_KIT_SAMPLE_EVENTS,
  DESIGN_KIT_SAMPLE_TAGS,
  DESIGN_KIT_SAMPLE_TIMELINE,
} from "../../fixtures/sample-issue-detail";
import type { TimelineWindowValue } from "@/ui/block";
import { PreviewBlock } from "../../shared";

const DEMO_DSN = "https://public@localhost:8080/550e8400-e29b-41d4-a716-446655440000";
const JS_PLATFORM = setupPlatformById(DEMO_DSN, "javascript")!;

function ModulePreview({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PreviewBlock id={id} title={title} description={`src/ui/${id}.tsx`}>
      {children}
    </PreviewBlock>
  );
}

function ControlsPreviews() {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <ModulePreview id="action-button" title="action-button">
        <ActionButton variant="ghost" size="sm" tooltip="Disabled with tooltip" disabled>
          Mute
        </ActionButton>
      </ModulePreview>
      <ModulePreview id="apply-with-ai-button" title="apply-with-ai-button">
        <ApplyWithAiButton prompt="Fix null check in checkout" />
      </ModulePreview>
      <ModulePreview id="copy-button" title="copy-button">
        <CopyButton value="https://key@localhost/project" label="Copy DSN" />
      </ModulePreview>
      <ModulePreview id="copy-dsn-block" title="copy-dsn-block">
        <CopyDsnBlock dsn="https://public@localhost:8080/550e8400-e29b-41d4-a716-446655440000" />
      </ModulePreview>
      <ModulePreview id="field" title="field">
        <Field label="Webhook URL" hint="HTTPS only">
          <Input placeholder="https://..." />
        </Field>
      </ModulePreview>
      <ModulePreview id="filter-chip" title="filter-chip">
        <FilterChip label="is:unresolved" active />
        <FilterChip label="level:error" />
      </ModulePreview>
      <ModulePreview id="filter-panel" title="filter-panel">
        <FilterPanel
          query="is:unresolved level:error"
          presets={[
            { label: "Unresolved", token: "is:unresolved" },
            { label: "Error", token: "level:error" },
          ]}
          onQueryChange={() => undefined}
        />
      </ModulePreview>
      <ModulePreview id="kbd" title="kbd">
        <Kbd keys="⌘K" />
        <Kbd keys="J" />
        <Kbd keys="⇧" />
      </ModulePreview>
    </div>
  );
}

function LayoutPreviews() {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <ModulePreview id="card" title="card">
        <Card>
          <CardHeader>
            <CardTitle>Card</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-fg-muted">12px radius · hairline border</CardContent>
        </Card>
      </ModulePreview>
      <ModulePreview id="empty" title="empty">
        <Empty title="No signals" description="Quiet empty. No dashed frame." />
      </ModulePreview>
      <ModulePreview id="list-row" title="list-row">
        <ListRow variant="flat" className="flex-col gap-0.5 px-3 py-2">
          <span className="text-sm font-medium">List row</span>
          <span className="text-xs text-fg-muted">Flat variant</span>
        </ListRow>
      </ModulePreview>
      <ModulePreview id="section" title="section">
        <Section variant="band">
          <SectionHeader title="Section band" description="In-pane zones" />
          <Skeleton className="h-6 w-2/3" />
        </Section>
      </ModulePreview>
      <ModulePreview id="skeleton" title="skeleton">
        <IssueRowSkeleton />
      </ModulePreview>
      <ModulePreview id="stat-bar" title="stat-bar">
        <StatBar
          items={[
            { label: "Unresolved", value: 12 },
            { label: "Events (7d)", value: 1402 },
          ]}
        />
      </ModulePreview>
      <ModulePreview id="code-block" title="code-block">
        <CodeBlock
          lines={[
            { number: 1, text: "fn main() {" },
            { number: 2, text: '  panic!("demo");', fault: true },
          ]}
        />
      </ModulePreview>
      <ModulePreview id="sparkline" title="sparkline">
        <Sparkline values={[2, 4, 3, 8, 6, 9, 5]} status="escalating" />
      </ModulePreview>
      <ModulePreview id="occurrence-line-chart" title="occurrence-line-chart">
        <OccurrenceLineChart
          buckets={[
            { start: new Date(Date.now() - 6 * 86400000).toISOString(), count: 2 },
            { start: new Date(Date.now() - 5 * 86400000).toISOString(), count: 5 },
            { start: new Date(Date.now() - 4 * 86400000).toISOString(), count: 3 },
          ]}
        />
      </ModulePreview>
      <ModulePreview id="feed-list-shell" title="feed-list-shell">
        <FeedListBody>
          <StackedCardList>
            <li className="border-b border-border-subtle px-4 py-2 text-xs">Feed list body</li>
          </StackedCardList>
        </FeedListBody>
      </ModulePreview>
      <ModulePreview id="simple-feed-header" title="simple-feed-header">
        <SimpleFeedHeader title="Releases" description="3 versions in range" />
      </ModulePreview>
    </div>
  );
}

function IssuesFeedPreviews() {
  return (
    <div className="grid gap-3">
      <ModulePreview id="issue-row" title="issue-row">
        <IssueRow
          title="TypeError: Cannot read properties of undefined"
          lastSeen="2h ago"
          eventCount={42}
          environment="production"
          unread
        />
      </ModulePreview>
      <ModulePreview id="issue-feed-row" title="issue-feed-row">
        <IssueFeedRow
          shortTitle="TypeError: Cannot read properties of undefined"
          subtitle="checkout.submit"
          lastSeen={DESIGN_KIT_SAMPLE_ISSUE.last_seen_at ?? undefined}
          eventCount={462}
          userCount={111}
          level="error"
          platform="js"
          unread
        />
      </ModulePreview>
      <div className="grid gap-3 xl:grid-cols-2">
        <ModulePreview id="issue-priority" title="issue-priority">
          <IssuePriorityBadge level="error" status="unresolved" />
        </ModulePreview>
        <ModulePreview id="regression-strip" title="regression-strip">
          <RegressionStrip count={2} onViewRegressions={() => undefined} />
        </ModulePreview>
        <ModulePreview id="issues-context-strip" title="issues-context-strip">
          <IssuesContextStrip regressionCount={2} showHint onViewRegressions={() => undefined} />
        </ModulePreview>
        <ModulePreview id="issues-home-hint" title="issues-home-hint">
          <IssuesHomeHint />
        </ModulePreview>
      </div>
    </div>
  );
}

function IssueDetailOverlayPreview() {
  const [open, setOpen] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  return (
    <ModulePreview id="issue-detail-overlay" title="issue-detail-overlay">
      <p className="mb-2 text-xs text-fg-muted">
        Opens in a portal — Close, backdrop click, or Esc dismisses (same as Issues on narrow viewports).
      </p>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={open}>
        Open overlay preview
      </Button>
      <IssueDetailOverlay
        open={open}
        onClose={() => {
          setOpen(false);
          setIsFullscreen(false);
        }}
        width={420}
        isFullscreen={isFullscreen}
        isResizing={false}
        onToggleFullscreen={() => setIsFullscreen((value) => !value)}
        onResizeStart={() => undefined}
      >
        <p className="p-4 text-xs text-fg-muted">Resizable detail overlay shell</p>
      </IssueDetailOverlay>
    </ModulePreview>
  );
}

function IssueDetailPreviews() {
  const [selectedEventId, setSelectedEventId] = React.useState(DESIGN_KIT_SAMPLE_EVENT.id);
  const [timelineWindow, setTimelineWindow] = React.useState<TimelineWindowValue>("7d");

  const onSelectEvent = (id: string) => setSelectedEventId(id);

  return (
    <div className="grid gap-3">
      <ModulePreview id="issue-overview-panel" title="issue-overview-panel">
        <IssueOverviewPanel
          issue={DESIGN_KIT_SAMPLE_ISSUE}
          event={DESIGN_KIT_SAMPLE_EVENT}
          events={DESIGN_KIT_SAMPLE_EVENTS}
        />
      </ModulePreview>
      <ModulePreview id="issue-detail-tabs" title="issue-detail-tabs">
        <IssueDetailTabs
          issue={DESIGN_KIT_SAMPLE_ISSUE}
          issueTitle={DESIGN_KIT_SAMPLE_ISSUE.title ?? "Issue"}
          timeline={DESIGN_KIT_SAMPLE_TIMELINE}
          timelineWindow={timelineWindow}
          onTimelineWindowChange={setTimelineWindow}
          overview={<p className="p-3 text-xs text-fg-muted">Context slot</p>}
          stack={<p className="p-3 text-xs text-fg-muted">Stack slot</p>}
          breadcrumbs={<p className="p-3 text-xs text-fg-muted">Breadcrumbs slot</p>}
        />
      </ModulePreview>
      <ModulePreview id="issue-impact-strip" title="issue-impact-strip">
        <div className="space-y-3">
          <IssueImpactLine issue={DESIGN_KIT_SAMPLE_ISSUE} />
          <IssueOccurrenceTrend
            timeline={DESIGN_KIT_SAMPLE_TIMELINE}
            timelineWindow={timelineWindow}
            onTimelineWindowChange={setTimelineWindow}
          />
          <IssueImpactMetrics issue={DESIGN_KIT_SAMPLE_ISSUE} />
        </div>
      </ModulePreview>
      <ModulePreview id="issue-context-snapshot" title="issue-context-snapshot">
        <IssueContextSnapshot
          issue={DESIGN_KIT_SAMPLE_ISSUE}
          event={DESIGN_KIT_SAMPLE_EVENT}
          tags={DESIGN_KIT_SAMPLE_TAGS}
        />
      </ModulePreview>
      <ModulePreview id="issue-context-fields" title="issue-context-fields">
        <IssueContextFields
          issue={DESIGN_KIT_SAMPLE_ISSUE}
          event={DESIGN_KIT_SAMPLE_EVENT}
          tags={DESIGN_KIT_SAMPLE_TAGS}
        />
      </ModulePreview>
      <ModulePreview id="stack-trace-panel" title="stack-trace-panel">
        <StackTracePanel
          events={DESIGN_KIT_SAMPLE_EVENTS}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
        />
      </ModulePreview>
      <ModulePreview id="source-code-block" title="source-code-block">
        <SourceCodeBlock
          filename="checkout.ts"
          lines={[
            { number: 41, text: "  const total = cart.total;" },
            { number: 42, text: "  return total.amount;", fault: true },
          ]}
        />
      </ModulePreview>
      <ModulePreview id="breadcrumb-timeline" title="breadcrumb-timeline">
        <BreadcrumbTimeline
          events={DESIGN_KIT_SAMPLE_EVENTS}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
        />
      </ModulePreview>
      <ModulePreview id="issue-occurrences-table" title="issue-occurrences-table">
        <IssueOccurrencesTable
          issue={DESIGN_KIT_SAMPLE_ISSUE}
          events={DESIGN_KIT_SAMPLE_EVENTS}
          total={DESIGN_KIT_SAMPLE_EVENTS.length}
          hasMore={false}
          loading={false}
          loadingMore={false}
          selectedEventId={selectedEventId}
          onSelectEvent={(id) => onSelectEvent(id)}
          onLoadMore={() => undefined}
        />
      </ModulePreview>
      <ModulePreview id="issue-occurrence-timeline" title="issue-occurrence-timeline">
        <IssueOccurrenceTimeline
          timeline={DESIGN_KIT_SAMPLE_TIMELINE}
          window={timelineWindow}
          onWindowChange={setTimelineWindow}
        />
      </ModulePreview>
      <ModulePreview id="occurrence-picker" title="occurrence-picker">
        <OccurrencePicker
          events={DESIGN_KIT_SAMPLE_EVENTS}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          showNav
        />
      </ModulePreview>
      <ModulePreview id="issue-recent-occurrences" title="issue-recent-occurrences">
        <IssueRecentOccurrences
          issue={DESIGN_KIT_SAMPLE_ISSUE}
          events={DESIGN_KIT_SAMPLE_EVENTS}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
        />
      </ModulePreview>
      <ModulePreview id="issue-ai-copilot-card" title="issue-ai-copilot-card">
        <IssueAiCopilotCard issue={DESIGN_KIT_SAMPLE_ISSUE} event={DESIGN_KIT_SAMPLE_EVENT} />
      </ModulePreview>
      <ModulePreview id="keyboard-hints-footer" title="keyboard-hints-footer">
        <KeyboardHintsFooter />
      </ModulePreview>
      <ModulePreview id="more-panel" title="more-panel">
        <MorePanel>
          <p className="p-3 text-xs text-fg-muted">More tab layout shell</p>
        </MorePanel>
      </ModulePreview>
      <ModulePreview id="issue-more-panel" title="issue-more-panel">
        <p className="text-xs leading-relaxed text-fg-muted">
          Full panel loads merge + feedback from API — open Issues → detail → More in playground.
        </p>
      </ModulePreview>
      <IssueDetailOverlayPreview />
    </div>
  );
}

function SetupPreviews() {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <ModulePreview id="setup-checklist" title="setup-checklist">
        <SetupChecklist projectNamed hasActiveKey dsnCopied firstIssueSeen={false} complete={false} />
      </ModulePreview>
      <ModulePreview id="step-indicator" title="step-indicator">
        <StepIndicator
          steps={[
            { id: "1", label: "Connect", complete: true },
            { id: "2", label: "Verify", active: true },
            { id: "3", label: "Done" },
          ]}
        />
      </ModulePreview>
      <ModulePreview id="sdk-snippet-block" title="sdk-snippet-block">
        <SdkSnippetBlock dsn="https://key@localhost:8080/demo" initOnly />
      </ModulePreview>
      <ModulePreview id="setup-connect-guide" title="setup-connect-guide">
        <SetupConnectGuide dsn={DEMO_DSN} phase="connect" projectName="Acme Web" platformId="javascript" />
      </ModulePreview>
      <ModulePreview id="setup-connect-panel" title="setup-connect-panel">
        <SetupConnectPanel dsn={DEMO_DSN} platform={JS_PLATFORM} setupPath="fresh" />
      </ModulePreview>
      <ModulePreview id="setup-docs-link" title="setup-docs-link">
        <SetupDocsLink href="https://epure.sh/docs">Read the docs</SetupDocsLink>
      </ModulePreview>
      <ModulePreview id="setup-platform-mark" title="setup-platform-mark">
        <SetupPlatformMark logo="javascript" />
      </ModulePreview>
      <ModulePreview id="setup-status-banner" title="setup-status-banner">
        <SetupWaitingBanner projectId="550e8400-e29b-41d4-a716-446655440000" />
      </ModulePreview>
      <ModulePreview id="setup-waiting-panel" title="setup-waiting-panel">
        <SetupWaitingPanel
          projectId="550e8400-e29b-41d4-a716-446655440000"
          environment="production"
          onEnvironmentSync={() => undefined}
        />
      </ModulePreview>
      <ModulePreview id="dual-sending-card" title="dual-sending-card">
        <DualSendingCard publicKey="demo-public-key" dsnSegment="550e8400-e29b-41d4-a716-446655440000" />
      </ModulePreview>
    </div>
  );
}

function ChromePreviews() {
  return (
    <div className="grid gap-3">
      <ModulePreview id="logo" title="logo">
        <LogoNavButton />
      </ModulePreview>
      <ModulePreview id="page-chrome" title="page-chrome">
        <PageChrome title="Monitoring" description="Live telemetry" />
      </ModulePreview>
      <ModulePreview id="page-header" title="page-header">
        <PageHeader title="Legacy header façade" description="Prefer PageChrome" />
      </ModulePreview>
      <ModulePreview id="shared-project-badge" title="shared-project-badge">
        <SharedProjectBadge />
      </ModulePreview>
      <ModulePreview id="settings-nav" title="settings-nav">
        <SettingsNav />
      </ModulePreview>
      <ModulePreview id="workspace-settings-nav" title="workspace-settings-nav">
        <WorkspaceSettingsNav />
      </ModulePreview>
    </div>
  );
}

function FeedbackPreviews() {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <ModulePreview id="error-state" title="error-state">
        <ErrorState title="Failed to load" description="Retry or contact support." onRetry={() => undefined} />
      </ModulePreview>
      <ModulePreview id="fair-use-banner" title="fair-use-banner">
        <FairUseBanner message="Approaching fair-use sampling. Counts remain exact." />
      </ModulePreview>
      <ModulePreview id="route-error-boundary" title="route-error-boundary">
        <RouteErrorBoundary title="Route error" backHref="/">
          <Badge variant="neutral">Healthy child route</Badge>
        </RouteErrorBoundary>
      </ModulePreview>
      <ModulePreview id="toast" title="toast">
        <Toast message="Alert resolved. Marked as read." />
      </ModulePreview>
      <ModulePreview id="toast-provider" title="toast-provider">
        <ToastProvider>
          <Button size="sm" variant="secondary" onClick={() => undefined}>
            ToastProvider wraps app shell
          </Button>
        </ToastProvider>
      </ModulePreview>
    </div>
  );
}

const GROUP_RENDERERS: Record<string, () => React.ReactNode> = {
  "feature-ui-controls": ControlsPreviews,
  "feature-ui-layout": LayoutPreviews,
  "feature-ui-issues-feed": IssuesFeedPreviews,
  "feature-ui-issue-detail": IssueDetailPreviews,
  "feature-ui-setup": SetupPreviews,
  "feature-ui-chrome": ChromePreviews,
  "feature-ui-feedback": FeedbackPreviews,
};

export function FeatureUiGroupPreviews({ groupId }: { groupId: string }) {
  const Render = GROUP_RENDERERS[groupId];
  return Render ? <Render /> : null;
}
