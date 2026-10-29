import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bot,
  Compass,
  Laptop,
  Plus,
  Puzzle,
  ShieldCheck,
  Trash2,
  Zap,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchIngestOutcomes,
  fetchNoisePolicy,
  previewNoisePolicy,
  saveNoisePolicy,
  updateProject,
  type IngestOutcome,
  type NoisePolicy,
} from "../../lib/api";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { useToast } from "../../ui/toast-provider";
import { SectionCard } from "@/components/kit/section-card";
import {
  InfoCallout,
  MemberAccessNotice,
  SettingsSkeleton,
  SettingsStack,
} from "./shared";

interface FilterToggle {
  id: string;
  name: string;
  description: string;
  icon: typeof Bot;
}

const BUILTIN_FILTERS: FilterToggle[] = [
  {
    id: "crawlers",
    name: "Crawlers",
    description: "Search bots & indexers",
    icon: Bot,
  },
  {
    id: "extensions",
    name: "Extensions",
    description: "Browser extension throw sites",
    icon: Puzzle,
  },
  {
    id: "localhost",
    name: "Localhost",
    description: "Local origins on prod traffic",
    icon: Laptop,
  },
  {
    id: "legacy_browsers",
    name: "Legacy browsers",
    description: "Internet Explorer",
    icon: Compass,
  },
  {
    id: "resize_observer",
    name: "ResizeObserver",
    description: "Benign loop notifications",
    icon: ShieldCheck,
  },
  {
    id: "chunk_load",
    name: "Chunk load",
    description: "Missing JS after deploy",
    icon: Zap,
  },
];

const EMPTY_POLICY: NoisePolicy = {
  extensions: false,
  crawlers: false,
  localhost: false,
  legacy_browsers: false,
  resize_observer: false,
  chunk_load: false,
  message_patterns: [],
};

