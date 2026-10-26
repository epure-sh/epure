import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, RotateCcw, Sparkles } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { setupNeedsWizard } from "../../lib/api";
import { projectPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { useIssuesLayoutMode } from "../../lib/style-theme";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { IssuePriorityBadge } from "../../ui/issue-priority";
import { ActionButton } from "../../ui/action-button";
import { BreadcrumbTimeline } from "../../ui/breadcrumb-timeline";
import { ErrorState, ForbiddenState } from "../../ui/error-state";
import { IssueDetailOverlay } from "../../ui/issue-detail-overlay";
import { IssueDetailTabs, type IssueDetailTab } from "../../ui/issue-detail-tabs";
import { IssueOverviewPanel } from "../../ui/issue-overview-panel";
import { IssueMorePanel } from "../../ui/issue-more-panel";
import { KeyboardHintsFooter } from "../../ui/keyboard-hints-footer";
import { SetupWaitingBanner, TestDataBanner } from "../../ui/setup-status-banner";
import { IssueRowSkeleton } from "../../ui/skeleton";
import { StackTracePanel } from "../../ui/stack-trace-panel";
import { useToast } from "../../ui/toast-provider";
import { BulkActions } from "./bulk-actions";
import { BulkDeleteDialog } from "./bulk-delete-dialog";
import { ResolveWithAiDialog } from "./resolve-with-ai-dialog";
import { downloadIssuesCsv } from "./export-csv";
import { DiffPanel } from "./diff-panel";
import {
  canIgnoreIssue,
  canReopenIssue,
  canResolveIssue,
} from "./issue-triage-utils";
import {
  copyBulkIssueExport,
  copyIssueExport,
  useExportHotkey,
} from "./export-markdown";
import { IssueList } from "./issue-list";
import { IssuesFeedHeader } from "./issues-feed-header";
import {
  DEFAULT_ISSUE_SORT,
  DEFAULT_TIME_WINDOW,
} from "./query-utils";
import { registerIssuesTriage } from "./triage-bridge";
import { SnoozeMenu } from "./snooze-menu";
import { useResizableIssueDetail } from "./use-resizable-issue-detail";
import { useIssueTriageMachine } from "./use-issue-triage-machine";

const DEFAULT_QUERY = "is:unresolved";


export function IssuesPage() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { projectId, projects } = useAppContext();
  const filterInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resolveWithAiOpen, setResolveWithAiOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<IssueDetailTab>("overview");

  const {
    width: detailWidth,
    isFullscreen: detailFullscreen,
    isResizing: detailResizing,
    toggleFullscreen: toggleDetailFullscreen,
    startResize: startDetailResize,
  } = useResizableIssueDetail();

  const triage = useIssueTriageMachine({ routeProjectId });
  const {
    scopedProjectId,
    query,
    setQuery,
    timeWindow,
    setTimeWindow,
    issueSort,
    setIssueSort,
    feedStatus,
    loadError,
    issues,
    issueTrends,
    loadIssues,
    focusedId,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    activeIssueId,
    selectedIssue,
    focusedIssue,
    selectedIssues,
    bulkAvailability,
    events,
    selectedEventId,
    selectedEvent,
    handleSelectEvent,
    diffEventId,
    setDiffEventId,
    diffMode,
    setDiffMode,
    mergedChildren,
    issueReleases,
    leftRelease,
    setLeftRelease,
    rightRelease,
    setRightRelease,
    timeline,
    timelineLoading,
    timelineWindow,
    setTimelineWindow,
    headlineStats,
    statsLoading,
    setup,
    setupLoading,
    waitingForFirstIssue,
    actionsDisabled,
    busy,
    pendingIds,
    isIssueUnread,
    handleResolve,
    handleIgnore,
    handleReopen,
    handleSnooze,
    handleUnsnooze,
    handleBulk,
    handleBulkSnooze,
    handleClearSelection,
    handleToggleSelectAll,
    handleMoveSelection,
    handleOpenDetail,
    handleCloseDetail,
    handleSelect,
    handleToggleSelect,
    handleMerge,
    handleSplit,
    applyFilter,
    handleResetFilters,
  } = triage;

  const loading = feedStatus === "loading";
  const loadForbidden = feedStatus === "forbidden";

  const handleConfirmBulkDelete = useCallback(() => {
    void handleBulk("delete").finally(() => setDeleteConfirmOpen(false));
  }, [handleBulk]);

  const handleExportCsv = useCallback(
    (scope: "view" | "selected") => {
      const rows = scope === "selected" ? selectedIssues : issues;
      if (rows.length === 0) {
        toast("Nothing to export");
        return;
      }
      downloadIssuesCsv(rows, `issues-${scope}-${new Date().toISOString().slice(0, 10)}.csv`);
      toast(`Exported ${rows.length} issues to CSV`);
    },
    [issues, selectedIssues, toast],
  );

  const openMoreGrouping = useCallback(() => setDetailTab("stack"), []);

  const handleConfirmResolveWithAi = useCallback(async () => {
    const eligible = selectedIssues.filter((issue) => canIgnoreIssue(issue.status));
    if (eligible.length === 0 || actionsDisabled) {
      setResolveWithAiOpen(false);
      return;
    }
    try {
      await copyBulkIssueExport(eligible);
    } catch {
      toast("Resolve with AI failed");
      return;
    }
    setResolveWithAiOpen(false);
    await handleBulk("ignore", {
      ids: eligible.map((issue) => issue.id),
      successMessage:
        eligible.length === 1
          ? "Copied and ignored"
          : `Copied ${eligible.length} issues and marked ignored`,
    });
  }, [actionsDisabled, handleBulk, selectedIssues, toast]);


  const needsSetupRedirect =
    !setupLoading &&
    !loading &&
    issues.length === 0 &&
    projectId &&
    setup &&
    setupNeedsWizard(setup);

  const showWaitingBanner =
    Boolean(setup) &&
    waitingForFirstIssue &&
    issues.length === 0 &&
    query === DEFAULT_QUERY;

  const showTestDataBanner = Boolean(setup?.seeded);

  const layoutMode = useIssuesLayoutMode();
  const isOverlayLayout = layoutMode === "overlay";

  const handleExport = useCallback(() => {
    if (!selectedIssue) {
      return;
    }
    const issueUrl = scopedProjectId
      ? `${window.location.origin}/p/${scopedProjectId}/issues?issue=${selectedIssue.id}`
      : `${window.location.origin}/issues?issue=${selectedIssue.id}`;
    void copyIssueExport(selectedIssue, selectedEvent, issueUrl).then(() =>
      toast("Copied. Paste into Cursor or your AI assistant."),
    );
  }, [scopedProjectId, selectedEvent, selectedIssue]);

  useExportHotkey(
    Boolean(selectedIssue ?? focusedIssue),
    selectedIssue ?? focusedIssue,
    selectedEvent,
    () => {
      toast("Copied. Paste into Cursor or your AI assistant.");
    },
  );

  useEffect(() => {
    const triageIssue = selectedIssue ?? focusedIssue;
    registerIssuesTriage({
      active: true,
      busy: actionsDisabled,
      hasSelectedIssue: Boolean(triageIssue),
      selectedCount: selectedIds.size,
      canResolve: triageIssue ? canResolveIssue(triageIssue.status) : false,
      canIgnore: triageIssue ? canIgnoreIssue(triageIssue.status) : false,
      canReopen: triageIssue ? canReopenIssue(triageIssue.status) : false,
      canMerge: selectedIds.size >= 2 && Boolean(activeIssueId) && !actionsDisabled,
      handlers: {
        applyFilter,
        resolveSelected: () => {
          if (activeIssueId) {
            handleResolve(activeIssueId);
          }
        },
        ignoreSelected: () => {
          if (activeIssueId) {
            handleIgnore(activeIssueId);
          }
        },
        reopenSelected: () => {
          if (activeIssueId) {
            handleReopen(activeIssueId);
          }
        },
        exportSelected: handleExport,
        openDiff: () => setDetailTab("stack"),
        mergeSelected: () => void handleMerge(),
      },
    });
    return () => registerIssuesTriage(null);
  }, [
    actionsDisabled,
    applyFilter,
    handleExport,
    handleIgnore,
    handleMerge,
    handleReopen,
    handleResolve,
    activeIssueId,
    focusedIssue,
    selectedIds.size,
    selectedIssue,
  ]);

  useEffect(() => {
    setDetailTab("overview");
  }, [selectedId]);

  const filtersActive =
    query !== DEFAULT_QUERY ||
    timeWindow !== DEFAULT_TIME_WINDOW ||
    issueSort !== DEFAULT_ISSUE_SORT;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (selectedId) {
        event.preventDefault();
        handleCloseDetail();
        return;
      }
      if (selectedIds.size > 0) {
        event.preventDefault();
        setSelectedIds(new Set());
        return;
      }
      if (filtersActive) {
        event.preventDefault();
        handleResetFilters();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtersActive, handleResetFilters, selectedId, selectedIds.size, setSelectedId, setSelectedIds]);

  if (needsSetupRedirect && scopedProjectId) {
    return <Navigate to={projectPath(scopedProjectId, "setup")} replace />;
  }

  const canMerge = selectedIds.size >= 2 && Boolean(selectedId);
  const canSplit = Boolean(selectedId) && mergedChildren.length > 0;
  const allSelected = issues.length > 0 && selectedIds.size === issues.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const issueDetailContent = selectedIssue ? (
    <>
      <IssueDetailTabs
        tab={detailTab}
        onTabChange={setDetailTab}
        onClose={handleCloseDetail}
        showBackLink={!isOverlayLayout}
        issueTitle={selectedIssue.title ?? "Untitled issue"}
        statusBadges={
          <>
            <IssuePriorityBadge
              level={selectedIssue.level}
              status={selectedIssue.status}
              compact
            />
            <Badge
              size="compact"
              variant={
                selectedIssue.status === "resolved"
                  ? "resolved"
                  : selectedIssue.status === "regression"
                    ? "warning"
                    : "env"
              }
            >
              {selectedIssue.status}
            </Badge>
            {selectedIssue.status === "regression" ? (
              <Badge size="compact" variant="warning">Came back</Badge>
            ) : null}
            {selectedIssue.snoozed ? (
              <Badge size="compact" variant="info">Snoozed</Badge>
            ) : null}
          </>
        }
        onPrevious={() => handleMoveSelection("up")}
        onNext={() => handleMoveSelection("down")}
        hasPrevious={issues.findIndex((issue) => issue.id === selectedIssue.id) > 0}
        hasNext={(() => {
          const index = issues.findIndex((issue) => issue.id === selectedIssue.id);
          return index >= 0 && index < issues.length - 1;
        })()}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <ActionButton
              variant="outline"
              size="sm"
              disabled={actionsDisabled}
              tooltip="Copy a diagnostic brief for your coding agent (C)"
              onClick={handleExport}
            >
              <Sparkles className="size-3.5" />
              <span>Copy for agent</span>
            </ActionButton>
            {canResolveIssue(selectedIssue.status) ? (
              <ActionButton
                variant="primary"
                size="sm"
                disabled={actionsDisabled}
                onClick={() => void handleResolve(selectedIssue.id)}
              >
                <Check className="size-3.5" />
                <span>{pendingIds.has(selectedIssue.id) ? "Saving…" : "Resolve"}</span>
              </ActionButton>
            ) : null}
            {canReopenIssue(selectedIssue.status) ? (
              <ActionButton
                variant="outline"
                size="sm"
                disabled={actionsDisabled}
                onClick={() => void handleReopen(selectedIssue.id)}
              >
                <RotateCcw className="size-3.5" />
                <span>{pendingIds.has(selectedIssue.id) ? "Saving…" : "Reopen"}</span>
              </ActionButton>
            ) : null}
            {selectedIssue.snoozed || selectedIssue.status === "snoozed" ? (
              <ActionButton
                variant="outline"
                size="sm"
                disabled={actionsDisabled}
                onClick={() => void handleUnsnooze(selectedIssue.id)}
              >
                <BellRing className="size-3.5" />
                <span>Unsnooze</span>
              </ActionButton>
            ) : (
              <SnoozeMenu
                issue={selectedIssue}
                disabled={actionsDisabled}
                buttonSize="sm"
                variant="outline"
                onSnooze={handleSnooze}
              />
            )}
          </div>
        }
        overview={
          <IssueOverviewPanel
            issue={selectedIssue}
            event={selectedEvent}
            events={events}
            timeline={timeline}
            timelineLoading={timelineLoading}
            timelineWindow={timelineWindow}
            onTimelineWindowChange={setTimelineWindow}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
          />
        }
        stack={
          <StackTracePanel
            events={events}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            onSelectEvent={handleSelectEvent}
            onViewGrouping={openMoreGrouping}
          />
        }
        breadcrumbs={
          <BreadcrumbTimeline
            events={events}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            onSelectEvent={handleSelectEvent}
          />
        }
        more={
          <IssueMorePanel
            issue={selectedIssue}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            selectedEvent={selectedEvent}
            diffSection={
              <DiffPanel
                issueId={selectedIssue.id}
                mode={diffMode}
                onModeChange={setDiffMode}
                events={events}
                leftEventId={selectedEventId}
                rightEventId={diffEventId}
                onRightEventChange={setDiffEventId}
                releases={issueReleases}
                leftRelease={leftRelease}
                rightRelease={rightRelease}
                onLeftReleaseChange={setLeftRelease}
                onRightReleaseChange={setRightRelease}
              />
            }
            mergedChildren={mergedChildren}
            onSplit={(splitIds) => void handleSplit(splitIds)}
            busy={busy}
          />
        }
      />
    </>
  ) : null;

  if (loadForbidden) {
    return (
      <ForbiddenState
        title="Access denied"
        description="You do not have permission to view issues in this project."
        backHref={scopedProjectId ? projectPath(scopedProjectId, "issues") : "/"}
        backLabel="Back to workspace"
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showTestDataBanner && scopedProjectId ? (
        <TestDataBanner projectId={scopedProjectId} />
      ) : null}
      {showWaitingBanner && scopedProjectId ? (
        <SetupWaitingBanner projectId={scopedProjectId} />
      ) : null}

      <IssuesFeedHeader
        query={query}
        onQueryChange={setQuery}
        onApply={() => void loadIssues(query, timeWindow, issueSort)}
        timeWindow={timeWindow}
        onTimeWindowChange={setTimeWindow}
        issueSort={issueSort}
        onIssueSortChange={setIssueSort}
        filterInputRef={filterInputRef}
        issueCount={issues.length}
        loading={loading}
        stats={headlineStats}
        statsLoading={statsLoading}
        onFilterToken={applyFilter}
        selectedCount={selectedIds.size}
        onExportCsv={handleExportCsv}
      />

      <div
        className={cn(
          "epure-issues-layout relative flex min-h-0 flex-1 overflow-hidden",
          !isOverlayLayout && "lg:flex-row",
          issues.length === 0 && !loading && "epure-issues-layout--empty",
        )}
      >
        <aside
          className={cn(
            "epure-issues-layout__list flex min-h-0 flex-col overflow-hidden px-4 md:px-6",
            issues.length === 0 && !loading ? "w-full shrink-0 grow-0" : "min-h-0 flex-1",
            isOverlayLayout
              ? "min-w-0 flex-1 bg-bg"
              : layoutMode === "split-narrow"
                ? "w-full shrink-0 border-r border-border bg-bg lg:w-issue-list"
                : "w-full shrink-0 border-r border-border bg-surface-inset lg:w-issue-list",
            selectedIssue && (isOverlayLayout ? "hidden lg:flex" : "max-lg:hidden"),
          )}
        >
          <BulkActions
            selectedIds={selectedIds}
            availability={bulkAvailability}
            canMerge={canMerge}
            canSplit={canSplit}
            onResolve={() => void handleBulk("resolve")}
            onIgnore={() => void handleBulk("ignore")}
            onResolveWithAi={() => setResolveWithAiOpen(true)}
            onReopen={() => void handleBulk("reopen")}
            onSnooze={handleBulkSnooze}
            onDelete={() => setDeleteConfirmOpen(true)}
            onMerge={() => void handleMerge()}
            onSplit={() =>
              void handleSplit(mergedChildren.map((child) => child.id))
            }
            onClear={handleClearSelection}
            busy={actionsDisabled}
          />
          {loading ? (
            <div className="mb-3 flex min-h-0 min-w-0 w-full flex-1 flex-col">
              <div className="epure-issue-list flex min-h-0 flex-1 flex-col overflow-auto rounded-lg border border-border bg-surface">
                {Array.from({ length: 8 }).map((_, index) => (
                  <IssueRowSkeleton key={index} />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <ErrorState
                title="Could not load issues"
                description={loadError}
                onRetry={() => void loadIssues(query, timeWindow, issueSort)}
                retrying={loading}
                backHref={scopedProjectId ? projectPath(scopedProjectId, "issues") : "/"}
                backLabel="Back to workspace"
              />
            </div>
          ) : (
            <IssueList
              issues={issues}
              projects={projects}
              focusedId={focusedId}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onToggleSelect={handleToggleSelect}
              onResolve={handleResolve}
              onReopen={handleReopen}
              onIgnore={handleIgnore}
              onSnooze={(id) => void handleSnooze("hours", id)}
              onUnsnooze={(id) => void handleUnsnooze(id)}
              actionsDisabled={actionsDisabled}
              onMoveSelection={handleMoveSelection}
              onOpenDetail={handleOpenDetail}
              onFocusQuery={() => {
                window.requestAnimationFrame(() => filterInputRef.current?.focus());
              }}
              selectAllChecked={allSelected}
              selectAllIndeterminate={someSelected}
              onToggleSelectAll={issues.length > 0 ? handleToggleSelectAll : undefined}
              filtersActive={filtersActive}
              onResetFilters={handleResetFilters}
              windowLabel={timeWindow}
              isIssueUnread={isIssueUnread}
              trendBucketsByIssueId={issueTrends}
            />
          )}
          <div className="flex shrink-0 justify-end py-1">
            <KeyboardHintsFooter />
          </div>
        </aside>

        {isOverlayLayout ? (
          <IssueDetailOverlay
            open={Boolean(selectedIssue)}
            onClose={handleCloseDetail}
            width={detailWidth}
            isFullscreen={detailFullscreen}
            isResizing={detailResizing}
            onToggleFullscreen={toggleDetailFullscreen}
            onResizeStart={startDetailResize}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {issueDetailContent}
            </div>
          </IssueDetailOverlay>
        ) : selectedIssue ? (
          <aside
            className="epure-issues-layout__detail flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface"
            aria-label="Issue detail"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {issueDetailContent}
            </div>
          </aside>
        ) : null}
      </div>

      <BulkDeleteDialog
        count={selectedIds.size}
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={() => void handleConfirmBulkDelete()}
        busy={busy}
      />
      <ResolveWithAiDialog
        count={selectedIssues.filter((issue) => canIgnoreIssue(issue.status)).length}
        open={resolveWithAiOpen}
        onOpenChange={setResolveWithAiOpen}
        onConfirm={() => void handleConfirmResolveWithAi()}
        busy={busy}
      />
    </div>
  );
}
