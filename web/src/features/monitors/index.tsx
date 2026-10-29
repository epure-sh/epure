import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FilterBar } from "@/components/kit/filter-bar";
import {
  MonitorRow,
  MonitorTable,
  type MonitorRowData,
} from "@/components/kit/monitor-row";
import { draftToSchedule } from "@/components/kit/create-monitor";
import { Button } from "@/components/ui/button";
import { Plus, MagnifyingGlass } from "@/components/ui/icon";
import { Empty } from "../../ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteMonitor,
  fetchMonitors,
  updateMonitor,
  type MonitorItem,
} from "@/lib/api";
import { useAppContext } from "../../shell/app-context";
import { useToast } from "../../ui/toast-provider";
import { CardRowSkeleton } from "../../ui/skeleton";
import { FeedListBody } from "../../ui/feed-list-shell";
import { SimpleFeedHeader } from "../../ui/simple-feed-header";
import { CreateMonitorDialog } from "./create-monitor-dialog";
import { EditMonitorDialog } from "./edit-monitor-dialog";
import {
  estimateNextCheckInIso,
  formatCountdown,
  humanizeSchedule,
  parseStoredSchedule,
} from "./schedule";
import { buildSnippet } from "./snippets";

type StatusFilter = "all" | "failing" | "missed" | "running" | "healthy";

function statusRank(m: MonitorItem): number {
  if (m.paused) return 5;
  switch (m.status) {
    case "error":
    case "timeout":
      return 0;
    case "missed":
      return 1;
    case "in_progress":
      return 2;
    case "ok":
      return 3;
    default:
      return 4;
  }
}

function toRowData(m: MonitorItem, now = Date.now()): MonitorRowData {
  const schedule = parseStoredSchedule(m.schedule, m.timezone ?? "UTC");
  const nextIso = m.next_check_in_at ?? estimateNextCheckInIso(schedule);
  return {
    id: m.id,
    name: m.name || m.slug,
    slug: m.slug,
    environment: m.environment,
    status: m.status,
    paused: m.paused,
    scheduleHuman: schedule ? humanizeSchedule(schedule) : "Heartbeat",
    scheduleRaw: m.schedule,
    timezone: m.timezone,
    lastCheckInAt: m.last_check_in_at,
    lastDurationMs: m.last_duration_ms,
    nextLabel: formatCountdown(nextIso, now),
    runs: (m.recent_check_ins ?? []).map((c) => ({
      id: c.id,
      status: c.status,
      duration_ms: c.duration_ms,
      created_at: c.created_at,
      issue_id: c.issue_id ?? null,
    })),
    checkinMarginMins: m.checkin_margin_mins,
    maxRuntimeMins: m.max_runtime_mins,
    failureIssueThreshold: m.failure_issue_threshold,
  };
}

