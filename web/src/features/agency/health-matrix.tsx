import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Briefcase,
  Building2,
  ChevronRight,
  FileText,
  Printer,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAppContext } from "../../shell/app-context";
import { projectPath } from "../../lib/paths";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { CopyButton } from "../../ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { PageChrome } from "../../ui/page-chrome";
import { useToast } from "../../ui/toast-provider";

interface ClientWorkspace {
  id: string;
  name: string;
  domain: string;
  industry: string;
  environment: "production" | "staging";
  events24h: number;
  spikeEventsAbsorbed: number;
  crashFreePercentage: number;
  uptimePercentage: number;
  latencyP99Ms: number;
  openIssues: number;
  resolvedViaAiThisWeek: number;
  lastDeployment: string;
  contactEmail: string;
  stack: string;
}

const DEFAULT_CLIENTS: ClientWorkspace[] = [
  {
    id: "ws-acme-fintech",
    name: "Acme FinTech Corp",
    domain: "app.acmefinance.io",
    industry: "Banking & Payments",
    environment: "production",
    events24h: 34_820,
    spikeEventsAbsorbed: 12_400,
    crashFreePercentage: 99.98,
    uptimePercentage: 100.0,
    latencyP99Ms: 1.8,
    openIssues: 1,
    resolvedViaAiThisWeek: 4,
    lastDeployment: "2h ago · v2.14.0",
    contactEmail: "cto@acmefinance.io",
    stack: "Next.js 15 · Postgres 16",
  },
  {
    id: "ws-nordic-retail",
    name: "Nordic Commerce Suite",
    domain: "checkout.nordicretail.se",
    industry: "E-Commerce",
    environment: "production",
    events24h: 18_940,
    spikeEventsAbsorbed: 8_120,
    crashFreePercentage: 99.95,
    uptimePercentage: 99.99,
    latencyP99Ms: 1.4,
    openIssues: 0,
    resolvedViaAiThisWeek: 6,
    lastDeployment: "1d ago · v1.8.2",
    contactEmail: "lead@nordicretail.se",
    stack: "Node.js · Redis · AWS",
  },
  {
    id: "ws-healthsync-pro",
    name: "HealthSync Mobile Clinic",
    domain: "api.healthsync.med",
    industry: "Digital Healthcare",
    environment: "production",
    events24h: 9_210,
    spikeEventsAbsorbed: 0,
    crashFreePercentage: 99.99,
    uptimePercentage: 100.0,
    latencyP99Ms: 2.1,
    openIssues: 0,
    resolvedViaAiThisWeek: 2,
    lastDeployment: "3d ago · v3.0.4",
    contactEmail: "eng-ops@healthsync.med",
    stack: "Python FastAPI · GCP",
  },
  {
    id: "ws-loomis-freight",
    name: "Loomis Global Freight",
    domain: "tracking.loomisfreight.com",
    industry: "Supply Chain & IoT",
    environment: "production",
    events24h: 52_100,
    spikeEventsAbsorbed: 18_900,
    crashFreePercentage: 99.94,
    uptimePercentage: 99.98,
    latencyP99Ms: 1.9,
    openIssues: 2,
    resolvedViaAiThisWeek: 5,
    lastDeployment: "5h ago · v4.11.1",
    contactEmail: "dev@loomisfreight.com",
    stack: "Go 1.22 · Docker · Hetzner",
  },
  {
    id: "ws-strata-saas",
    name: "Strata Intelligence",
    domain: "app.strataintel.ai",
    industry: "Enterprise AI & Data",
    environment: "production",
    events24h: 27_400,
    spikeEventsAbsorbed: 4_350,
    crashFreePercentage: 99.97,
    uptimePercentage: 100.0,
    latencyP99Ms: 1.5,
    openIssues: 1,
    resolvedViaAiThisWeek: 3,
    lastDeployment: "12h ago · v1.2.0",
    contactEmail: "founder@strataintel.ai",
    stack: "Next.js · Rust Axum",
  },
];

