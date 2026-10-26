import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  createMonitor,
  deleteMonitor,
  fetchMonitorDetails,
  fetchMonitors,
  type MonitorCheckIn,
  type MonitorItem,
} from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatRelativeTime } from "../../lib/format-time";
import { useAppContext } from "../../shell/app-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionButton } from "../../ui/action-button";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { CopyButton } from "../../ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Empty } from "../../ui/empty";
import { FeedListBody, StackedCardList } from "../../ui/feed-list-shell";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import {
  FeedHeaderStat,
  FeedHeaderStatDot,
  SimpleFeedHeader,
} from "../../ui/simple-feed-header";
import { CardRowSkeleton } from "../../ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { useToast } from "../../ui/toast-provider";

type StatusFilter = "all" | "ok" | "in_progress" | "error" | "missed";

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  switch (status) {
    case "ok":
      return (
        <Badge variant="healthy" size="md" className={className}>
          <CheckCircle2 size={13} className="shrink-0" />
          Healthy
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="info" size="md" className={className}>
          <Activity size={13} className="shrink-0 animate-pulse" />
          Running
        </Badge>
      );
    case "error":
      return (
        <Badge variant="error" size="md" className={className}>
          <XCircle size={13} className="shrink-0" />
          Error
        </Badge>
      );
    case "missed":
      return (
        <Badge variant="warning" size="md" className={className}>
          <AlertTriangle size={13} className="shrink-0" />
          Missed
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" size="md" className={cn("text-fg-muted", className)}>
          {status}
        </Badge>
      );
  }
}