export function MonitorsPage() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { projectId, projects, projectsLoading, environment } = useAppContext();
  const { toast } = useToast();

  const [monitors, setMonitors] = useState<MonitorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MonitorItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject = useMemo(() => {
    const candidate = routeProjectId ?? projectId;
    if (candidate) {
      const match = safeProjects.find(
        (row) => row && (row.id === candidate || row.slug === candidate),
      );
      if (match) return match;
    }
    return safeProjects[0] ?? null;
  }, [routeProjectId, projectId, safeProjects]);

  const activeProjectId = activeProject?.id ?? null;

  const loadMonitors = useCallback(async () => {
    if (projectsLoading) return;
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

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    const failing = monitors.filter(
      (m) => !m.paused && (m.status === "error" || m.status === "timeout"),
    ).length;
    const missed = monitors.filter((m) => !m.paused && m.status === "missed").length;
    const running = monitors.filter((m) => !m.paused && m.status === "in_progress").length;
    const healthy = monitors.filter((m) => !m.paused && m.status === "ok").length;
    return {
      all: monitors.length,
      failing,
      missed,
      running,
      healthy,
    };
  }, [monitors]);

  const filtered = useMemo(() => {
    return monitors
      .filter((m) => {
        if (envFilter !== "all" && (m.environment || "production") !== envFilter) {
          return false;
        }
        if (statusFilter === "failing") {
          if (m.paused || (m.status !== "error" && m.status !== "timeout")) return false;
        } else if (statusFilter === "missed") {
          if (m.paused || m.status !== "missed") return false;
        } else if (statusFilter === "running") {
          if (m.paused || m.status !== "in_progress") return false;
        } else if (statusFilter === "healthy") {
          if (m.paused || m.status !== "ok") return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const hay =
            `${m.name ?? ""} ${m.slug} ${m.schedule ?? ""} ${m.environment ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => statusRank(a) - statusRank(b));
  }, [monitors, statusFilter, searchQuery, envFilter]);

  const upsertLocal = useCallback((item: MonitorItem) => {
    setMonitors((prev) => {
      const rest = prev.filter((m) => m.id !== item.id);
      return [item, ...rest];
    });
  }, []);

  const handlePause = async (monitor: MonitorItem) => {
    try {
      const updated = await updateMonitor(monitor.id, { paused: !monitor.paused });
      upsertLocal({ ...monitor, ...updated, recent_check_ins: monitor.recent_check_ins });
      toast(updated.paused ? `Paused ${monitor.slug}` : `Resumed ${monitor.slug}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update monitor");
    }
  };

  const handleDelete = async (monitor: MonitorItem) => {
    if (!confirm(`Delete monitor "${monitor.slug}" and its check-in history?`)) return;
    try {
      await deleteMonitor(monitor.id);
      setMonitors((prev) => prev.filter((m) => m.id !== monitor.id));
      if (expandedId === monitor.id) setExpandedId(null);
      toast(`Deleted ${monitor.slug}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete monitor");
    }
  };

  const handleCopySnippet = async (monitor: MonitorItem) => {
    const schedule =
      parseStoredSchedule(monitor.schedule, monitor.timezone ?? "UTC") ??
      draftToSchedule({
        templateId: "custom",
        name: "",
        slug: "",
        slugTouched: false,
        environment: "production",
        mode: "interval",
        intervalValue: 15,
        intervalUnit: "minute",
        crontab: "0 * * * *",
        timezone: "UTC",
        checkinMarginMins: 5,
        maxRuntimeMins: 30,
        failureIssueThreshold: 1,
        channelIds: [],
      });
    const text = buildSnippet("node", {
      slug: monitor.slug,
      schedule,
      timezone: monitor.timezone || "UTC",
      checkinMarginMins: monitor.checkin_margin_mins ?? 5,
      maxRuntimeMins: monitor.max_runtime_mins ?? 30,
      environment: monitor.environment || "production",
      projectId: activeProjectId,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast("Snippet copied");
    } catch {
      toast("Could not copy snippet");
    }
  };

  const envs = useMemo(() => {
    const set = new Set<string>();
    for (const m of monitors) {
      if (m.environment) set.add(m.environment);
    }
    if (environment) set.add(environment);
    set.add("production");
    return ["all", ...Array.from(set).sort()];
  }, [monitors, environment]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SimpleFeedHeader
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="gap-1.5"
            onClick={() => setCreateOpen(true)}
            disabled={!activeProjectId}
          >
            <Plus size={14} weight="bold" />
            New monitor
          </Button>
        }
      />

      <FeedListBody>
        <div className="flex flex-col gap-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterBar
              options={[
                { key: "all", label: "All monitors", count: counts.all },
                { key: "failing", label: "Failing / hung", count: counts.failing },
                { key: "missed", label: "Missed", count: counts.missed },
                { key: "running", label: "Running now", count: counts.running },
                { key: "healthy", label: "Healthy", count: counts.healthy },
              ]}
              activeKey={statusFilter}
              onSelect={(key) => setStatusFilter(key as StatusFilter)}
              onReset={() => setStatusFilter("all")}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search slug or name…"
                leadingIcon={<MagnifyingGlass size={14} />}
                className="h-8 w-[220px] text-xs"
              />
              <Select value={envFilter} onValueChange={setEnvFilter}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue placeholder="Environment" />
                </SelectTrigger>
                <SelectContent>
                  {envs.map((env) => (
                    <SelectItem key={env} value={env}>
                      {env === "all" ? "All envs" : env}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {projectsLoading || loading ? (
            <div className="space-y-2">
              <CardRowSkeleton />
              <CardRowSkeleton />
              <CardRowSkeleton />
            </div>
          ) : error ? (
            <Empty
              title="Could not load monitors"
              description={error}
              action={
                <Button type="button" variant="secondary" size="sm" onClick={() => void loadMonitors()}>
                  Retry
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            monitors.length === 0 ? (
              <Empty
                title="No cron monitors yet"
                description="Create a monitor, paste the snippet into your job, and Epure will listen for the first check-in."
                action={
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus size={14} weight="bold" />
                    New monitor
                  </Button>
                }
              />
            ) : (
              <Empty
                variant="search"
                title="No monitors match"
                description="Try another filter or clear search."
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setEnvFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )
          ) : (
            <MonitorTable>
              {filtered.map((m) => (
                <MonitorRow
                  key={m.id}
                  monitor={toRowData(m, nowTick)}
                  expanded={expandedId === m.id}
                  onToggle={() =>
                    setExpandedId((cur) => (cur === m.id ? null : m.id))
                  }
                  onTogglePause={() => void handlePause(m)}
                  onDetails={() => setExpandedId(m.id)}
                  onEdit={() => setEditTarget(m)}
                  onCopySnippet={() => void handleCopySnippet(m)}
                  onDelete={() => void handleDelete(m)}
                />
              ))}
            </MonitorTable>
          )}
        </div>
      </FeedListBody>

      {activeProjectId ? (
        <>
          <CreateMonitorDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            projectId={activeProjectId}
            defaultEnvironment={environment || "production"}
            onCreated={upsertLocal}
            onUpdated={upsertLocal}
          />
          <EditMonitorDialog
            open={Boolean(editTarget)}
            monitor={editTarget}
            onOpenChange={(open) => {
              if (!open) setEditTarget(null);
            }}
            onSaved={upsertLocal}
          />
        </>
      ) : null}
    </div>
  );
}
