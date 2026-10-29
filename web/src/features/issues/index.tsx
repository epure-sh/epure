import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { setupNeedsWizard } from "../../lib/api";
import { projectPath } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { useIssuesLayoutMode } from "../../lib/style-theme";
import { useAppContext } from "../../shell/app-context";
import { ActionButton } from "../../ui/action-button";
import { BreadcrumbTimeline } from "../../ui/breadcrumb-timeline";
import { ErrorState, ForbiddenState } from "../../ui/error-state";
import { IssueDetailOverlay } from "../../ui/issue-detail-overlay";
import {
  DETAIL_INLINE_ACTION_CLASS,
  IssueDetailTabs,
  type IssueDetailTab,
} from "../../ui/issue-detail-tabs";
import { IssueOverviewPanel } from "../../ui/issue-overview-panel";
import { IssueMorePanel } from "../../ui/issue-more-panel";
import { KeyboardHintsFooter } from "../../ui/keyboard-hints-footer";
import { SetupWaitingBanner, TestDataBanner } from "../../ui/setup-status-banner";
import { IssueRowSkeleton } from "../../ui/skeleton";
import { StackTracePanel } from "../../ui/stack-trace-panel";
import { useToast } from "../../ui/toast-provider";
import { BulkDeleteDialog } from "./bulk-delete-dialog";
import { ResolveWithAiDialog } from "./resolve-with-ai-dialog";
import { downloadIssuesCsv } from "./export-csv";
import { DiffPanel } from "./diff-panel";
import {
  canIgnoreIssue,
  issueWorkflowActions,
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
import { IssueStateActions, IssueStateBadge } from "./issue-state-actions";
import { useResizableIssueDetail } from "./use-resizable-issue-detail";
import { useIssueTriageMachine } from "./use-issue-triage-machine";

import { DEFAULT_QUERY, isAllIssuesQuery } from "./query-utils";


export function IssuesPage() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { projectId, projects } = useAppContext();
  const filterInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
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
    handleUnsnoozeIds,
    handleBulk,
    handleSnoozeIds,
    handleMarkReadIds,
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
    const ids = deleteTargetIds.length > 0 ? deleteTargetIds : Array.from(selectedIds);
    void handleBulk("delete", { ids }).finally(() => {
      setDeleteConfirmOpen(false);
      setDeleteTargetIds([]);
    });
  }, [deleteTargetIds, handleBulk, selectedIds]);

  const handleMenuAskAi = useCallback(
    (rows: typeof selectedIssues) => {
      if (rows.length === 0) {
        return;
      }
      if (rows.length === 1) {
        const row = rows[0];
        const issueUrl = scopedProjectId
          ? `${window.location.origin}/p/${scopedProjectId}/issues?issue=${row.id}`
          : `${window.location.origin}/issues?issue=${row.id}`;
        void copyIssueExport(row, row.id === selectedIssue?.id ? selectedEvent : null, issueUrl).then(
          () => toast("Copied. Paste into Cursor or your AI assistant."),
        );
        return;
      }
      void copyBulkIssueExport(rows).then(() =>
        toast("Copied. Paste into Cursor or your AI assistant."),
      );
    },
    [scopedProjectId, selectedEvent, selectedIssue?.id, toast],
  );

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
    isAllIssuesQuery(query) || query === DEFAULT_QUERY;

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
    const triageActions = triageIssue ? issueWorkflowActions(triageIssue) : [];
    registerIssuesTriage({
      active: true,
      busy: actionsDisabled,
      hasSelectedIssue: Boolean(triageIssue),
      selectedCount: selectedIds.size,
      canResolve: triageActions.includes("resolve"),
      canIgnore: triageActions.includes("ignore"),
      canReopen: triageActions.includes("reopen"),
      canSnooze: triageActions.includes("snooze"),
      canUnsnooze: triageActions.includes("unsnooze"),
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
        snoozeSelected: () => {
          if (activeIssueId) {
            void handleSnooze("4h", activeIssueId);
          }
        },
        unsnoozeSelected: () => {
          if (activeIssueId) {
            void handleUnsnooze(activeIssueId);
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
    handleSnooze,
    handleUnsnooze,
    activeIssueId,
    focusedIssue,
    selectedIds.size,
    selectedIssue,
  ]);

  useEffect(() => {
    setDetailTab("overview");
  }, [selectedId]);

  const filtersActive =
    !isAllIssuesQuery(query) ||
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
  const canSplit = Boolean(selectedId) && (mergedChildren?.length ?? 0) > 0;
  const allSelected = issues.length > 0 && selectedIds.size === issues.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const issueDetailContent = selectedIssue ? (
    <>
      <IssueDetailTabs
        tab={detailTab}
        onTabChange={setDetailTab}
        onClose={handleCloseDetail}
        showBackLink={!isOverlayLayout}
        issue={selectedIssue}
        issueTitle={selectedIssue.title ?? "Untitled issue"}
        statusBadges={<IssueStateBadge issue={selectedIssue} />}
        onPrevious={() => handleMoveSelection("up")}
        onNext={() => handleMoveSelection("down")}
        hasPrevious={issues.findIndex((issue) => issue.id === selectedIssue.id) > 0}
        hasNext={(() => {
          const index = issues.findIndex((issue) => issue.id === selectedIssue.id);
          return index >= 0 && index < issues.length - 1;
        })()}
        timeline={timeline}
        timelineLoading={timelineLoading}
        timelineWindow={timelineWindow}
        onTimelineWindowChange={setTimelineWindow}
        actions={
          <>
            <ActionButton
              variant="ghost"
              size="sm"
              className={DETAIL_INLINE_ACTION_CLASS}
              disabled={actionsDisabled}
              tooltip="Copy a diagnostic brief for your coding agent (C)"
              onClick={handleExport}
            >
              <Sparkles className="size-4" />
              <span>Copy for agent</span>
            </ActionButton>
            <IssueStateActions
              issue={selectedIssue}
              disabled={actionsDisabled}
              pending={pendingIds.has(selectedIssue.id)}
              onResolve={handleResolve}
              onReopen={handleReopen}
              onIgnore={handleIgnore}
              onSnooze={handleSnooze}
              onUnsnooze={(id) => void handleUnsnooze(id)}
            />
          </>
        }
        overview={
          <IssueOverviewPanel
            issue={selectedIssue}
            event={selectedEvent}
            events={events}
          />
        }
        stack={
          <StackTracePanel
            events={events}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            onSelectEvent={handleSelectEvent}
            showOccurrencePicker={false}
            hideExceptionTitle
            onViewGrouping={openMoreGrouping}
          />
        }
        breadcrumbs={
          <BreadcrumbTimeline
            events={events}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            onSelectEvent={handleSelectEvent}
            showOccurrencePicker={false}
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
    <div className="flex h-full min-h-0 flex-col bg-canvas">
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
        tourAutoStartReady={issues.length > 0 && !loading}
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
            "epure-issues-layout__list flex min-h-0 flex-col overflow-hidden bg-canvas epure-page-gutter-x pt-3 md:pt-4",
            issues.length === 0 && !loading ? "w-full shrink-0 grow-0" : "min-h-0 flex-1",
            isOverlayLayout
              ? "min-w-0 flex-1"
              : layoutMode === "split-narrow"
                ? "w-full shrink-0 border-r border-border lg:w-issue-list"
                : "w-full shrink-0 border-r border-border lg:w-issue-list",
            selectedIssue && (isOverlayLayout ? "hidden lg:flex" : "max-lg:hidden"),
          )}
        >
          {loading ? (
            <div className="mb-3 flex min-h-0 min-w-0 w-full flex-1 flex-col rounded-lg border border-border bg-surface-1 shadow-xs overflow-hidden">
              <div className="epure-issue-list flex min-h-0 flex-1 flex-col overflow-auto">
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
            <div className="mb-3 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-xs">
              <IssueList
                embedded
                canMerge={canMerge}
                canSplit={canSplit}
                onBulkSplit={() => void handleSplit(mergedChildren.map((child) => child.id))}
                canSplitForIssueId={canSplit ? selectedId : null}
                onMenuResolve={(ids) => void handleBulk("resolve", { ids })}
                onMenuIgnore={(ids) => void handleBulk("ignore", { ids })}
                onMenuReopen={(ids) => void handleBulk("reopen", { ids })}
                onMenuSnooze={(mode, ids) => void handleSnoozeIds(mode, ids)}
                onMenuUnsnooze={(ids) => void handleUnsnoozeIds(ids)}
                selectedIssue={selectedIssue}
                onMenuAskAi={handleMenuAskAi}
                onMenuMarkRead={handleMarkReadIds}
                onMenuDeleteRequest={(ids) => {
                  setDeleteTargetIds(ids);
                  setDeleteConfirmOpen(true);
                }}
                onMenuMerge={() => void handleMerge()}
                onMenuSplit={() => void handleSplit(mergedChildren.map((child) => child.id))}
                onClearSelection={handleClearSelection}
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
                onSnooze={(id) => void handleSnooze("4h", id)}
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
            </div>
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
            className="epure-issues-layout__detail flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas"
            aria-label="Issue detail"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {issueDetailContent}
            </div>
          </aside>
        ) : null}
      </div>

      <BulkDeleteDialog
        count={deleteTargetIds.length > 0 ? deleteTargetIds.length : selectedIds.size}
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) {
            setDeleteTargetIds([]);
          }
        }}
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