export function InboundFiltersSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { projects, refreshProjects, user, userLoading, projectsLoading } = useAppContext();
  const safeProjects = Array.isArray(projects) ? projects : [];
  const project = safeProjects.find((row) => row && (row.id === paramId || row.slug === paramId)) ?? null;
  const { toast } = useToast();

  const canManage = user?.role === "owner" || user?.role === "admin";

  const [policy, setPolicy] = useState<NoisePolicy>(EMPTY_POLICY);
  const [outcomes, setOutcomes] = useState<IngestOutcome[]>([]);
  const [policyReady, setPolicyReady] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [ingestCap, setIngestCap] = useState<number>(project?.ingest_cap_per_hour ?? 5000);
  const [busyCap, setBusyCap] = useState(false);
  const [testPayload, setTestPayload] = useState("");
  const [simResult, setSimResult] = useState<{ dropped: boolean; reason: string } | null>(null);

  useEffect(() => {
    if (project?.ingest_cap_per_hour != null) {
      setIngestCap(project.ingest_cap_per_hour);
    }
  }, [project?.ingest_cap_per_hour]);

  useEffect(() => {
    if (!project) return;
    setPolicyReady(false);
    let cancelled = false;
    void Promise.all([fetchNoisePolicy(project.id), fetchIngestOutcomes(project.id)])
      .then(([nextPolicy, nextOutcomes]) => {
        if (cancelled) return;
        setPolicy(nextPolicy);
        setOutcomes(nextOutcomes.reasons);
        setPolicyReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          toast("Could not load filters");
          setPolicyReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  const activeFilters: Record<string, boolean> = {
    extensions: policy.extensions,
    crawlers: policy.crawlers,
    localhost: policy.localhost,
    legacy_browsers: policy.legacy_browsers,
    resize_observer: policy.resize_observer,
    chunk_load: policy.chunk_load,
  };
  const patterns = policy.message_patterns;
  const activeCount = Object.values(activeFilters).filter(Boolean).length;

  async function persistPolicy(next: NoisePolicy, success: string) {
    if (!project) return;
    const previous = policy;
    setPolicy(next);
    try {
      setPolicy(await saveNoisePolicy(project.id, next));
      toast(success);
    } catch {
      setPolicy(previous);
      toast("Save failed");
    }
  }

  function toggleFilter(id: string) {
    if (!canManage) return;
    const next = { ...policy, [id]: !activeFilters[id] };
    void persistPolicy(next, next[id as keyof NoisePolicy] ? "Enabled" : "Disabled");
  }

  function handleAddPattern() {
    if (!canManage || !newPattern.trim()) return;
    const trimmed = newPattern.trim();
    if (trimmed.length < 8) {
      toast("Patterns need ≥8 characters");
      return;
    }
    if (patterns.includes(trimmed)) {
      toast("Already added");
      return;
    }
    setNewPattern("");
    void persistPolicy(
      { ...policy, message_patterns: [...patterns, trimmed] },
      "Pattern added",
    );
  }

  function handleRemovePattern(pattern: string) {
    if (!canManage) return;
    void persistPolicy(
      { ...policy, message_patterns: patterns.filter((item) => item !== pattern) },
      "Pattern removed",
    );
  }

  async function handleSaveCap(cap: number) {
    if (!project || !canManage) return;
    setBusyCap(true);
    try {
      await updateProject(project.id, { ingest_cap_per_hour: cap });
      setIngestCap(cap);
      await refreshProjects();
      toast("Cap updated");
    } catch {
      toast("Cap update failed");
    } finally {
      setBusyCap(false);
    }
  }

  async function runSimulation() {
    if (!project || !testPayload.trim()) {
      setSimResult(null);
      return;
    }
    try {
      const result = await previewNoisePolicy(project.id, testPayload.trim());
      setSimResult({
        dropped: result.suppressed,
        reason: result.suppressed
          ? `Rule ${result.rule ?? "noise"}${result.detail ? `: ${result.detail}` : ""}`
          : "Would be stored",
      });
    } catch {
      toast("Preview failed");
    }
  }

  if (projectsLoading || userLoading || (project && !policyReady)) {
    return (
      <SettingsStack>
        <SettingsSkeleton />
      </SettingsStack>
    );
  }

  if (!project) {
    return (
      <SettingsStack>
        <InfoCallout variant="warning">Project not found.</InfoCallout>
      </SettingsStack>
    );
  }

  if (!canManage) {
    return (
      <SettingsStack>
        <MemberAccessNotice resource="filters" />
      </SettingsStack>
    );
  }

  return (
    <SettingsStack>
      <SectionCard
        title="Noise filters"
        description="Server-side suppression. Spikes still alert."
        headerActions={
          <Badge variant="env" size="compact" className="font-mono">
            {activeCount}/{BUILTIN_FILTERS.length}
          </Badge>
        }
        flush
      >
        <ul className="w-full divide-y divide-border-subtle">
          {BUILTIN_FILTERS.map((filter) => {
            const Icon = filter.icon;
            const enabled = Boolean(activeFilters[filter.id]);
            const suppressed =
              outcomes.find((row) => row.reason === `noise:${filter.id}`)?.count ?? 0;
            return (
              <li
                key={filter.id}
                className="flex w-full min-h-10 items-center justify-between gap-3 px-3 py-2 hover:bg-surface-2/40"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Icon size={13} className="shrink-0 text-fg-muted" strokeWidth={1.8} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-fg-primary">{filter.name}</span>
                      {suppressed > 0 ? (
                        <span className="tabular-nums text-2xs text-fg-muted">
                          {suppressed.toLocaleString()}/h
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-2xs text-fg-muted">{filter.description}</p>
                  </div>
                </div>
                <Button
                  variant={enabled ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-2xs"
                  onClick={() => toggleFilter(filter.id)}
                >
                  {enabled ? "On" : "Off"}
                </Button>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title="Message patterns" description="Substring match, ≥8 characters.">
        <div className="w-full space-y-2">
          <div className="flex w-full gap-1.5">
            <Input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="Custom error substring…"
              className="h-8 min-w-0 flex-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPattern();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-8 shrink-0 gap-1 px-2.5"
              onClick={handleAddPattern}
            >
              <Plus size={12} />
              Add
            </Button>
          </div>
          {patterns.length > 0 ? (
            <ul className="w-full space-y-1">
              {patterns.map((pattern) => (
                <li
                  key={pattern}
                  className="flex w-full min-h-7 items-center justify-between gap-2 rounded-md border border-border-subtle px-2 py-1"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-2xs text-fg-primary">
                    {pattern}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleRemovePattern(pattern)}
                    aria-label={`Remove ${pattern}`}
                  >
                    <Trash2 size={12} className="text-fg-muted" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Ingest cap"
        description="Hourly limit before soft-sampling."
        headerActions={
          <Badge variant="env" size="compact" className="font-mono">
            {project.ingest_cap_per_hour.toLocaleString()}/h
          </Badge>
        }
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <Input
            type="number"
            min={100}
            step={500}
            value={ingestCap}
            onChange={(e) => setIngestCap(Number(e.target.value))}
            className="h-8 w-28 font-mono text-xs"
            aria-label="Hourly ingest cap"
          />
          <Button
            variant="secondary"
            size="sm"
            className="h-8"
            disabled={busyCap || ingestCap === project.ingest_cap_per_hour}
            onClick={() => void handleSaveCap(ingestCap)}
          >
            {busyCap ? "…" : "Save"}
          </Button>
          <div className="flex items-center gap-1 border-l border-border-subtle pl-2">
            {[1000, 5000, 25000, 100000].map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="xs"
                onClick={() => {
                  setIngestCap(preset);
                  void handleSaveCap(preset);
                }}
              >
                {(preset / 1000).toFixed(0)}k
              </Button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Simulator" description="Preview a message against saved rules.">
        <div className="w-full space-y-2">
          <div className="flex w-full gap-1.5">
            <Input
              value={testPayload}
              onChange={(e) => {
                setTestPayload(e.target.value);
                setSimResult(null);
              }}
              placeholder="Error message or user-agent…"
              className="h-8 min-w-0 flex-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runSimulation();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-8 shrink-0"
              onClick={() => void runSimulation()}
            >
              Test
            </Button>
          </div>
          {simResult ? (
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs",
                simResult.dropped
                  ? "border-badge-regression-border bg-badge-regression-bg text-regression"
                  : "border-badge-healthy-border bg-badge-healthy-bg text-healthy",
              )}
            >
              {simResult.dropped ? (
                <XCircle size={14} className="mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-semibold">{simResult.dropped ? "Dropped" : "Passed"}</p>
                <p className="text-2xs opacity-90">{simResult.reason}</p>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {outcomes.length > 0 ? (
        <SectionCard title="Outcomes this hour" flush>
          <ul className="w-full divide-y divide-border-subtle">
            {outcomes.map((row) => (
              <li
                key={row.reason}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-2xs"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-fg-muted">{row.reason}</span>
                <span className="shrink-0 tabular-nums text-fg-primary">
                  {row.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </SettingsStack>
  );
}
