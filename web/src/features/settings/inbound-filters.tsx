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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { useToast } from "../../ui/toast-provider";
import { InfoCallout, MemberAccessNotice } from "./shared";
import { AskAgentCard } from "@/components/kit/ask-agent-card";

interface FilterToggle {
  id: string;
  name: string;
  description: string;
  icon: typeof Bot;
  example: string;
}

const BUILTIN_FILTERS: FilterToggle[] = [
  {
    id: "crawlers",
    name: "Web Crawlers & Spiders",
    description: "Discard unhandled runtime errors produced by search engine bots and automated indexers.",
    icon: Bot,
    example: "Googlebot, Bingbot, Baiduspider, YandexBot, DuckDuckBot, PetalBot",
  },
  {
    id: "extensions",
    name: "Browser Extensions & Injected Scripts",
    description: "Suppress errors originating from browser plugins, ad blockers, or third-party web wallet injections.",
    icon: Puzzle,
    example: "chrome-extension://, moz-extension://, MetaMask, React DevTools, Grammarly",
  },
  {
    id: "localhost",
    name: "Localhost & Development Leaks",
    description: "Prevent accidental staging or local test runs from polluting your production telemetry.",
    icon: Laptop,
    example: "Origin localhost, 127.0.0.1, or ::1 on production events",
  },
  {
    id: "legacy_browsers",
    name: "Legacy & Obsolete Browsers",
    description: "Drop exceptions from Internet Explorer. Other old browsers stay visible.",
    icon: Compass,
    example: "MSIE, Trident",
  },
  {
    id: "resize_observer",
    name: "ResizeObserver loop",
    description: "Suppress the browser's benign ResizeObserver notification. A sudden jump still raises an alert.",
    icon: ShieldCheck,
    example: "ResizeObserver loop limit exceeded",
  },
  {
    id: "chunk_load",
    name: "Chunk load after deploy",
    description: "Suppress missing JavaScript chunks. A sharp increase raises an alert instead of staying silent.",
    icon: Zap,
    example: "ChunkLoadError, Loading chunk",
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

  // Spike Valve Cap
  const [ingestCap, setIngestCap] = useState<number>(project?.ingest_cap_per_hour ?? 5000);
  const [busyCap, setBusyCap] = useState(false);

  useEffect(() => {
    if (project?.ingest_cap_per_hour != null) {
      setIngestCap(project.ingest_cap_per_hour);
    }
  }, [project?.ingest_cap_per_hour]);

  useEffect(() => {
    if (!project) {
      return;
    }
    setPolicyReady(false);
    let cancelled = false;
    void Promise.all([fetchNoisePolicy(project.id), fetchIngestOutcomes(project.id)])
      .then(([nextPolicy, nextOutcomes]) => {
        if (cancelled) {
          return;
        }
        setPolicy(nextPolicy);
        setOutcomes(nextOutcomes.reasons);
        setPolicyReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          toast("Could not load ingest filters");
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

  // Interactive Test Simulator
  const [testPayload, setTestPayload] = useState("");
  const [simResult, setSimResult] = useState<{ dropped: boolean; reason: string } | null>(null);

  async function persistPolicy(next: NoisePolicy, success: string) {
    if (!project) {
      return;
    }
    const previous = policy;
    setPolicy(next);
    try {
      const saved = await saveNoisePolicy(project.id, next);
      setPolicy(saved);
      toast(success);
    } catch {
      setPolicy(previous);
      toast("Failed to save filter");
    }
  }

  function toggleFilter(id: string) {
    if (!canManage) return;
    const next = {
      ...policy,
      [id]: !activeFilters[id],
    };
    void persistPolicy(next, `Inbound filter ${next[id as keyof NoisePolicy] ? "enabled" : "disabled"}`);
  }

  function handleAddPattern() {
    if (!canManage || !newPattern.trim()) return;
    const trimmed = newPattern.trim();
    if (trimmed.length < 8) {
      toast("Patterns need at least 8 characters so they cannot hide unrelated errors");
      return;
    }
    if (patterns.includes(trimmed)) {
      toast("Pattern rule already exists");
      return;
    }
    setNewPattern("");
    void persistPolicy(
      { ...policy, message_patterns: [...patterns, trimmed] },
      "Filter pattern added",
    );
  }

  function handleRemovePattern(pattern: string) {
    if (!canManage) return;
    void persistPolicy(
      { ...policy, message_patterns: patterns.filter((item) => item !== pattern) },
      "Filter pattern removed",
    );
  }

  async function handleSaveCap(cap: number) {
    if (!project || !canManage) return;
    setBusyCap(true);
    try {
      await updateProject(project.id, { ingest_cap_per_hour: cap });
      setIngestCap(cap);
      await refreshProjects();
      toast("Spike Valve hourly cap updated");
    } catch {
      toast("Failed to update cap");
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
          ? `Server rule ${result.rule ?? "noise"}${result.detail ? `: ${result.detail}` : ""}`
          : "Passed the saved server rules. The event would be grouped and stored.",
      });
    } catch {
      toast("Could not preview this sample");
    }
  }

  if (projectsLoading || userLoading || (project && !policyReady)) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-lg border border-border-subtle bg-surface-1 animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <InfoCallout variant="warning">Project not found.</InfoCallout>
      </div>
    );
  }

  if (!canManage) {
    return <MemberAccessNotice resource="inbound noise filters & spike valve" />;
  }

  return (
    <div className="space-y-6">
      {outcomes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Ingest outcomes this hour</CardTitle>
            <CardDescription className="text-xs">
              Stored, coalesced, suppressed, duplicate, and rejected events. Client SDK discards show up as client:reason.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {outcomes.map((row) => (
              <div key={row.reason} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-mono text-fg-secondary">{row.reason}</span>
                <span className="tabular-nums text-fg-primary">{row.count.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {/* 1. Automated Noise Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck size={16} className="text-healthy" />
                <span>Noise Suppression Rules</span>
              </CardTitle>
              <CardDescription className="text-xs">
                These rules run on the server. Suppressed events are counted, and a sharp jump raises a noise alert instead of staying hidden.
              </CardDescription>
            </div>
            <Badge variant="env" className="text-2xs font-mono">
              {Object.values(activeFilters).filter(Boolean).length} / {BUILTIN_FILTERS.length} active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-border/60 p-0">
          {BUILTIN_FILTERS.map((filter) => {
            const Icon = filter.icon;
            const enabled = Boolean(activeFilters[filter.id]);
            return (
              <div
                key={filter.id}
                className="flex items-center justify-between gap-4 p-4 hover:bg-surface-2/40 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-1 text-fg-muted mt-0.5">
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-fg-primary">{filter.name}</span>
                      {enabled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-healthy font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-healthy" />
                          Filtering active
                        </span>
                      ) : (
                        <span className="text-[10px] text-fg-muted">Disabled</span>
                      )}
                    </div>
                    <p className="text-2xs text-fg-muted leading-relaxed">{filter.description}</p>
                    <p className="text-[11px] font-mono text-fg-muted truncate">
                      Matches: {filter.example}
                    </p>
                    <p className="text-[11px] tabular-nums text-fg-secondary">
                      {(outcomes.find((row) => row.reason === `noise:${filter.id}`)?.count ?? 0).toLocaleString()} suppressed this hour
                    </p>
                  </div>
                </div>

                <Button
                  variant={enabled ? "secondary" : "outline"}
                  size="sm"
                  className="btn-tactile shrink-0 text-2xs font-medium h-7 px-3"
                  onClick={() => toggleFilter(filter.id)}
                >
                  {enabled ? "Active" : "Enable"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 2. Custom Error Message Suppression */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Custom Message Patterns</CardTitle>
          <CardDescription className="text-xs">
            Substring match, at least 8 characters. Broad phrases such as “Failed to fetch” will hide real outages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="e.g. ResizeObserver loop completed or custom error string…"
              className="text-xs"
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
              className="btn-tactile shrink-0 text-xs gap-1"
              onClick={handleAddPattern}
            >
              <Plus size={13} />
              <span>Add rule</span>
            </Button>
          </div>

          <div className="space-y-1.5 pt-1">
            {patterns.map((pattern) => (
              <div
                key={pattern}
                className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-1 px-3 py-1.5 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-2xs text-fg-primary truncate">{pattern}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemovePattern(pattern)}
                  aria-label={`Remove rule for ${pattern}`}
                >
                  <Trash2 size={13} className="text-fg-muted hover:text-escalating" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3. Spike Valve Rate Protection & Soft-Sampling */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap size={16} className="text-regression" />
                <span>Spike Valve Burst Protection</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Zero bill overages, zero disk depletion. Keeps accurate event counts while soft-sampling payloads.
              </CardDescription>
            </div>
            <Badge variant="env" className="font-mono text-2xs">
              {project.ingest_cap_per_hour.toLocaleString()} ev/hr cap
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Hourly Ingest Cap"
            hint="Maximum events accepted per hour. When exceeded, the Spike Valve engages soft-sampling."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="number"
                min={100}
                step={500}
                value={ingestCap}
                onChange={(e) => setIngestCap(Number(e.target.value))}
                className="w-40 font-mono text-xs"
              />
              <Button
                variant="secondary"
                size="sm"
                className="btn-tactile text-xs"
                disabled={busyCap || ingestCap === project.ingest_cap_per_hour}
                onClick={() => void handleSaveCap(ingestCap)}
              >
                {busyCap ? "Saving…" : "Save cap"}
              </Button>

              <div className="flex items-center gap-1.5 pl-2 border-l border-border-subtle">
                <span className="text-2xs text-fg-muted">Presets:</span>
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
                    {(preset / 1000).toFixed(0)}k/h
                  </Button>
                ))}
              </div>
            </div>
          </Field>

          <InfoCallout>
            <strong>Soft-Sampling Policy:</strong> When traffic spikes exceed your cap, Épure does
            not blind you to error volume. The occurrence counter records 100% of the volume for
            metric integrity, while detailed stack frames are sampled to protect database storage.
          </InfoCallout>
        </CardContent>
      </Card>

      {/* 4. Live Rule Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Interactive Filter Simulator</CardTitle>
          <CardDescription className="text-xs">
            Verify whether an incoming error message or user-agent string will be filtered or passed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={testPayload}
              onChange={(e) => {
                setTestPayload(e.target.value);
                setSimResult(null);
              }}
              placeholder="e.g. TypeError: Cannot read property in chrome-extension://abc/content.js"
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSimulation();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="btn-tactile shrink-0 text-xs"
              onClick={runSimulation}
            >
              Test Rule
            </Button>
          </div>

              {simResult ? (
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-md border p-3 text-xs",
                simResult.dropped
                  ? "border-badge-regression-border bg-badge-regression-bg text-regression"
                  : "border-badge-healthy-border bg-badge-healthy-bg text-healthy",
              )}
            >
              {simResult.dropped ? (
                <XCircle size={16} className="text-regression shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={16} className="text-healthy shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-semibold">
                  {simResult.dropped ? "Dropped by filter (Silenced)" : "Passed Filter (Ingested)"}
                </span>
                <p className="text-2xs opacity-90 leading-relaxed">{simResult.reason}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AskAgentCard
        title="Configure Inbound Filters with AI"
        description="Want to filter out noisy third-party scripts, crawler bots, or CORS errors? Ask your AI coding assistant to configure regex inbound filters."
        promptText="Review our recent noisy errors and suggest inbound regex filters to block browser extensions and crawler noise."
      />
    </div>
  );
}
