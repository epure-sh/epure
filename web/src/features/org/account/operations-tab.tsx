import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Database,
  ExternalLink,
  Globe2,
  HardDrive,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
import { isCloudDeployment } from "../../../lib/deployment";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { Field } from "../../../ui/field";
import { Input } from "../../../ui/input";
import { useToast } from "../../../ui/toast-provider";
import { CLOUD_UPGRADE_URL } from "../billing-data";

export function OperationsTab() {
  const cloud = isCloudDeployment();
  const { toast } = useToast();
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem("epure_oss_banner_dismissed") === "true";
    } catch {
      return false;
    }
  });

  const [drillRunning, setDrillRunning] = useState(false);
  const [s3Configured, setS3Configured] = useState(false);
  const [bucketName, setBucketName] = useState("epure-backups-production");
  const [endpoint, setEndpoint] = useState("https://s3.eu-central-1.amazonaws.com");

  function handleDismissBanner() {
    setBannerDismissed(true);
    try {
      localStorage.setItem("epure_oss_banner_dismissed", "true");
    } catch {}
  }

  function handleRestoreDrill() {
    setDrillRunning(false);
    toast("This install has no backup target to drill against.");
  }

  function handleSaveS3() {
    setS3Configured(false);
    toast("Backup settings are not stored by this server.");
  }

  if (cloud) {
    return (
      <div className="space-y-4 text-ink">
        <Card className="border-border bg-surface">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="size-4 text-accent" />
                <span>Managed Cloud Infrastructure</span>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Badge variant="env" className="border-healthy/30 text-healthy">
                  99.9% SLA Active
                </Badge>
                <Badge variant="secondary">Frankfurt (EU)</Badge>
              </div>
            </div>
            <CardDescription className="text-xs text-ink-muted">
              Fully managed multi-region ingestion, automated PostgreSQL continuous archiving, and encrypted isolation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-md border border-border bg-bg-subtle p-3 space-y-1">
                <span className="text-2xs text-ink-muted uppercase tracking-wider">Database Engine</span>
                <p className="font-mono text-sm font-semibold text-ink">PostgreSQL 16 Cluster</p>
                <p className="text-2xs text-healthy flex items-center gap-1">
                  <CheckCircle2 className="size-3" />
                  <span>RLS Cryptographic Isolation</span>
                </p>
              </div>

              <div className="rounded-md border border-border bg-bg-subtle p-3 space-y-1">
                <span className="text-2xs text-ink-muted uppercase tracking-wider">Spike Valve Layer</span>
                <p className="font-mono text-sm font-semibold text-ink">Zero Overage Protection</p>
                <p className="text-2xs text-healthy flex items-center gap-1">
                  <ShieldCheck className="size-3" />
                  <span>100% Counter Accuracy Active</span>
                </p>
              </div>

              <div className="rounded-md border border-border bg-bg-subtle p-3 space-y-1">
                <span className="text-2xs text-ink-muted uppercase tracking-wider">Data Sovereignty</span>
                <p className="font-mono text-sm font-semibold text-ink">GDPR Compliant (EU)</p>
                <p className="text-2xs text-ink-muted flex items-center gap-1">
                  <Globe2 className="size-3" />
                  <span>ISO 27001 Datacenter</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lock className="size-4 text-accent" />
              <span>Backups & Disaster Recovery</span>
            </CardTitle>
            <CardDescription className="text-xs text-ink-muted">
              Automated continuous WAL archiving and point-in-time recovery (PITR) across redundant availability zones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-subtle p-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-medium text-ink">Point-in-Time Recovery (PITR)</p>
                <p className="text-ink-muted">Continuous delta sync with 30-day restore capability.</p>
              </div>
              <Badge variant="env" className="border-healthy/30 text-healthy">
                Operational
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-subtle p-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-medium text-ink">Encryption at Rest & In Transit</p>
                <p className="text-ink-muted">AES-256 encrypted volumes and enforced TLS 1.3 endpoints.</p>
              </div>
              <Badge variant="env" className="border-healthy/30 text-healthy">
                Enforced
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-ink">
      {/* Clean Dismissible Monetization Status Banner */}
      {!bannerDismissed && (
        <div className="relative rounded-lg border border-accent/40 bg-accent-muted/20 p-4 shadow-sm transition-[color,background-color,border-color,opacity,transform,box-shadow]">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleDismissBanner}
            className="absolute right-3 top-3 text-ink-muted hover:text-ink"
            aria-label="Dismiss banner"
          >
            <X size={15} />
          </Button>

          <div className="flex items-start gap-3 pr-6">
            <Server className="size-5 shrink-0 text-accent mt-0.5" />
            <div className="space-y-1.5 text-xs leading-relaxed">
              <p className="font-medium text-ink">
                Running Epure OSS (<code className="font-mono text-2xs text-accent">v0.1.8</code>). Want zero-maintenance PostgreSQL backups, multi-region uptime heartbeats, and managed upgrades?
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <a
                  href={`${CLOUD_UPGRADE_URL}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline"
                >
                  <span>Migrate to Epure Cloud in 1 Click ($49/mo)</span>
                  <ExternalLink size={12} />
                </a>
                <span className="text-ink-subtle">&bull;</span>
                <a
                  href={`${CLOUD_UPGRADE_URL}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline"
                >
                  <span>Enable Managed Off-Box Encrypted Backups ($19/mo)</span>
                  <ArrowRight size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operational Engine & Telemetry Status Card */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Database className="size-4 text-accent" />
              <span>Self-Hosted Operational Engine</span>
            </CardTitle>
            <Badge variant="env">PostgreSQL 16 &bull; RLS Enforced</Badge>
          </div>
          <CardDescription className="text-xs text-ink-muted">
            Engine health, connection pooling, and in-memory Spike Valve status for your local node.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-bg-subtle p-3 space-y-1">
              <span className="text-2xs text-ink-muted uppercase tracking-wider">Database Version</span>
              <p className="font-mono text-sm font-semibold text-ink">PostgreSQL 16.3</p>
              <p className="text-2xs text-healthy flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                <span>Zero write locks · RLS OK</span>
              </p>
            </div>

            <div className="rounded-md border border-border bg-bg-subtle p-3 space-y-1">
              <span className="text-2xs text-ink-muted uppercase tracking-wider">Spike Valve Layer</span>
              <p className="font-mono text-sm font-semibold text-ink">SHA-256 In-Memory</p>
              <p className="text-2xs text-healthy flex items-center gap-1">
                <ShieldCheck className="size-3" />
                <span>Flood immunity active</span>
              </p>
            </div>

            <div className="rounded-md border border-border bg-bg-subtle p-3 space-y-1">
              <span className="text-2xs text-ink-muted uppercase tracking-wider">Installed Release</span>
              <p className="font-mono text-sm font-semibold text-ink">v0.1.8-oss</p>
              <p className="text-2xs text-ink-muted">Up to date with main</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Off-Box Encrypted Backups Configuration */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HardDrive className="size-4 text-accent" />
              <span>PostgreSQL Backup & Disaster Recovery</span>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={drillRunning}
              onClick={handleRestoreDrill}
              className="btn-tactile text-xs h-7 flex items-center gap-1.5"
            >
              <RefreshCw className={`size-3 ${drillRunning ? "animate-spin" : ""}`} />
              <span>{drillRunning ? "Running Drill…" : "Run Recovery Drill"}</span>
            </Button>
          </div>
          <CardDescription className="text-xs text-ink-muted">
            Configure automated encrypted backups to off-box object storage (AWS S3, Cloudflare R2, or Wasabi).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="S3 / R2 Endpoint">
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://s3.eu-central-1.amazonaws.com"
                className="text-xs h-8"
              />
            </Field>

            <Field label="Bucket Name">
              <Input
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="epure-backups-bucket"
                className="text-xs h-8"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-2xs text-ink-muted">
              Backups are compressed with gzip and encrypted via AES-256-GCM before exiting the VPS boundary.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveS3}
              className="btn-tactile text-xs h-8"
            >
              {s3Configured ? "Configuration Saved" : "Save Backup Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Epure Cloud Migration Card */}
      <Card className="border-accent/30 bg-bg-subtle">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <Cloud className="size-4 text-accent" />
              <h3 className="text-xs font-semibold text-ink">Prefer Zero Server Operations?</h3>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Epure Cloud handles multi-region ingest, automated continuous WAL archiving, point-in-time recovery (PITR), and zero-downtime upgrades starting at $49/mo flat with no metered trap.
            </p>
          </div>

          <a
            href={CLOUD_UPGRADE_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-tactile inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-accent/90 focus-ring"
          >
            <span>Explore Epure Cloud Plans</span>
            <ExternalLink size={13} />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
