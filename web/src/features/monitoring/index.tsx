import * as React from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "@/components/kit/page-shell";
import { TelemetryChart, type TelemetryPoint } from "@/components/kit/telemetry-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/shell/app-context";
import { copyText } from "@/lib/copy-text";
import { toast } from "@/components/ui/sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";

export function MonitoringPage({ isEmbed = false }: { isEmbed?: boolean }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects } = useAppContext();
  const safeProjects = Array.isArray(projects) ? projects : [];
  const project = safeProjects.find((p) => p && (p.id === projectId || p.slug === projectId)) ?? safeProjects[0] ?? null;

  const [shareOpen, setShareOpen] = React.useState(false);
  const [embedCopied, setEmbedCopied] = React.useState(false);

  // Generate 72h telemetry points
  const telemetryData: TelemetryPoint[] = React.useMemo(() => {
    const points: TelemetryPoint[] = [];
    const now = Date.now();
    for (let i = 24; i >= 0; i--) {
      const time = new Date(now - i * 3600000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      // realistic diurnal wave with occasional spikes
      const base = 80 + Math.sin(i / 3) * 40;
      const spike = i === 4 ? 320 : i === 12 ? 190 : 0;
      points.push({
        time,
        value: Math.max(10, Math.floor(base + spike)),
      });
    }
    return points;
  }, []);

  const embedToken = `tok_mon_${(project?.id ?? "demo").slice(0, 8)}`;
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  const embedUrl = `${origin}/embed/monitoring/${embedToken}`;
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="480" frameborder="0"></iframe>`;

  const handleCopyLink = () => {
    void copyText(embedUrl);
    toast.success("Embed link copied to clipboard");
  };

  const handleCopySnippet = () => {
    void copyText(iframeSnippet);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
    toast.success("iframe embed snippet copied to clipboard");
  };

  const content = (
    <div className="flex flex-col gap-6">
      {/* 1. Top Status Header: Error Health Score (99.2%) with emerald dot */}
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-healthy/15 text-healthy">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-healthy animate-pulse" />
                <h2 className="text-base font-semibold text-fg-primary">
                  System Health Score: <span className="font-mono text-healthy font-bold">99.2%</span>
                </h2>
                <Badge variant="healthy" size="sm">
                  Calm
                </Badge>
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                Production is calm. 0 active regressions across release <span className="font-mono font-medium text-fg-secondary">v2.4.1</span>.
              </p>
            </div>
          </div>

          {!isEmbed && (
            <Dialog open={shareOpen} onOpenChange={setShareOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto">
                  <Share2 className="size-3.5" />
                  <span>Share / Embed</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Share Public Telemetry</DialogTitle>
                  <DialogDescription>
                    Provide a read-only live monitoring dashboard for status pages or customer portals.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-fg-primary block mb-1.5">
                      Direct Read-Only Link
                    </label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={embedUrl} size="sm" className="font-mono text-xs" />
                      <Button variant="outline" size="sm" onClick={handleCopyLink}>
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg-primary block mb-1.5">
                      Embeddable HTML iframe Snippet
                    </label>
                    <div className="relative">
                      <textarea
                        readOnly
                        value={iframeSnippet}
                        rows={3}
                        className="w-full rounded-md border border-border-subtle bg-surface-2 p-2.5 font-mono text-xs text-fg-secondary resize-none focus:outline-none"
                      />
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={handleCopySnippet}
                        className="absolute bottom-2 right-2 gap-1"
                      >
                        <Copy className="size-3" />
                        <span>{embedCopied ? "Copied" : "Copy"}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* 2. Three Key Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Exceptions */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg-muted">Total Exceptions (24h)</span>
            <span className="flex items-center text-xs font-medium text-escalating gap-0.5">
              +4.2% <ArrowUpRight className="size-3" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-fg-primary">12,842</span>
            <span className="text-xs text-fg-muted font-mono">events</span>
          </div>
          <p className="mt-1 text-[11px] text-fg-muted">Baseline avg: 12,320 events / day</p>
        </div>

        {/* Affected Users */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg-muted">Affected Users</span>
            <Users className="size-3.5 text-fg-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-fg-primary">420</span>
            <span className="text-xs text-fg-muted font-mono">distinct IDs</span>
          </div>
          <p className="mt-1 text-[11px] text-fg-muted">0.18% of active sessions impacted</p>
        </div>

        {/* Spike Valve Absorbed Events */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg-muted">Spike Valve Flood Protection</span>
            <ShieldCheck className="size-3.5 text-healthy" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-healthy">3,200</span>
            <span className="text-xs text-healthy font-mono">soft-sampled</span>
          </div>
          <p className="mt-1 text-[11px] text-healthy/80 font-medium">$0 quota overage · 100% telemetry preserved</p>
        </div>
      </div>

      {/* 3. Vercel-Style Telemetry Histogram with Release Deployment Marker */}
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Exception Volume Over Time (24h)
            </h3>
            <p className="text-xs text-fg-muted mt-0.5">
              1-minute step area histogram with deployment crosshair correlation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-0.5 text-2xs font-mono text-fg-secondary">
              <span className="size-1.5 rounded-full bg-intent-primary" />
              v2.4.1 deployed 6h ago
            </span>
          </div>
        </div>

        <TelemetryChart data={telemetryData} height={200} color="primary" />
      </div>
    </div>
  );

  if (isEmbed) {
    return (
      <div className="min-h-screen bg-canvas p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">{content}</div>
      </div>
    );
  }

  return (
    <PageShell
      title="Peaceful Monitoring"
      description="Zero-noise health telemetry, error rates, and Spike Valve flood protection."
      density="standard"
    >
      {content}
    </PageShell>
  );
}
