import { ArrowRight, Check, ExternalLink, Loader2, Receipt, Server, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CLOUD_PLANS,
  CLOUD_UPGRADE_URL,
  PLANS,
  normalizePlanId,
  type PlanDefinition,
  type PlanId,
} from "../billing-data";
import {
  createBillingPortalSession,
  createCheckoutSession,
  fetchBillingStatus,
  fetchHeadlineStats,
  type BillingStatus,
} from "../../../lib/api";
import { isCloudDeployment } from "../../../lib/deployment";
import { usagePath } from "../../../lib/paths";
import { useAppContext } from "../../../shell/app-context";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent } from "../../../ui/card";
import { SectionHeader } from "../../../ui/section";
import { StatBar } from "../../../ui/stat-bar";

const CLOUD_CURRENT_PLAN: PlanId = "builder_pro";

function formatEvents(value: number | null): string {
  if (value === null) {
    return "Unlimited";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return value.toLocaleString();
}

function planById(id: PlanId): PlanDefinition {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}

function WorkspaceUsageStrip() {
  const { projects } = useAppContext();
  const [events7d, setEvents7d] = useState<number | null>(null);
  const [unresolved, setUnresolved] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projects.length === 0) {
      setEvents7d(0);
      setUnresolved(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all(projects.map((project) => fetchHeadlineStats(project.id)))
      .then((stats) => {
        if (cancelled) {
          return;
        }
        setEvents7d(stats.reduce((sum, row) => sum + row.events_7d, 0));
        setUnresolved(stats.reduce((sum, row) => sum + row.unresolved, 0));
      })
      .catch(() => {
        if (!cancelled) {
          setEvents7d(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projects]);

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading usage…</p>;
  }

  if (events7d === null) {
    return <p className="text-sm text-ink-muted">Unable to load usage.</p>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <StatBar
        className="min-w-0 flex-1 rounded-lg border border-border !border-b !px-4 !py-3"
        items={[
          { label: "Events (7d)", value: events7d },
          { label: "Unresolved", value: unresolved },
          { label: "Projects", value: projects.length },
        ]}
      />
      <Button variant="ghost" size="sm" asChild className="shrink-0">
        <Link to={usagePath()} className="gap-1.5 text-xs">
          Usage details
          <ArrowRight size={14} />
        </Link>
      </Button>
    </div>
  );
}

function SelfHostedBilling() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-bg-subtle">
              <Server size={16} className="text-accent" aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-medium text-ink">Self-hosted</h2>
                <Badge variant="env">OSS</Badge>
              </div>
              <p className="text-xs text-ink-muted">Apache 2.0. No subscription on this install.</p>
            </div>
          </div>
          <p className="font-mono text-lg font-medium tabular-nums text-ink">$0</p>
        </CardContent>
      </Card>

      <WorkspaceUsageStrip />

      <p className="text-sm text-ink-muted">
        Want zero-maintenance PostgreSQL backups, multi-region uptime heartbeats, and managed upgrades?{" "}
        <a
          href={CLOUD_UPGRADE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-ink font-medium underline-offset-2 hover:underline"
        >
          Explore Epure Cloud plans (Pro $49, Team Plus $99, Agency $249, Dedicated $399)
          <ExternalLink size={12} className="opacity-70" aria-hidden />
        </a>
        .
      </p>
    </div>
  );
}

function CloudUsageMeter({ monthlyLimit }: { monthlyLimit: number }) {
  const { projects } = useAppContext();
  const [events7d, setEvents7d] = useState<number | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setEvents7d(0);
      return;
    }
    void Promise.all(projects.map((p) => fetchHeadlineStats(p.id)))
      .then((stats) => setEvents7d(stats.reduce((sum, row) => sum + row.events_7d, 0)))
      .catch(() => setEvents7d(null));
  }, [projects]);

  const projected = events7d !== null ? Math.round(events7d * (30 / 7)) : null;
  const percent =
    projected !== null ? Math.min(100, Math.round((projected / monthlyLimit) * 100)) : 0;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <SectionHeader
          title="Included volume"
          description="7-day projection. Soft sampling before hard limits."
        />
        {projected === null ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-lg font-medium tabular-nums text-ink">
                {formatEvents(projected)}
                <span className="text-sm font-normal text-ink-muted">
                  {" "}
                  / {formatEvents(monthlyLimit)} projected
                </span>
              </p>
              <span className="text-xs text-ink-muted">{percent}%</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-bg-subtle"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Projected monthly event usage"
            >
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PlanOptionCard({
  plan,
  isCurrent,
  isAnnual,
  isOwner,
  onSelectPlan,
  isUpgrading,
}: {
  plan: PlanDefinition;
  isCurrent?: boolean;
  isAnnual: boolean;
  isOwner: boolean;
  onSelectPlan: (plan: PlanDefinition) => void;
  isUpgrading?: boolean;
}) {
  const displayPrice = isAnnual ? (plan.priceAnnual ?? plan.price) : (plan.priceMonthly ?? plan.price);
  const displayPeriod = isAnnual ? "/ mo flat (billed annually)" : (plan.period ?? "/ mo flat");

  return (
    <Card
      className={
        plan.highlighted && !isCurrent
          ? "border-accent/40 shadow-sm"
          : isCurrent
            ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm"
            : undefined
      }
    >
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
          {isCurrent ? (
            <Badge variant="env" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              Active Plan
            </Badge>
          ) : null}
          {plan.highlighted && !isCurrent ? (
            <Badge variant="secondary" className="text-2xs uppercase">
              Popular
            </Badge>
          ) : null}
        </div>

        <p className="mt-3 font-mono text-2xl font-medium tabular-nums text-ink">
          {displayPrice}
          <span className="text-xs font-normal text-ink-muted ml-1.5">{displayPeriod}</span>
        </p>

        <p className="mt-1 text-xs text-ink-muted">{plan.description}</p>

        <ul className="mt-4 flex-1 space-y-2 text-xs text-ink-muted">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {isCurrent ? (
          <Button variant="outline" className="mt-4 w-full cursor-default opacity-85" disabled>
            Current active tier
          </Button>
        ) : (
          <Button
            variant={plan.highlighted ? "signal" : "secondary"}
            className="mt-4 w-full"
            disabled={isUpgrading || !isOwner}
            onClick={() => onSelectPlan(plan)}
          >
            {isUpgrading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                Connecting to Polar…
              </span>
            ) : isOwner ? (
              `Upgrade to ${plan.name}`
            ) : (
              "Ask owner to upgrade"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CloudBilling({ isOwner }: { isOwner: boolean }) {
  const [searchParams] = useSearchParams();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [annual, setAnnual] = useState(true);
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkoutParam = searchParams.get("checkout");
  const isMockCheckout = searchParams.get("mock_checkout") === "1";

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

  const activePlanId = normalizePlanId(billingStatus?.plan_tier ?? CLOUD_CURRENT_PLAN);
  const activePlan = planById(activePlanId);
  const monthlyLimit =
    billingStatus?.monthly_events_included && billingStatus.monthly_events_included > 0
      ? billingStatus.monthly_events_included
      : (activePlan.limits.eventsPerMonth ?? 500_000);

  async function handleSelectPlan(targetPlan: PlanDefinition) {
    if (!isOwner) return;
    setUpgradingId(targetPlan.id);
    setError(null);
    try {
      const res = await createCheckoutSession({
        plan_tier: targetPlan.tierCode ?? "pro",
        interval: annual ? "annual" : "monthly",
        success_url: `${window.location.origin}/billing?checkout=success`,
        cancel_url: `${window.location.origin}/billing?checkout=canceled`,
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        throw new Error("No checkout URL returned.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not initiate checkout session. Please try again.");
      setUpgradingId(null);
    }
  }

  async function handleOpenPortal() {
    if (!isOwner) return;
    setPortalLoading(true);
    setError(null);
    try {
      const res = await createBillingPortalSession(`${window.location.origin}/billing`);
      if (res?.url) {
        window.location.href = res.url;
      } else {
        throw new Error("No portal URL returned.");
      }
    } catch {
      setError("Polar customer portal is currently unavailable. Please reach out to billing@epure.sh.");
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Checkout Feedback Alerts */}
      {(checkoutParam === "success" || isMockCheckout) && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
          <ShieldCheck size={16} className="shrink-0 text-emerald-500" />
          <div className="flex-1">
            <span className="font-semibold">Subscription upgraded successfully!</span> Your new monthly event volume and capabilities are active immediately.
          </div>
        </div>
      )}

      {checkoutParam === "canceled" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-subtle p-3.5 text-xs text-ink-muted">
          <span>Checkout was canceled. Your current plan remains active without modifications.</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-3.5 text-xs text-semantic-danger">
          {error}
        </div>
      )}

      {/* Active Subscription Overview Card */}
      <Card className="border-border bg-surface shadow-xs">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-ink">{activePlan.name}</h2>
              <Badge variant="env" className="border-accent/30 text-accent font-medium">
                Official Epure Cloud
              </Badge>
              {billingStatus?.subscription_status && (
                <Badge variant="secondary" className="capitalize text-2xs">
                  {billingStatus.subscription_status}
                </Badge>
              )}
            </div>
            <p className="text-xs text-ink-muted">
              {formatEvents(monthlyLimit)} events / mo included with automatic Spike Valve overage immunity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-2xl font-semibold tabular-nums text-ink">
              {annual ? (activePlan.priceAnnual ?? activePlan.price) : (activePlan.priceMonthly ?? activePlan.price)}
              <span className="text-xs font-normal text-ink-muted ml-1">
                {annual ? "/ mo (annual)" : "/ mo"}
              </span>
            </p>
            {isOwner && billingStatus?.subscription_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="gap-1.5 text-xs"
              >
                {portalLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Receipt size={14} />}
                Manage Invoices
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Usage Projection Meter */}
      <CloudUsageMeter monthlyLimit={monthlyLimit} />

      {/* Plan Selection Section */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            title="Available Plans"
            description={
              isOwner
                ? "Select a tier to upgrade. All plans include $0 overage protection via the Spike Valve."
                : "Workspace owners manage plan upgrades and invoicing."
            }
          />

          {/* Annual vs Monthly Toggle */}
          <div className="inline-flex items-center rounded-lg border border-border bg-bg-subtle p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                annual
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Annual <span className="text-emerald-600 dark:text-emerald-400 font-semibold">(2 Mo Free)</span>
            </button>
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                !annual
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CLOUD_PLANS.map((p) => (
            <PlanOptionCard
              key={p.id}
              plan={p}
              isCurrent={p.id === activePlanId}
              isAnnual={annual}
              isOwner={isOwner}
              onSelectPlan={handleSelectPlan}
              isUpgrading={upgradingId === p.id}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-ink-muted">
        <p>Subscriptions are billed securely via Polar with automated EU VAT receipts and instant activation.</p>
        <a
          href="mailto:sales@epure.sh?subject=Custom%20Enterprise%20Billing"
          className="inline-flex items-center gap-1 font-medium text-ink hover:underline"
        >
          <span>Need custom invoicing or BYOC? Talk to sales</span>
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

export function OrgBillingSettings() {
  const { user } = useAppContext();
  const cloud = isCloudDeployment();
  const isOwner = user?.role === "owner";

  if (!cloud) {
    return <SelfHostedBilling />;
  }

  return <CloudBilling isOwner={isOwner} />;
}