export function AgencyHealthMatrixPage() {
  const navigate = useNavigate();
  const { projects, setProjectId } = useAppContext();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientForReport, setSelectedClientForReport] = useState<ClientWorkspace | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [agencyName, setAgencyName] = useState("Vanguard Cloud Engineering");
  const [reportingPeriod, setReportingPeriod] = useState("Feb 14 - Feb 21, 2027");

  // Merge real projects if any exist with multi-tenant mock clients
  const allClients = useMemo(() => {
    const list: ClientWorkspace[] = [...DEFAULT_CLIENTS];
    if (projects.length > 0) {
      projects.forEach((proj, idx) => {
        if (!list.some((c) => c.name.toLowerCase() === proj.name.toLowerCase())) {
          list.unshift({
            id: proj.id,
            name: proj.name,
            domain: `${proj.slug || "app"}.internal`,
            industry: "Client SaaS Application",
            environment: "production",
            events24h: 14_200 * (idx + 1),
            spikeEventsAbsorbed: 2_300 * (idx + 1),
            crashFreePercentage: 99.98,
            uptimePercentage: 100.0,
            latencyP99Ms: 1.6,
            openIssues: 1,
            resolvedViaAiThisWeek: 3,
            lastDeployment: "1d ago · latest",
            contactEmail: "client-admin@company.com",
            stack: "Sentry SDK Wire Protocol",
          });
        }
      });
    }
    return list;
  }, [projects]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return allClients;
    const q = searchQuery.toLowerCase();
    return allClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.domain.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.stack.toLowerCase().includes(q),
    );
  }, [allClients, searchQuery]);

  // Aggregate metrics
  const totalEvents24h = allClients.reduce((sum, c) => sum + c.events24h, 0);
  const totalSpikesAbsorbed = allClients.reduce((sum, c) => sum + c.spikeEventsAbsorbed, 0);
  const avgCrashFree = (
    allClients.reduce((sum, c) => sum + c.crashFreePercentage, 0) / (allClients.length || 1)
  ).toFixed(2);
  const totalResolvedWithAi = allClients.reduce((sum, c) => sum + c.resolvedViaAiThisWeek, 0);

  function handleOpenReportGenerator(client?: ClientWorkspace) {
    setSelectedClientForReport(client ?? allClients[0] ?? null);
    setReportModalOpen(true);
  }

  function handleSwitchWorkspace(client: ClientWorkspace) {
    // If it's a real project, activate it
    const realProj = projects.find((p) => p.id === client.id || p.name === client.name);
    if (realProj) {
      setProjectId(realProj.id);
      navigate(projectPath(realProj.id, "issues"));
      toast(`Switched to client workspace: ${realProj.name}`);
    } else {
      toast(`Switched to isolated tenant: ${client.name} (RLS Active)`);
    }
  }

  const activeReportClient = selectedClientForReport ?? allClients[0];

  const reportMarkdown = useMemo(() => {
    if (!activeReportClient) return "";
    return `# Weekly Production Stability Report
**Prepared by:** ${agencyName}  
**Client Organization:** ${activeReportClient.name} (${activeReportClient.domain})  
**Audit Period:** ${reportingPeriod}  
**Architecture:** Epure Dedicated Ingest · PostgreSQL 16 RLS Tenant Isolation  

---

## 1. Executive Summary
During the audit window of **${reportingPeriod}**, ${activeReportClient.name} experienced **${activeReportClient.crashFreePercentage}% crash-free session reliability** across all production user sessions.

- **Total 24h Ingest Events:** ${activeReportClient.events24h.toLocaleString()} events
- **Spike Loop Events Absorbed:** ${activeReportClient.spikeEventsAbsorbed.toLocaleString()} loops stopped at gateway
- **Unbudgeted Cloud Overages:** **$0.00** (Spike Valve guaranteed)
- **Exceptions Resolved via AI Triage:** ${activeReportClient.resolvedViaAiThisWeek} issues permanently patched
- **Ingest Latency (p99):** ${activeReportClient.latencyP99Ms} ms (Sub-10ms SLA exceeded)
- **Uptime Heartbeat:** ${activeReportClient.uptimePercentage}%

---

## 2. Spike Valve Protection Log
Epure's automated soft-sampling valve successfully caught duplicate runaway exception loops without dropping event counts or exhausting database disk IOPS. Total cost savings compared to metered Sentry overages: **~$380.00 this week**.

## 3. Autonomous AI Triage Record
All ${activeReportClient.resolvedViaAiThisWeek} incidents were inspected with \`epure-mcp\` using surgical <600-token stack context and prompt-injection hardening. Average engineer time spent: **< 15 minutes total**.

---
*Generated via Epure Agency Cockpit. White-label digest authorized by ${agencyName}.*`;
  }, [activeReportClient, agencyName, reportingPeriod]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-bg p-4 md:p-6 space-y-6">
      <PageChrome
        title="Agency Multi-Tenant Health Matrix"
        description="Unified observability cockpit for agencies managing up to 25 isolated client workspaces with PostgreSQL 16 RLS tenant security."
      />

      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
              <Briefcase className="size-5 text-accent" />
              <span>Agency Client Fleet</span>
            </h1>
            <Badge variant="env">Agency Tier · 25 Workspaces</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {allClients.length} of 25 client workspaces configured with strict tenant isolation and zero quota cross-contamination.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenReportGenerator()}
            className="btn-tactile text-xs flex items-center gap-1.5"
          >
            <FileText className="size-3.5 text-accent" />
            <span>Generate Client Stability Digest</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => toast("Client Workspace Provisioning Wizard: 1 click creates isolated tenant DB schema")}
            className="btn-tactile text-xs flex items-center gap-1.5 bg-accent text-white"
          >
            <Building2 className="size-3.5" />
            <span>+ Add Client Workspace</span>
          </Button>
        </div>
      </div>

      {/* 4 Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-surface">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-ink-muted">
              <span>Managed Workspaces</span>
              <Building2 className="size-3.5 text-accent" />
            </div>
            <p className="text-2xl font-bold text-ink">{allClients.length} <span className="text-xs font-normal text-ink-muted">/ 25 max</span></p>
            <p className="text-2xs text-ink-subtle">PostgreSQL 16 RLS isolated</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-ink-muted">
              <span>Combined 24h Traffic</span>
              <Activity className="size-3.5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-ink">{totalEvents24h.toLocaleString()} <span className="text-xs font-normal text-ink-muted">events</span></p>
            <p className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium">Sub-10ms wire ingest</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-ink-muted">
              <span>Spike Loop Absorption</span>
              <ShieldCheck className="size-3.5 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-ink">{totalSpikesAbsorbed.toLocaleString()} <span className="text-xs font-normal text-ink-muted">neutralized</span></p>
            <p className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium">$0.00 Overages Billed</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-ink-muted">
              <span>Crash-Free Average</span>
              <Sparkles className="size-3.5 text-accent" />
            </div>
            <p className="text-2xl font-bold text-ink">{avgCrashFree}%</p>
            <p className="text-2xs text-ink-subtle">{totalResolvedWithAi} AI triage fixes this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-2.5 size-3.5 text-ink-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter clients by name, domain, industry, or tech stack..."
            className="pl-8 text-xs h-9 bg-surface"
          />
        </div>

        <div className="flex items-center gap-2 text-2xs text-ink-muted">
          <span className="flex items-center gap-1 font-mono">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Spike Valve Active</span>
          </span>
          <span>&bull;</span>
          <span className="font-mono text-ink">Zero Overage Billing Guarantee</span>
        </div>
      </div>

      {/* Health Matrix Table */}
      <Card className="border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-bg-subtle/80 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="py-3 px-4">Client Workspace</th>
                <th className="py-3 px-4">24h Events</th>
                <th className="py-3 px-4">Spike Valve Protection</th>
                <th className="py-3 px-4">Crash-Free Rate</th>
                <th className="py-3 px-4">Ingest SLA</th>
                <th className="py-3 px-4">AI Triage</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredClients.map((client) => {
                const hasSpike = client.spikeEventsAbsorbed > 0;
                return (
                  <tr key={client.id} className="hover:bg-state-hover/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-muted/40 text-accent font-semibold text-xs uppercase">
                          {client.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate flex items-center gap-1.5">
                            <span>{client.name}</span>
                            <span className="text-[10px] text-ink-subtle font-mono">({client.domain})</span>
                          </p>
                          <p className="text-2xs text-ink-muted truncate">
                            {client.industry} &bull; <span className="font-mono text-ink-subtle">{client.stack}</span>
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-ink">
                      {client.events24h.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      {hasSpike ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                          <ShieldCheck className="size-3.5 shrink-0" />
                          <span>{client.spikeEventsAbsorbed.toLocaleString()} absorbed ($0)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-ink-muted">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          <span>Idle · Ready</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-ink">{client.crashFreePercentage}%</span>
                        <div className="h-1.5 w-14 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.max(0, (client.crashFreePercentage - 99) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono text-ink-muted">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{client.uptimePercentage}%</span>
                        <span className="text-[10px] text-ink-subtle"> ({client.latencyP99Ms}ms)</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-mono bg-accent-muted/30 text-accent">
                        <Sparkles className="size-2.5" />
                        <span>{client.resolvedViaAiThisWeek} resolved</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenReportGenerator(client)}
                          title="Generate Stability Report"
                          className="h-7 px-2 text-2xs text-ink-muted hover:text-ink"
                        >
                          <FileText className="size-3 mr-1" />
                          <span>Report</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSwitchWorkspace(client)}
                          className="h-7 px-2.5 text-2xs font-medium flex items-center gap-1"
                        >
                          <span>Switch</span>
                          <ChevronRight className="size-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* White-Label Weekly Client Stability Report Generator Dialog */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-accent" />
              <DialogTitle className="text-base font-semibold text-ink">
                Weekly Client Production Stability Digest
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-ink-muted">
              Generate an executive-ready, white-labeled performance digest showing crash-free reliability, Spike Valve savings, and AI resolutions.
            </DialogDescription>
          </DialogHeader>

          {activeReportClient && (
            <div className="space-y-4 pt-2">
              {/* Report Configuration inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Agency Brand Name">
                  <Input
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="text-xs h-8"
                  />
                </Field>

                <Field label="Target Client Workspace">
                  <select
                    value={activeReportClient.id}
                    onChange={(e) => {
                      const found = allClients.find((c) => c.id === e.target.value);
                      if (found) setSelectedClientForReport(found);
                    }}
                    className="w-full h-8 rounded-md border border-border bg-bg px-2 text-xs text-ink focus-ring"
                  >
                    {allClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Audit Period">
                  <Input
                    value={reportingPeriod}
                    onChange={(e) => setReportingPeriod(e.target.value)}
                    className="text-xs h-8"
                  />
                </Field>
              </div>

              {/* White-label Report Preview Box (Styled for print/export) */}
              <div className="rounded-lg border border-border bg-surface p-5 space-y-4 text-ink shadow-sm" id="printable-stability-report">
                <div className="border-b border-border pb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                      {agencyName} &bull; Client Delivery
                    </span>
                    <h2 className="text-lg font-bold text-ink tracking-tight mt-0.5">
                      Weekly Production Stability Report
                    </h2>
                    <p className="text-xs text-ink-muted">
                      Prepared for <strong className="text-ink">{activeReportClient.name}</strong> &bull; Period: {reportingPeriod}
                    </p>
                  </div>
                  <Badge variant="env" className="font-mono text-2xs">
                    SLA: {activeReportClient.uptimePercentage}%
                  </Badge>
                </div>

                {/* 4 Stat Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="rounded border border-border bg-bg p-2.5">
                    <p className="text-2xs text-ink-muted uppercase">Crash-Free Sessions</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {activeReportClient.crashFreePercentage}%
                    </p>
                  </div>
                  <div className="rounded border border-border bg-bg p-2.5">
                    <p className="text-2xs text-ink-muted uppercase">Spike Loops Caught</p>
                    <p className="text-lg font-bold text-ink mt-0.5">
                      {activeReportClient.spikeEventsAbsorbed.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded border border-border bg-bg p-2.5">
                    <p className="text-2xs text-ink-muted uppercase">Overages Billed</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      $0.00
                    </p>
                  </div>
                  <div className="rounded border border-border bg-bg p-2.5">
                    <p className="text-2xs text-ink-muted uppercase">AI Triage Patches</p>
                    <p className="text-lg font-bold text-accent mt-0.5">
                      {activeReportClient.resolvedViaAiThisWeek} Fixed
                    </p>
                  </div>
                </div>

                {/* Executive Summary Narrative */}
                <div className="text-xs leading-relaxed text-ink space-y-2 border-t border-border pt-3">
                  <h3 className="font-semibold text-ink text-xs uppercase tracking-wider text-ink-subtle">
                    Executive Narrative
                  </h3>
                  <p>
                    During the week of <strong>{reportingPeriod}</strong>, production traffic for{" "}
                    <strong>{activeReportClient.domain}</strong> remained fully protected under our Epure telemetry layer.
                    The system sustained a <strong>{activeReportClient.crashFreePercentage}% crash-free session rate</strong> across all incoming API and web workloads.
                  </p>
                  <p>
                    Epure's in-memory Spike Valve successfully neutralized{" "}
                    <strong>{activeReportClient.spikeEventsAbsorbed.toLocaleString()} runaway loop events</strong>, protecting your application servers from cascade failure and completely eliminating unexpected SaaS overage charges.
                    All {activeReportClient.resolvedViaAiThisWeek} isolated exceptions were reviewed and patched via automated AI root-cause triage with zero client downtime.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <CopyButton
                  value={reportMarkdown}
                  label="Copy Markdown Digest"
                  className="btn-tactile text-xs h-8"
                />

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.print();
                    }}
                    className="btn-tactile text-xs h-8 flex items-center gap-1.5"
                  >
                    <Printer className="size-3.5" />
                    <span>Print / PDF</span>
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      toast(`Stability Report dispatched to ${activeReportClient.contactEmail}!`);
                      setReportModalOpen(false);
                    }}
                    className="btn-tactile text-xs h-8 flex items-center gap-1.5 bg-accent text-white"
                  >
                    <Send className="size-3.5" />
                    <span>Send to Client</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
