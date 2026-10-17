import { useState } from "react";
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
import { updateProject } from "../../lib/api";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { useToast } from "../../ui/toast-provider";
import { InfoCallout, MemberAccessNotice, SettingsTabHeader } from "./shared";

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
    id: "legacy",
    name: "Legacy & Obsolete Browsers",
    description: "Drop JavaScript syntax and polyfill exceptions from unmaintained or legacy browsers.",
    icon: Compass,
    example: "Internet Explorer 11, Safari < 14, Android WebKit < 80",
  },
];

const DEFAULT_PATTERNS = [
  "ResizeObserver loop completed with undelivered notifications",
  "ResizeObserver loop limit exceeded",
  "Script error.",
  "Network request failed",
];

export function InboundFiltersSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { projects, refreshProjects, user } = useAppContext();
  const project = projects.find((row) => row.id === paramId) ?? null;
  const { toast } = useToast();

  const canManage = user?.role === "owner" || user?.role === "admin";

  // Filter Toggles (persisted in project-specific localStorage)
  const storageKey = `epure:filters:${paramId ?? "default"}`;
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return { crawlers: true, extensions: true, localhost: true, legacy: true };
  });

  // Custom Message Patterns
  const patternsKey = `epure:patterns:${paramId ?? "default"}`;
  const [patterns, setPatterns] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(patternsKey);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return DEFAULT_PATTERNS;
  });
  const [newPattern, setNewPattern] = useState("");

  // Spike Valve Cap
  const [ingestCap, setIngestCap] = useState<number>(project?.ingest_cap_per_hour ?? 5000);
  const [busyCap, setBusyCap] = useState(false);

  // Interactive Test Simulator
  const [testPayload, setTestPayload] = useState("");
  const [simResult, setSimResult] = useState<{ dropped: boolean; reason: string } | null>(null);

  function toggleFilter(id: string) {
    if (!canManage) return;
    const next = { ...activeFilters, [id]: !activeFilters[id] };
    setActiveFilters(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
    toast(`Inbound filter rule ${next[id] ? "enabled" : "disabled"}`);
  }

  function handleAddPattern() {
    if (!canManage || !newPattern.trim()) return;
    const trimmed = newPattern.trim();
    if (patterns.includes(trimmed)) {
      toast("Pattern rule already exists");
      return;
    }
    const next = [...patterns, trimmed];
    setPatterns(next);
    try {
      localStorage.setItem(patternsKey, JSON.stringify(next));
    } catch {
      // ignore
    }
    setNewPattern("");
    toast("Filter pattern added");
  }

  function handleRemovePattern(pattern: string) {
    if (!canManage) return;
    const next = patterns.filter((p) => p !== pattern);
    setPatterns(next);
    try {
      localStorage.setItem(patternsKey, JSON.stringify(next));
    } catch {
      // ignore
    }
    toast("Filter pattern removed");
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

  function runSimulation() {
    if (!testPayload.trim()) {
      setSimResult(null);
      return;
    }
    const text = testPayload.toLowerCase();

    // Check crawlers
    if (
      activeFilters.crawlers &&
      (text.includes("googlebot") ||
        text.includes("bingbot") ||
        text.includes("baiduspider") ||
        text.includes("yandex") ||
        text.includes("duckduckbot"))
    ) {
      setSimResult({
        dropped: true,
        reason: "Matched Web Crawlers & Spiders filter (User-Agent spider detected)",
      });
      return;
    }

    // Check extensions
    if (
      activeFilters.extensions &&
      (text.includes("chrome-extension://") ||
        text.includes("moz-extension://") ||
        text.includes("metamask") ||
        text.includes("react_devtools"))
    ) {
      setSimResult({
        dropped: true,
        reason: "Matched Browser Extensions rule (extension scheme detected in stack/URL)",
      });
      return;
    }

    // Check localhost
    if (
      activeFilters.localhost &&
      (text.includes("localhost") || text.includes("127.0.0.1") || text.includes("::1"))
    ) {
      setSimResult({
        dropped: true,
        reason: "Matched Localhost filter (loopback host identified in payload)",
      });
      return;
    }

    // Check custom patterns
    for (const pat of patterns) {
      if (text.includes(pat.toLowerCase())) {
        setSimResult({
          dropped: true,
          reason: `Matched custom rule: "${pat}"`,
        });
        return;
      }
    }

    setSimResult({
      dropped: false,
      reason: "Passed all active noise filters. Event is eligible for ingestion & triage.",
    });
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <SettingsTabHeader
          title="Inbound Filters & Spike Valve"
          description="Control noise filtering and traffic limits."
        />
        <InfoCallout variant="warning">Project not found.</InfoCallout>
      </div>
    );
  }

  if (!canManage) {
    return <MemberAccessNotice resource="inbound noise filters & spike valve" />;
  }

  return (
    <div className="space-y-6">
      <SettingsTabHeader
        title="Inbound Filters & Spike Valve"
        description="Filter web crawlers, browser extensions, localhost leaks, and safeguard storage with burst soft-sampling."
      />

      {/* 1. Automated Noise Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500" />
                <span>Noise Suppression Rules</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Discard unhandled noise before it pollutes your issues feed or triggers webhook alerts.
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
                className="flex items-center justify-between gap-4 p-4 hover:bg-state-hover/40 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ink-muted mt-0.5">
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{filter.name}</span>
                      {enabled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Filtering active
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-subtle">Disabled</span>
                      )}
                    </div>
                    <p className="text-2xs text-ink-muted leading-relaxed">{filter.description}</p>
                    <p className="text-[11px] font-mono text-ink-subtle truncate">
                      Matches: {filter.example}
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
            Filter out benign or third-party error substrings from your application code.
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
                className="flex items-center justify-between rounded-md border border-border/80 bg-surface px-3 py-1.5 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-2xs text-ink truncate">{pattern}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePattern(pattern)}
                  className="text-ink-subtle hover:text-semantic-danger transition-colors p-1"
                  aria-label={`Remove rule for ${pattern}`}
                >
                  <Trash2 size={13} />
                </button>
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
                <Zap size={16} className="text-amber-500" />
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

              <div className="flex items-center gap-1.5 pl-2 border-l border-border/60">
                <span className="text-2xs text-ink-subtle">Presets:</span>
                {[1000, 5000, 25000, 100000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setIngestCap(preset);
                      void handleSaveCap(preset);
                    }}
                    className="btn-tactile rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted hover:border-border-strong hover:text-ink shadow-2xs"
                  >
                    {preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <InfoCallout>
            <strong>Soft-Sampling Policy:</strong> When traffic spikes exceed your cap, Épure does
            not blind you to error volume. The occurrence counter records 100% of the volume for
            metric integrity, while detailed stack frames are sampled to protect VPS storage.
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
              className={`flex items-start gap-2.5 rounded-md border p-3 text-xs ${
                simResult.dropped
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200"
                  : "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
              }`}
            >
              {simResult.dropped ? (
                <XCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
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
    </div>
  );
}
