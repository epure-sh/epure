import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/kit/page-shell";
import { SectionCard } from "@/components/kit/section-card";
import { AskAgentCard } from "@/components/kit/ask-agent-card";
import { EmptyState } from "@/components/kit/empty-state";
import { TelemetryChart } from "@/components/kit/telemetry-chart";
import { UsageMeterCard } from "@/components/kit/usage-meter-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { useAppContext } from "@/shell/app-context";
import {
  createBillingPortalSession,
  createCheckoutSession,
  fetchBillingStatus,
  syncCheckout,
  type BillingStatus,
} from "@/lib/api";
import { isCloudDeployment } from "@/lib/deployment";
import { Check, CreditCard, Loader2, Receipt, Zap } from "lucide-react";
import { CLOUD_PLANS, type PlanDefinition } from "./billing-data";
import {
  bucketsToTelemetry,
  loadProjectEventUsage,
  monthlyEventLimit,
  planForBillingStatus,
  type ProjectEventUsage,
} from "./project-usage";

function subscriptionBadgeVariant(status: string): "healthy" | "info" | "regression" | "neutral" {
  switch (status) {
    case "active":
      return "healthy";
    case "trialing":
    case "canary":
      return "info";
    case "":
    case "none":
      return "neutral";
    default:
      return "regression";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export function BillingPage() {
  const { currentOrg, projects, user } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [usage, setUsage] = useState<ProjectEventUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);

  const isOwner = user?.role === "owner";
  const cloud = isCloudDeployment();
  const checkoutId = searchParams.get("checkout_id");
  const safeProjects = useMemo(() => (Array.isArray(projects) ? projects : []), [projects]);

  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    let status: BillingStatus | null = null;
    if (checkoutId) {
      status = await syncCheckout(checkoutId).catch(() => null);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("checkout_id");
          return next;
        },
        { replace: true },
      );
    }
    if (!status) {
      status = await fetchBillingStatus();
    }
    setBillingStatus(status);
    setBillingLoading(false);
  }, [checkoutId, setSearchParams]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    let cancelled = false;
    setUsageLoading(true);
    void loadProjectEventUsage(safeProjects, "30d")
      .then((rows) => {
        if (!cancelled) setUsage(rows);
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [safeProjects]);

  const plan = planForBillingStatus(billingStatus);
  const eventLimit = monthlyEventLimit(billingStatus, plan);
  const billableEvents = usage.filter((row) => !row.isDemo).reduce((sum, row) => sum + row.events, 0);
  const demoEvents = usage.filter((row) => row.isDemo).reduce((sum, row) => sum + row.events, 0);
  const trialEndsAt = billingStatus?.canary_expires_at ?? null;
  const maxProjects = billingStatus?.max_projects ?? 0;

  const handleOpenPortal = async () => {
    setLoadingPortal(true);
    try {
      const res = await createBillingPortalSession(window.location.href);
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      toast.error("Billing portal did not return a session.");
    } catch {
      toast.error("Billing portal is currently unreachable.");
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleSelectPlan = async (target: PlanDefinition) => {
    if (!isOwner) {
      toast.error("Only workspace owners can modify subscriptions");
      return;
    }
    setUpgradingPlanId(target.id);
    try {
      const res = await createCheckoutSession({
        plan_tier: target.tierCode ?? "pro",
        interval: "annual",
        success_url: `${window.location.origin}/billing?checkout=success`,
        cancel_url: `${window.location.origin}/billing?checkout=canceled`,
      });
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      toast.error("Checkout did not return a session.");
    } catch {
      toast.error("Could not start checkout. Please try again.");
    } finally {
      setUpgradingPlanId(null);
    }
  };

  return (
    <PageShell
      title="Usage & Billing"
      description="Your subscription, event quota, and per-project event volume."
      actions={
        isOwner && billingStatus?.subscription_id ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleOpenPortal()}
            disabled={loadingPortal}
          >
            {loadingPortal ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Receipt className="size-3.5" />
            )}
            <span>Manage Invoices</span>
          </Button>
        ) : null
      }
      density="standard"
    >
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        {billingLoading ? (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Loading billing status…</span>
          </div>
        ) : !billingStatus ? (
          cloud ? (
            <EmptyState
              title="Billing status unavailable"
              description="We could not load your subscription. Event usage below is still live."
              actionLabel="Retry"
              onAction={() => void loadBilling()}
            />
          ) : (
            <SectionCard
              title="Self-hosted"
              description="This instance is not metered. There is no subscription, quota, or invoice."
            >
              <p className="text-xs text-fg-muted">
                Event volume per project is shown below for capacity planning.
              </p>
            </SectionCard>
          )
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="flex flex-col justify-between rounded-panel border border-border-subtle bg-surface-1 p-5 shadow-tactile lg:col-span-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-md border border-accent/20 bg-accent/15 text-accent">
                      <Zap className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-fg-primary">
                        {plan?.name ?? billingStatus.plan_tier}
                      </h3>
                      {currentOrg?.name ? (
                        <p className="text-[11px] text-fg-muted">{currentOrg.name}</p>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant={subscriptionBadgeVariant(billingStatus.subscription_status)} size="sm" dot>
                    {billingStatus.subscription_status || "No subscription"}
                  </Badge>
                </div>

                {plan?.price ? (
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-3xl font-semibold tabular-nums text-fg-primary">
                      {plan.priceMonthly ?? plan.price}
                    </span>
                    {plan.period ? (
                      <span className="font-sans text-xs font-normal text-fg-muted">{plan.period}</span>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-1 text-xs text-fg-muted">
                  {trialEndsAt ? (
                    <p>
                      Trial {new Date(trialEndsAt).getTime() <= Date.now() ? "ended" : "ends"}{" "}
                      <span className="font-medium tabular-nums text-fg-secondary">{formatDate(trialEndsAt)}</span>
                    </p>
                  ) : null}
                  <p>
                    Projects:{" "}
                    <span className="font-medium tabular-nums text-fg-secondary">
                      {billingStatus.project_count}
                      {maxProjects > 0 ? ` / ${maxProjects}` : " (unlimited)"}
                    </span>
                  </p>
                </div>

                {plan ? (
                  <div className="space-y-2 border-t border-border-subtle/80 pt-3 text-xs text-fg-secondary">
                    {plan.features.slice(0, 4).map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 stroke-[2.5] text-healthy" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {isOwner && billingStatus.subscription_id ? (
                <div className="mt-5 border-t border-border-subtle pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleOpenPortal()}
                    disabled={loadingPortal}
                  >
                    <CreditCard className="size-3.5" />
                    <span>Manage Plan & Payment</span>
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 lg:col-span-7">
              {eventLimit ? (
                <UsageMeterCard label="Billable events (last 30 days)" used={billableEvents} limit={eventLimit} />
              ) : (
                <div className="rounded-panel border border-border-subtle bg-surface-1 p-4 text-xs text-fg-muted shadow-tactile">
                  <span className="font-mono text-2xl font-semibold tabular-nums text-fg-primary">
                    {billableEvents.toLocaleString()}
                  </span>{" "}
                  billable events in the last 30 days · no monthly cap on this plan
                </div>
              )}
              <p className="text-[11px] text-fg-muted">
                Counted from stored events over a rolling 30-day window
                {usageLoading ? " (loading…)" : ""}.
                {demoEvents > 0 ? (
                  <>
                    {" "}
                    Demo projects (
                    <span className="tabular-nums">{demoEvents.toLocaleString()}</span> events) are excluded.
                  </>
                ) : null}
              </p>
            </div>
          </div>
        )}

        <SectionCard
          title="Per-project event volume (last 30 days)"
          description="Demo projects are excluded from billable volume."
          contentClassName="p-0"
        >
          {usageLoading ? (
            <div className="flex items-center gap-2 p-4 text-xs text-fg-muted">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Loading project usage…</span>
            </div>
          ) : usage.length === 0 ? (
            <p className="p-4 text-xs text-fg-muted">No projects yet.</p>
          ) : (
            <Table>
              <TableHeader className="bg-surface-2/40 text-[11px] font-semibold text-fg-muted">
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead className="text-right">30d events</TableHead>
                  <TableHead className="text-center">30d trend</TableHead>
                  <TableHead className="text-right">Unresolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border-subtle/80 font-mono">
                {usage.map((row) => (
                  <TableRow key={row.project.id}>
                    <TableCell>
                      <div className="font-sans font-medium text-fg-primary">{row.project.name}</div>
                      <div className="font-mono text-[10px] text-fg-muted">
                        {row.project.slug ?? row.project.id.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="font-sans">
                      {row.isDemo ? (
                        <Badge variant="neutral" size="sm">Demo (excluded)</Badge>
                      ) : (
                        <Badge variant="healthy" size="sm">Billable</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-fg-primary">
                      {row.stats ? row.events.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      {row.buckets.some((bucket) => bucket.count > 0) ? (
                        <TelemetryChart
                          data={bucketsToTelemetry(row.buckets)}
                          height={24}
                          showAxes={false}
                          color={row.isDemo ? "info" : "primary"}
                          className="mx-auto w-24"
                        />
                      ) : (
                        <div className="text-center text-[11px] text-fg-muted">—</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-fg-secondary">
                      {row.stats ? row.stats.unresolved.toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="text-xs font-semibold">
                <TableRow>
                  <TableCell className="font-sans text-fg-primary" colSpan={2}>
                    Total billable (excluding demos)
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-fg-primary">
                    {billableEvents.toLocaleString()}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </SectionCard>

        {cloud ? (
          <div className="space-y-4 pt-2">
            <div>
              <h3 className="text-sm font-semibold text-fg-primary">Available Epure Cloud tiers</h3>
              <p className="text-xs text-fg-muted">
                Scale to higher volumes or self-host freely with Apache 2.0 license.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {CLOUD_PLANS.map((tier) => {
                const isCurrent = plan?.id === tier.id;
                return (
                  <div
                    key={tier.id}
                    className={
                      isCurrent
                        ? "flex flex-col justify-between rounded-panel border border-accent/40 bg-accent/5 p-5 shadow-tactile"
                        : "flex flex-col justify-between rounded-panel border border-border-subtle bg-surface-1 p-5 transition-colors hover:border-border-strong"
                    }
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-semibold text-fg-primary">{tier.name}</h4>
                        {isCurrent ? (
                          <Badge variant="healthy" size="sm">Current plan</Badge>
                        ) : tier.comingSoon ? (
                          <Badge variant="neutral" size="sm">Coming soon</Badge>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-baseline gap-1 font-mono">
                        <span className="text-2xl font-bold tabular-nums text-fg-primary">
                          {tier.priceAnnual ?? tier.price}
                        </span>
                        <span className="font-sans text-xs font-normal text-fg-muted">
                          / mo (billed annually)
                        </span>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-fg-muted">{tier.description}</p>

                      <div className="mt-4 space-y-2 border-t border-border-subtle/80 pt-3 text-xs text-fg-secondary">
                        {tier.features.slice(0, 5).map((feature) => (
                          <div key={feature} className="flex items-center gap-2">
                            <Check className="size-3.5 shrink-0 stroke-[2.5] text-healthy" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-border-subtle pt-3">
                      {isCurrent ? (
                        <Button variant="outline" size="sm" disabled>
                          Active plan
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={upgradingPlanId === tier.id || !isOwner || tier.comingSoon}
                          onClick={() => void handleSelectPlan(tier)}
                        >
                          {upgradingPlanId === tier.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            `Switch to ${tier.name}`
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <AskAgentCard
          title="Optimize event ingestion"
          description="Have questions about which error fingerprints are consuming your monthly quota? Ask your AI coding agent to inspect high-frequency call sites and recommend rate dampening or ignore rules."
          promptText="Analyze our Epure event ingestion and identify top high-frequency error traces that should be muted, grouped, or rate-limited."
        />
      </div>
    </PageShell>
  );
}
