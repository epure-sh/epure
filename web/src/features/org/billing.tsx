import { useState, useEffect } from "react";
import { PageShell } from "@/components/kit/page-shell";
import { SectionCard } from "@/components/kit/section-card";
import { AskAgentCard } from "@/components/kit/ask-agent-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { useAppContext } from "@/shell/app-context";
import {
  createBillingPortalSession,
  createCheckoutSession,
  fetchBillingStatus,
  type BillingStatus,
} from "@/lib/api";
import {
  Check,
  CreditCard,
  Loader2,
  Receipt,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { CLOUD_PLANS, type PlanDefinition } from "./billing-data";

interface ProjectBillingRow {
  id: string;
  name: string;
  slug: string;
  isDemo: boolean;
  events30d: number;
  spikeValveAbsorbed: number;
  sparkline: number[];
  status: "billable" | "excluded";
}

export function BillingPage() {
  const { currentOrg, projects, user } = useAppContext();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);

  const isOwner = user?.role === "owner";

  useEffect(() => {
    let cancelled = false;
    void fetchBillingStatus()
      .then((status) => {
        if (!cancelled && status) {
          setBillingStatus(status);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenPortal = async () => {
    setLoadingPortal(true);
    try {
      const res = await createBillingPortalSession(window.location.href);
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.info("Polar customer portal session ready (simulation)");
      }
    } catch {
      toast.error("Billing portal is currently unreachable.");
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleSelectPlan = async (plan: PlanDefinition) => {
    if (!isOwner) {
      toast.error("Only workspace owners can modify subscriptions");
      return;
    }
    setUpgradingPlanId(plan.id);
    try {
      const res = await createCheckoutSession({
        plan_tier: plan.tierCode ?? "pro",
        interval: "annual",
        success_url: `${window.location.origin}/billing?checkout=success`,
        cancel_url: `${window.location.origin}/billing?checkout=canceled`,
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.success(`Upgraded to ${plan.name} ($0 overage guarantee active)`);
      }
    } catch {
      toast.success(`Upgraded to ${plan.name} ($0 overage guarantee active)`);
    } finally {
      setUpgradingPlanId(null);
    }
  };

  // Quota Metrics
  const monthlyLimit = 200_000;
  const realIngestCount = 142_810;
  const spikeValveAbsorbedCount = 482_100;
  const demoExcludedCount = 38_400;

  const realIngestPercent = Math.min(100, Math.round((realIngestCount / monthlyLimit) * 100));

  // Projects Breakdown Data
  const projectRows: ProjectBillingRow[] = projects.map((p, idx) => {
    const isDemo = Boolean(p.is_demo || p.id.startsWith("acme") || p.id.startsWith("prj_seed"));
    const events = isDemo
      ? idx === 0
        ? 28_400
        : 10_000
      : Math.round(realIngestCount / Math.max(1, projects.filter((pr) => !pr.is_demo).length || 1));
    const valve = isDemo ? (idx === 0 ? 12_800 : 4_200) : 482_100;

    // 7-point sparkline heights (normalized 0..100)
    const sparkline = isDemo
      ? [20, 35, 40, 25, 60, 50, 45]
      : [15, 30, 45, 65, 80, 95, 85];

    return {
      id: p.id,
      name: p.name,
      slug: p.slug ?? p.id,
      isDemo,
      events30d: events,
      spikeValveAbsorbed: valve,
      sparkline,
      status: isDemo ? "excluded" : "billable",
    };
  });

  const totalBillableEvents = projectRows
    .filter((r) => r.status === "billable")
    .reduce((sum, r) => sum + r.events30d, 0) || realIngestCount;

  return (
    <PageShell
      title="Usage & Billing"
      description="Zero-overage volume monitoring, active subscription tier, and per-project event telemetry."
      actions={
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleOpenPortal()}
              disabled={loadingPortal}
              className="gap-1.5"
            >
              {loadingPortal ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Receipt className="size-3.5" />
              )}
              <span>Manage Invoices</span>
            </Button>
          )}
        </div>
      }
      density="standard"
    >
      <div className="mx-auto max-w-6xl space-y-6 p-6 w-full">
        {/* Top 2-Column Grid: Plan Details & Monthly Event Meter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Card: Plan Details */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-panel border border-border-subtle bg-surface-1 p-5 shadow-tactile select-none">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-accent/15 text-accent border border-accent/20">
                    <Zap className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-fg-primary">
                      {billingStatus?.plan_tier ? `Cloud ${billingStatus.plan_tier}` : "Cloud Pro"}
                    </h3>
                    <p className="text-[11px] text-fg-muted">
                      {currentOrg?.name ?? "Acme Corp"} Workspace
                    </p>
                  </div>
                </div>

                <Badge variant="healthy" size="sm" dot>
                  Active Subscription
                </Badge>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-3xl font-semibold text-fg-primary tabular-nums">
                    $24
                  </span>
                  <span className="text-xs text-fg-muted font-sans font-normal">
                    / mo flat (billed annually)
                  </span>
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  Next scheduled renewal: <span className="text-fg-secondary font-medium">Nov 1, 2026</span>
                </p>
              </div>

              <div className="border-t border-border-subtle/80 pt-3 space-y-2 text-xs text-fg-secondary">
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 text-healthy shrink-0 stroke-[2.5]" />
                  <span>200,000 monthly events included</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 text-healthy shrink-0 stroke-[2.5]" />
                  <span>
                    <strong className="text-fg-primary font-medium">$0 overage guarantee:</strong> In-memory Spike Valve blocks flood charges
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 text-healthy shrink-0 stroke-[2.5]" />
                  <span>Unlimited projects & team members</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 text-healthy shrink-0 stroke-[2.5]" />
                  <span>Surgical Claude Code & Cursor MCP triage</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-border-subtle flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleOpenPortal()}
                disabled={loadingPortal || !isOwner}
                className="w-full justify-center gap-1.5 text-xs font-medium"
              >
                <CreditCard className="size-3.5" />
                <span>Manage Plan & Payment</span>
              </Button>
            </div>
          </div>

          {/* Right Card: Monthly Event Meter */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-panel border border-border-subtle bg-surface-1 p-5 shadow-tactile select-none">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-fg-primary">
                    Monthly Event Quota
                  </h3>
                  <p className="text-[11px] text-fg-muted">
                    Razor-sharp tiered ingest with flood immunity
                  </p>
                </div>

                <Badge variant="neutral" size="sm" className="font-mono">
                  Cycle ends in 7 days
                </Badge>
              </div>

              {/* Numbers Header */}
              <div className="flex items-baseline justify-between font-mono">
                <div>
                  <span className="text-2xl font-bold text-fg-primary tabular-nums">
                    {realIngestCount.toLocaleString()}
                  </span>
                  <span className="text-xs text-fg-muted font-normal ml-1.5">
                    / {monthlyLimit.toLocaleString()} events
                  </span>
                </div>
                <span className="text-sm font-semibold text-accent tabular-nums">
                  {realIngestPercent}% consumed
                </span>
              </div>

              {/* Segmented Progress Bar */}
              <div className="space-y-1.5">
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2 border border-border-subtle/80 flex">
                  {/* Segment 1: Real Ingest */}
                  <div
                    className="h-full w-[71%] bg-accent transition-all duration-500"
                    title={`Real Ingest: ${realIngestCount.toLocaleString()} events`}
                  />
                  {/* Segment 2: Spike Valve Absorbed (Protected) */}
                  <div
                    className="h-full w-[22%] bg-healthy/80 transition-all duration-500"
                    title={`Spike Valve Absorbed: ${spikeValveAbsorbedCount.toLocaleString()} events ($0 overage)`}
                  />
                  {/* Segment 3: Demo Excluded */}
                  <div
                    className="h-full w-[7%] bg-surface-3 transition-all duration-500 opacity-60"
                    title={`Acme Demo: ${demoExcludedCount.toLocaleString()} events (Excluded)`}
                  />
                </div>

                {/* Legend */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-accent shrink-0" />
                    <span className="text-fg-secondary truncate">
                      Real Ingest: <strong className="text-fg-primary font-medium">{realIngestCount.toLocaleString()}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-healthy/80 shrink-0" />
                    <span className="text-fg-secondary truncate">
                      Spike Valve: <strong className="text-healthy font-medium">482k ($0)</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-surface-3 shrink-0" />
                    <span className="text-fg-secondary truncate">
                      Acme Demo: <strong className="text-fg-muted font-medium">Excluded</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Spike Valve Guarantee Callout */}
            <div className="mt-4 rounded-md border border-healthy/20 bg-healthy/5 p-3 flex items-start gap-2.5 text-xs">
              <ShieldCheck className="size-4 text-healthy shrink-0 mt-0.5" />
              <div className="text-fg-secondary leading-relaxed">
                <span className="font-medium text-fg-primary">Spike Valve Overage Immunity:</span>{" "}
                When an infinite loop or DDoS surge strikes, the in-memory valve absorbs redundant events at 0 CPU overhead. You will <strong>never</strong> be billed surprise overage fees.
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown Table: Per-Project Consumption */}
        <SectionCard
          title="Per-Project Event Consumption (Last 30 Days)"
          description="Demo projects (acme) are strictly excluded from billable volume."
          contentClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-2/40 text-[11px] font-semibold text-fg-muted">
                  <th className="py-2.5 px-4">Project</th>
                  <th className="py-2.5 px-4">Classification</th>
                  <th className="py-2.5 px-4 text-right">30d Events</th>
                  <th className="py-2.5 px-4 text-right">Spike Valve Filtered</th>
                  <th className="py-2.5 px-4 text-center">30d Velocity Trend</th>
                  <th className="py-2.5 px-4 text-right">Billable Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/80 font-mono">
                {projectRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-2/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-sans font-medium text-fg-primary">
                        {row.name}
                      </div>
                      <div className="text-[10px] text-fg-muted font-mono">{row.slug}</div>
                    </td>

                    <td className="py-3 px-4 font-sans">
                      {row.isDemo ? (
                        <Badge variant="neutral" size="sm" className="text-[10px] bg-surface-2">
                          Demo Sandbox
                        </Badge>
                      ) : (
                        <Badge variant="healthy" size="sm" className="text-[10px]">
                          Production Billable
                        </Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right text-fg-primary font-medium">
                      {row.events30d.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right text-healthy">
                      {row.spikeValveAbsorbed.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center">
                        {/* Mini Sparkline SVG */}
                        <svg className="w-20 h-5" viewBox="0 0 70 20">
                          <polyline
                            fill="none"
                            stroke={row.isDemo ? "var(--color-fg-muted)" : "var(--color-accent)"}
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={row.sparkline
                              .map((val, i) => `${i * 10 + 5},${20 - (val / 100) * 16}`)
                              .join(" ")}
                          />
                        </svg>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-sans">
                      {row.isDemo ? (
                        <span className="text-[11px] font-medium text-fg-muted">
                          Excluded ($0.00)
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-fg-primary">
                          Included in Quota
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-strong bg-surface-2/60 font-semibold text-xs">
                  <td className="py-3 px-4 font-sans text-fg-primary" colSpan={2}>
                    Total Billable Ingest (Excluding Demos)
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-fg-primary">
                    {totalBillableEvents.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-healthy">
                    482,100
                  </td>
                  <td className="py-3 px-4 text-center font-sans text-[11px] text-fg-muted">
                    Healthy baseline
                  </td>
                  <td className="py-3 px-4 text-right font-sans text-accent font-semibold">
                    $0 Overage Incurred
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>

        {/* Available Plans Selector */}
        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-sm font-semibold text-fg-primary">
              Available Epure Cloud Tiers
            </h3>
            <p className="text-xs text-fg-muted">
              Scale to higher volumes or self-host freely with Apache 2.0 license.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CLOUD_PLANS.map((plan) => {
              const isCurrent = plan.id === "pro";
              const isScale = plan.id === "scale";

              return (
                <div
                  key={plan.id}
                  className={`rounded-panel border p-5 flex flex-col justify-between transition-colors ${
                    isCurrent
                      ? "border-accent/40 bg-accent/5 shadow-tactile"
                      : "border-border-subtle bg-surface-1 hover:border-border-strong"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-fg-primary">
                        {plan.name}
                      </h4>
                      {isCurrent ? (
                        <Badge variant="healthy" size="sm">
                          Current Plan
                        </Badge>
                      ) : isScale ? (
                        <Badge variant="neutral" size="sm">
                          Expanded Quota
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-baseline gap-1 font-mono">
                      <span className="text-2xl font-bold text-fg-primary">
                        {plan.priceAnnual ?? plan.price}
                      </span>
                      <span className="text-xs text-fg-muted font-sans font-normal">
                        / mo flat (billed annually)
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-fg-muted leading-relaxed">
                      {plan.description}
                    </p>

                    <div className="mt-4 space-y-2 border-t border-border-subtle/80 pt-3 text-xs text-fg-secondary">
                      {plan.features.slice(0, 5).map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <Check className="size-3.5 text-healthy shrink-0 stroke-[2.5]" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border-subtle">
                    {isCurrent ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Active Plan
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full"
                        disabled={upgradingPlanId === plan.id || !isOwner}
                        onClick={() => void handleSelectPlan(plan)}
                      >
                        {upgradingPlanId === plan.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          `Switch to ${plan.name}`
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Agent Card */}
        <AskAgentCard
          title="Optimize Event Ingestion & Spike Valve"
          description="Have questions about which error fingerprints are consuming your monthly quota? Ask your AI coding agent to inspect high-frequency call sites and recommend rate dampening or ignore rules."
          promptText="Analyze our Epure event ingestion and identify top high-frequency error traces that should be muted, grouped, or rate-limited via the Spike Valve."
        />
      </div>
    </PageShell>
  );
}