export function MonitorsPage() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { projectId, projects, projectsLoading, environment } = useAppContext();
  const { toast } = useToast();

  const [monitors, setMonitors] = useState<MonitorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // SDK Guide toggle
  const [showSdkGuide, setShowSdkGuide] = useState(false);

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createSlug, setCreateSlug] = useState("");
  const [createSchedule, setCreateSchedule] = useState("");
  const [createEnv, setCreateEnv] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  // History Details Modal
  const [selectedMonitor, setSelectedMonitor] = useState<MonitorItem | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [historyCheckIns, setHistoryCheckIns] = useState<MonitorCheckIn[]>([]);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject = useMemo(() => {
    const candidate = routeProjectId ?? projectId;
    if (candidate) {
      const match = safeProjects.find((row) => row && (row.id === candidate || row.slug === candidate));
      if (match) return match;
    }
    return safeProjects[0] ?? null;
  }, [routeProjectId, projectId, safeProjects]);

  const activeProjectId = activeProject?.id ?? null;

  const loadMonitors = useCallback(async () => {
    if (projectsLoading) {
      return;
    }
    if (!activeProjectId) {
      setMonitors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await fetchMonitors(activeProjectId);
      setMonitors(Array.isArray(items) ? items : []);
    } catch {
      setMonitors([]);
      setError("Failed to load cron monitors");
    } finally {
      setLoading(false);
    }
  }, [projectsLoading, activeProjectId]);

  useEffect(() => {
    void loadMonitors();
  }, [loadMonitors]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;
    const slug = createSlug.trim();
    if (!slug) {
      toast("Monitor slug is required");
      return;
    }

    setCreateBusy(true);
    try {
      const item = await createMonitor({
        project_id: activeProjectId,
        slug,
        schedule: createSchedule.trim() || undefined,
        environment: createEnv.trim() || environment || undefined,
      });
      setMonitors((prev) => [item, ...prev.filter((m) => m.id !== item.id)]);
      toast(`Monitor "${slug}" created successfully`);
      setCreateOpen(false);
      setCreateSlug("");
      setCreateSchedule("");
      setCreateEnv("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create monitor");
    } finally {
      setCreateBusy(false);
    }
  };

  const handleDelete = async (id: string, slug: string) => {
    if (!confirm(`Are you sure you want to delete monitor "${slug}" and its check-in history?`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteMonitor(id);
      setMonitors((prev) => prev.filter((m) => m.id !== id));
      toast(`Monitor "${slug}" deleted`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete monitor");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenDetails = async (monitor: MonitorItem) => {
    setSelectedMonitor(monitor);
    setDetailsLoading(true);
    setHistoryCheckIns([]);
    try {
      const res = await fetchMonitorDetails(monitor.id);
      setHistoryCheckIns(Array.isArray(res?.check_ins) ? res.check_ins : []);
    } catch {
      toast("Failed to load check-in details");
    } finally {
      setDetailsLoading(false);
    }
  };

  // Filtered monitors
  const filteredMonitors = useMemo(() => {
    const list = Array.isArray(monitors) ? monitors : [];
    return list.filter((m) => {
      if (!m) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        return (
          m.slug.toLowerCase().includes(query) ||
          (m.schedule && m.schedule.toLowerCase().includes(query)) ||
          (m.environment && m.environment.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [monitors, statusFilter, searchQuery]);

  // Aggregate stats
  const okCount = useMemo(() => monitors.filter((m) => m.status === "ok").length, [monitors]);
  const inProgressCount = useMemo(
    () => monitors.filter((m) => m.status === "in_progress").length,
    [monitors],
  );
  const errorCount = useMemo(
    () => monitors.filter((m) => m.status === "error").length,
    [monitors],
  );
  const missedCount = useMemo(
    () => monitors.filter((m) => m.status === "missed").length,
    [monitors],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SimpleFeedHeader
        title="Cron Monitors & Heartbeats"
        description="Track periodic jobs, cron tasks, and single-region workers via standard Sentry check_in envelope items."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showSdkGuide ? "primary" : "secondary"}
              className="gap-1.5 text-xs"
              onClick={() => setShowSdkGuide((prev) => !prev)}
            >
              <Code2 size={14} />
              SDK Integration
            </Button>
            <Button
              type="button"
              variant="primary"
              className="gap-1.5 text-xs"
              onClick={() => {
                setCreateEnv(environment || "production");
                setCreateOpen(true);
              }}
            >
              <Plus size={14} />
              Register Monitor
            </Button>
          </div>
        }
        stats={
          activeProjectId ? (
            <>
              <FeedHeaderStat
                label={monitors.length === 1 ? "monitor" : "monitors"}
                value={monitors.length}
                loading={loading}
              />
              <FeedHeaderStatDot />
              <FeedHeaderStat label="healthy" value={okCount} loading={loading} />
              <FeedHeaderStatDot />
              <FeedHeaderStat label="running" value={inProgressCount} loading={loading} />
              <FeedHeaderStatDot />
              <FeedHeaderStat label="error" value={errorCount} loading={loading} />
              <FeedHeaderStatDot />
              <FeedHeaderStat label="missed" value={missedCount} loading={loading} />
            </>
          ) : null
        }
      />

      <FeedListBody>
        <div className="space-y-4 py-4">
          {/* SDK Guide Expandable Card */}
          {showSdkGuide && (
            <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-sm animate-in fade-in duration-200">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-fg-primary">Sentry SDK Heartbeat Setup</h3>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    Epure seamlessly ingests Sentry <code className="font-mono text-fg-primary">check_in</code> envelopes.
                    Monitors are registered automatically upon first check-in or can be pre-configured below.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-fg-muted"
                  onClick={() => setShowSdkGuide(false)}
                >
                  Close
                </Button>
              </div>

              <Tabs defaultValue="python" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="python" className="text-xs">
                    Python
                  </TabsTrigger>
                  <TabsTrigger value="typescript" className="text-xs">
                    JavaScript / TypeScript
                  </TabsTrigger>
                  <TabsTrigger value="curl" className="text-xs">
                    cURL / Envelope HTTP
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="python" className="space-y-2 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-fg-muted">python cron job</span>
                    <CopyButton
                      value={`import sentry_sdk\n\nsentry_sdk.init(dsn="https://...", environment="production")\n\n# Option 1: Decorator\n@sentry_sdk.monitor(monitor_slug="nightly-backup")\ndef run_nightly_backup():\n    perform_backup()\n\n# Option 2: Manual Check-In ID tracking\ncheck_in_id = sentry_sdk.capture_check_in(\n    monitor_slug="billing-sync",\n    status="in_progress",\n)\ntry:\n    sync_subscriptions()\n    sentry_sdk.capture_check_in(\n        monitor_slug="billing-sync",\n        status="ok",\n        check_in_id=check_in_id,\n    )\nexcept Exception:\n    sentry_sdk.capture_check_in(\n        monitor_slug="billing-sync",\n        status="error",\n        check_in_id=check_in_id,\n    )\n    raise`}
                      label="Copy Snippet"
                    />
                  </div>
                  <pre className="overflow-x-auto rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs text-fg-primary">
{`import sentry_sdk

sentry_sdk.init(dsn="https://...", environment="production")

# Option 1: Decorator
@sentry_sdk.monitor(monitor_slug="nightly-backup")
def run_nightly_backup():
    perform_backup()

# Option 2: Manual Check-In ID tracking
check_in_id = sentry_sdk.capture_check_in(
    monitor_slug="billing-sync",
    status="in_progress",
)
try:
    sync_subscriptions()
    sentry_sdk.capture_check_in(
        monitor_slug="billing-sync",
        status="ok",
        check_in_id=check_in_id,
    )
except Exception:
    sentry_sdk.capture_check_in(
        monitor_slug="billing-sync",
        status="error",
        check_in_id=check_in_id,
    )
    raise`}
                  </pre>
                </TabsContent>

                <TabsContent value="typescript" className="space-y-2 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-fg-muted">node / ts cron job</span>
                    <CopyButton
                      value={`import * as Sentry from "@sentry/node";\n\nSentry.init({ dsn: "https://...", environment: "production" });\n\n// Option 1: Wrap cron job with automatic start/stop and duration\nawait Sentry.withMonitor("nightly-backup", async () => {\n  await runNightlyBackup();\n}, {\n  schedule: { type: "crontab", value: "0 2 * * *" },\n});\n\n// Option 2: Manual Check-In\nconst checkInId = Sentry.captureCheckIn({\n  monitorSlug: "billing-sync",\n  status: "in_progress",\n});\ntry {\n  await syncSubscriptions();\n  Sentry.captureCheckIn({\n    monitorSlug: "billing-sync",\n    status: "ok",\n    checkInId,\n  });\n} catch (err) {\n  Sentry.captureCheckIn({\n    monitorSlug: "billing-sync",\n    status: "error",\n    checkInId,\n  });\n  throw err;\n}`}
                      label="Copy Snippet"
                    />
                  </div>
                  <pre className="overflow-x-auto rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs text-fg-primary">
{`import * as Sentry from "@sentry/node";

Sentry.init({ dsn: "https://...", environment: "production" });

// Option 1: Wrap cron job with automatic start/stop and duration
await Sentry.withMonitor("nightly-backup", async () => {
  await runNightlyBackup();
}, {
  schedule: { type: "crontab", value: "0 2 * * *" },
});

// Option 2: Manual Check-In
const checkInId = Sentry.captureCheckIn({
  monitorSlug: "billing-sync",
  status: "in_progress",
});
try {
  await syncSubscriptions();
  Sentry.captureCheckIn({
    monitorSlug: "billing-sync",
    status: "ok",
    checkInId,
  });
} catch (err) {
  Sentry.captureCheckIn({
    monitorSlug: "billing-sync",
    status: "error",
    checkInId,
  });
  throw err;
}`}
                  </pre>
                </TabsContent>

                <TabsContent value="curl" className="space-y-2 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-fg-muted">raw sentry envelope POST</span>
                    <CopyButton
                      value={`curl -X POST https://api.epure.sh/api/${activeProjectId ?? "PROJECT_ID"}/envelope/ \\\n  -H "Content-Type: application/x-sentry-envelope" \\\n  --data-binary $'{"sent_at":"2026-10-22T22:00:00Z"}\\n{"type":"check_in"}\\n{"monitor_slug":"nightly-backup","status":"ok","duration":1.24,"environment":"production"}\\n'`}
                      label="Copy cURL"
                    />
                  </div>
                  <pre className="overflow-x-auto rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs text-fg-primary">
{`curl -X POST https://api.epure.sh/api/${activeProjectId ?? "PROJECT_ID"}/envelope/ \\
  -H "Content-Type: application/x-sentry-envelope" \\
  --data-binary $'{"sent_at":"2026-10-22T22:00:00Z"}\\n{"type":"check_in"}\\n{"monitor_slug":"nightly-backup","status":"ok","duration":1.24,"environment":"production"}\\n'`}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[240px] flex-1 max-w-sm">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by slug or schedule..."
                leadingIcon={<Search size={14} />}
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "ok", label: "Healthy" },
                  { key: "in_progress", label: "Running" },
                  { key: "error", label: "Error" },
                  { key: "missed", label: "Missed" },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.key}
                  variant={statusFilter === tab.key ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setStatusFilter(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                className="h-7 w-7 p-0 ml-1 text-fg-muted hover:text-fg-primary"
                onClick={() => void loadMonitors()}
                title="Refresh monitors"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : undefined} />
              </Button>
            </div>
          </div>

          {/* Monitors Table */}
          {projectsLoading || loading ? (
            <StackedCardList>
              <CardRowSkeleton />
              <CardRowSkeleton />
              <CardRowSkeleton />
            </StackedCardList>
          ) : error ? (
            <div className="rounded-lg border border-semantic-danger/20 bg-semantic-danger/5 p-4 text-center">
              <p className="text-xs text-semantic-danger">{error}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2 text-xs"
                onClick={() => void loadMonitors()}
              >
                Retry
              </Button>
            </div>
          ) : filteredMonitors.length === 0 ? (
            monitors.length === 0 ? (
              <Empty
                title="No cron monitors registered yet"
                description="Cron monitors track scheduled tasks, background workers, and heartbeats. They will appear here once your SDK sends check-ins or when registered manually."
                action={
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      className="text-xs gap-1.5"
                      onClick={() => {
                        setCreateEnv(environment || "production");
                        setCreateOpen(true);
                      }}
                    >
                      <Plus size={14} />
                      Register First Monitor
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs gap-1.5"
                      onClick={() => setShowSdkGuide(true)}
                    >
                      <Code2 size={14} />
                      View SDK Snippets
                    </Button>
                  </div>
                }
              />
            ) : (
              <Empty
                variant="search"
                title="No monitors match your filters"
                description={`No monitors found matching "${searchQuery}" or status "${statusFilter}".`}
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monitor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMonitors.map((m) => (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => void handleOpenDetails(m)}>
                    <TableCell>
                      <div className="font-mono text-sm font-medium text-fg-primary">{m.slug}</div>
                      {m.environment ? (
                        <div className="font-mono text-[11px] text-fg-muted">{m.environment}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-fg-secondary">
                      {m.schedule || "heartbeat"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-fg-secondary">
                      {m.last_check_in_at ? formatRelativeTime(m.last_check_in_at) : "never"}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-fg-secondary">
                      {formatDuration(m.last_duration_ms)}
                    </TableCell>
                    <TableCell>
                      <ActionButton
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-fg-muted hover:text-escalating"
                        disabled={deletingId === m.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(m.id, m.slug);
                        }}
                        tooltip="Delete monitor"
                      >
                        <Trash2 size={14} />
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </FeedListBody>

      {/* Register Monitor Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register Cron Monitor</DialogTitle>
            <DialogDescription>
              Create a monitor entry ahead of time. Check-ins matching this slug will be mapped to it.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="mt-3 space-y-4">
            <Field
              label="Monitor Slug"
              htmlFor="monitor-slug"
              hint="Unique identifier used in your SDK check_in calls (e.g. nightly-backup, billing-sync)."
            >
              <Input
                id="monitor-slug"
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                placeholder="nightly-backup"
                required
                autoFocus
              />
            </Field>

            <Field
              label="Schedule (Optional)"
              htmlFor="monitor-schedule"
              hint="Crontab expression or descriptive interval (e.g. '0 2 * * *', '@daily', 'every 30m')."
            >
              <Input
                id="monitor-schedule"
                value={createSchedule}
                onChange={(e) => setCreateSchedule(e.target.value)}
                placeholder="0 2 * * *"
              />
            </Field>

            <Field
              label="Environment (Optional)"
              htmlFor="monitor-env"
              hint="Target environment (e.g. production, staging)."
            >
              <Input
                id="monitor-env"
                value={createEnv}
                onChange={(e) => setCreateEnv(e.target.value)}
                placeholder="production"
              />
            </Field>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={createBusy}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={createBusy}>
                {createBusy ? "Registering..." : "Register Monitor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Check-In History Details Dialog */}
      <Dialog
        open={Boolean(selectedMonitor)}
        onOpenChange={(open) => !open && setSelectedMonitor(null)}
      >
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center gap-2">
              {selectedMonitor && <StatusBadge status={selectedMonitor.status} />}
              <DialogTitle className="font-mono text-base">
                {selectedMonitor?.slug}
              </DialogTitle>
            </div>
            <DialogDescription>
              Schedule: <span className="font-mono text-fg-primary">{selectedMonitor?.schedule || "heartbeat"}</span>
              {selectedMonitor?.environment && (
                <> · Environment: <span className="text-fg-primary">{selectedMonitor.environment}</span></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto mt-2 pr-1 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Recent Check-Ins ({historyCheckIns.length})
            </h4>

            {detailsLoading ? (
              <div className="space-y-2 py-4">
                <CardRowSkeleton />
                <CardRowSkeleton />
              </div>
            ) : historyCheckIns.length === 0 ? (
              <p className="py-6 text-center text-xs text-fg-muted">
                No check-in events recorded for this monitor yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border-subtle bg-surface-1">
                <Table className="text-xs">
                  <TableHeader className="bg-surface-2 text-fg-muted">
                    <TableRow>
                      <TableHead className="font-medium">Status</TableHead>
                      <TableHead className="font-medium">Duration</TableHead>
                      <TableHead className="font-medium">Timestamp</TableHead>
                      <TableHead className="font-mono text-2xs font-medium">Check-in ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyCheckIns.map((ci) => (
                      <TableRow key={ci.id} className="hover:bg-state-hover">
                        <TableCell>
                          <StatusBadge status={ci.status} />
                        </TableCell>
                        <TableCell className="font-mono text-fg-primary">
                          {formatDuration(ci.duration_ms)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-fg-muted">
                          {formatRelativeTime(ci.created_at)}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate font-mono text-2xs text-fg-muted">
                          {ci.check_in_id || ci.id.slice(0, 8)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border-subtle shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSelectedMonitor(null)}
              className="text-xs"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
