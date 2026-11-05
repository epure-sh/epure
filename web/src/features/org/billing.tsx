import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { PageShell } from "@/ui/block";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import {
  ChartBar,
  Check,
  CircleNotch,
  Copy,
  CreditCard,
  Icon,
} from "@/components/ui/icon";
import { TelemetryChart } from "@/components/kit/telemetry-chart";
import { copyText } from "@/lib/copy-text";
import { formatCompactCount } from "@/lib/format-count";
import { useAppContext } from "@/shell/app-context";
import {
  createBillingPortalSession,
  createCheckoutSession,
  changeBillingPlan,
  fetchBillingStatus,
  syncCheckout,
  syncBilling,
  type BillingStatus,
} from "@/lib/api";
import { isCloudDeployment } from "@/lib/deployment";
import { CLOUD_PLANS, type PlanDefinition } from "./billing-data";
import {
  bucketsToTelemetry,
  loadProjectEventUsage,
  monthlyEventLimit,
  planForBillingStatus,
  type ProjectEventUsage,
} from "./project-usage";
import {
  USAGE_TIME_WINDOWS,
  type UsageTimeWindow,
} from "./settings/usage-utils";

function subscriptionLabel(status: string): string {
  if (!status || status === "none") return "No subscription";
  return status.replace(/_/g, " ");
}

function subscriptionBadgeVariant(
  status: string,
): "healthy" | "info" | "regression" | "neutral" {
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
  return new Date(iso).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function meterTone(used: number, limit: number): "ok" | "warn" | "danger" {
  if (limit <= 0) return "ok";
  const ratio = used / limit;
  if (ratio >= 0.95) return "danger";
  if (ratio >= 0.8) return "warn";
  return "ok";
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border-subtle bg-surface-1 px-4 py-3">
      <p className="font-mono text-xl font-semibold tabular-nums text-fg-primary">{value}</p>
      <p className="mt-0.5 text-xs text-fg-muted">{label}</p>
      {hint ? <p className="mt-0.5 text-2xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}

export function BillingPage() {
  const navigate = useNavigate();
  const { currentOrg, projects, user, refreshUser } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [usage, setUsage] = useState<ProjectEventUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<UsageTimeWindow>("30d");
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);

  const isOwner = user?.role === "owner";
  const cloud = isCloudDeployment();
  const checkoutId = searchParams.get("checkout_id");
  const orgName = currentOrg?.name ?? user?.org_name ?? "Workspace";
  const safeProjects = useMemo(
    () => (Array.isArray(projects) ? projects : []),
    [projects],
  );

  const entitlement = billingStatus?.entitlement;
  const trialDeadline = billingStatus?.trial_ends_at ?? billingStatus?.canary_expires_at ?? null;
  const inactive = entitlement?.state === "inactive";
  const isTrial = Boolean(
    entitlement
      ? entitlement.state === "trial" || entitlement.reason === "trial_ended"
      : billingStatus?.subscription_status === "trialing" ||
          (!billingStatus?.subscription_id && billingStatus?.canary_expires_at),
  );
  const trialExpired = Boolean(
    entitlement
      ? entitlement.reason === "trial_ended"
      : trialDeadline && new Date(trialDeadline).getTime() <= Date.now(),
  );
  const trialDaysRemaining = useMemo(() => {
    if (entitlement?.trial_days_left != null) return entitlement.trial_days_left;
    if (!trialDeadline) return 0;
    const diff = new Date(trialDeadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [entitlement?.trial_days_left, trialDeadline]);
  const monthlyUsage = billingStatus?.usage;

  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    let status: BillingStatus | null = null;
    if (cloud && isOwner) {
      try {
        status = checkoutId ? await syncCheckout(checkoutId) : await syncBilling();
        if (checkoutId && status?.subscription_id && ["active", "trialing"].includes(status.subscription_status)) {
          setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("checkout_id"); return next; }, { replace: true });
        }
      } catch {
        toast.error("Could not synchronize billing. Your current plan is unchanged; please retry.");
      }
    }
    if (!status) status = cloud ? await fetchBillingStatus() : null;
    setBillingStatus(status);
    if (status) await refreshUser().catch(() => {});
    setBillingLoading(false);
  }, [checkoutId, cloud, isOwner, setSearchParams, refreshUser]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    let cancelled = false;
    setUsageLoading(true);
    void loadProjectEventUsage(safeProjects, timeWindow)
      .then((rows) => {
        if (!cancelled) setUsage(rows);
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [safeProjects, timeWindow]);

  const plan = planForBillingStatus(billingStatus);
  const eventLimit = monthlyEventLimit(billingStatus, plan);
  const billableEvents = usage
    .filter((row) => !row.isDemo)
    .reduce((sum, row) => sum + row.events, 0);
  const demoEvents = usage
    .filter((row) => row.isDemo)
    .reduce((sum, row) => sum + row.events, 0);
  const totalEvents = billableEvents + demoEvents;
  /** Self-host has no invoice — show all events. Cloud meters billable only. */
  const displayEvents = cloud ? billableEvents : totalEvents;
  const unresolvedTotal = usage.reduce(
    (sum, row) => sum + (row.stats?.unresolved ?? 0),
    0,
  );
  const projectCount = usage.length;
  const windowLabel =
    USAGE_TIME_WINDOWS.find((option) => option.value === timeWindow)?.label ??
    "Last 30 days";
  const tone = eventLimit ? meterTone(billableEvents, eventLimit) : "ok";
  const meterPercent =
    eventLimit && eventLimit > 0
      ? Math.min(100, Math.round((billableEvents / eventLimit) * 100))
      : 0;

  const summaryText = useMemo(() => {
    const lines = [
      `Epure usage · ${orgName}`,
      cloud
        ? `${windowLabel}: ${billableEvents.toLocaleString()} billable events` +
          (demoEvents > 0 ? ` (${demoEvents.toLocaleString()} demo excluded)` : "")
        : `${windowLabel}: ${totalEvents.toLocaleString()} events`,
      `Projects: ${projectCount} · Unresolved: ${unresolvedTotal}`,
    ];
    if (cloud && plan) {
      lines.push(
        `Plan: ${plan.name} · ${subscriptionLabel(billingStatus?.subscription_status ?? "")}`,
      );
      if (eventLimit) {
        lines.push(
          `Quota: ${billableEvents.toLocaleString()} / ${eventLimit.toLocaleString()}`,
        );
      }
    } else {
      lines.push("Deployment: self-hosted (not metered)");
    }
    for (const row of usage) {
      lines.push(
        `- ${row.project.name}: ${row.events.toLocaleString()} events` +
          (row.isDemo ? " (demo)" : ""),
      );
    }
    return lines.join("\n");
  }, [
    billableEvents,
    billingStatus?.subscription_status,
    cloud,
    demoEvents,
    eventLimit,
    orgName,
    plan,
    projectCount,
    totalEvents,
    unresolvedTotal,
    usage,
    windowLabel,
  ]);

  const handleOpenPortal = async () => {
    if (!cloud) {
      toast.error("Billing portal is only available on Epure Cloud.");
      return;
    }
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
    if (!cloud) {
      toast.error("Checkout is only available on Epure Cloud.");
      return;
    }
    if (!isOwner) {
      toast.error("Only workspace owners can modify subscriptions");
      return;
    }
    setUpgradingPlanId(target.id);
    try {
      if (billingStatus?.subscription_id || billingStatus?.subscription_status === "past_due") {
        const updated = await changeBillingPlan(target.tierCode ?? "pro");
        setBillingStatus(updated);
        await refreshUser().catch(() => {});
        toast.success(updated.subscription?.pending_update ? "Plan change scheduled for your next billing period." : "Your plan has been updated.");
        return;
      }
      const res = await createCheckoutSession({
        plan_tier: target.tierCode ?? "pro",
        interval: "monthly",
        success_url: `${window.location.origin}/billing?checkout=success&checkout_id={CHECKOUT_ID}`,
        cancel_url: `${window.location.origin}/billing?checkout=canceled`,
      });
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      toast.error("Checkout did not return a session.");
    } catch {
      toast.error("Could not update billing. Check your payment method or retry.");
    } finally {
      setUpgradingPlanId(null);
    }
  };

  async function handleCopySummary() {
    if (!summaryText || usageLoading) return;
    const ok = await copyText(summaryText);
    if (ok) toast.success("Usage summary copied");
    else toast.error("Could not copy");
  }

  return (
    <PageShell density="standard">
      <Box flexDirection="column" gap="l" width="100%" padding="l">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Text as="h2" variant="heading-xs">
              Usage & Billing
            </Text>
            {!billingLoading && !cloud ? (
              <Badge variant="neutral" size="compact">
                Self-hosted
              </Badge>
            ) : null}
            {!billingLoading && cloud ? (
              <Badge
                variant={inactive ? "regression" : isTrial ? "info" : subscriptionBadgeVariant(billingStatus?.subscription_status ?? "")}
                size="compact"
              >
                {inactive && !trialExpired ? "Inactive" : isTrial ? (trialExpired ? "Trial ended" : "Trial") : (plan?.name ?? "Cloud")}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={timeWindow}
              onValueChange={(value) => setTimeWindow(value as UsageTimeWindow)}
            >
              <SelectTrigger aria-label="Time range" className="h-7 w-[8.5rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USAGE_TIME_WINDOWS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={usageLoading || !summaryText}
              onClick={() => void handleCopySummary()}
            >
              <Icon icon={Copy} size={14} />
              Copy
            </Button>
            {cloud && isOwner && (billingStatus?.subscription_id || ["past_due", "canceled", "unpaid"].includes(billingStatus?.subscription_status ?? "")) ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loadingPortal}
                onClick={() => void handleOpenPortal()}
              >
                {loadingPortal ? (
                  <Icon icon={CircleNotch} size={14} className="animate-spin" />
                ) : (
                  <Icon icon={CreditCard} size={14} />
                )}
                Manage billing
              </Button>
            ) : null}
          </div>
        </div>

        <p className="max-w-2xl text-xs text-fg-muted">
          {cloud
            ? `Plan, quota, and event volume for ${orgName}.`
            : `Event volume for ${orgName}. Self-hosted instances are not metered. No subscription or invoice.`}
        </p>

        {billingStatus?.subscription?.pending_update ? (
          <Box><Text variant="body">Plan change scheduled for {new Date(billingStatus.subscription.pending_update.applies_at).toLocaleDateString()}.</Text></Box>
        ) : null}
        {billingStatus?.subscription?.cancel_at_period_end ? (
          <Box><Text variant="body">Your subscription ends on {new Date(billingStatus.subscription.current_period_end).toLocaleDateString()}.</Text></Box>
        ) : null}
        {billingStatus?.sync?.last_error ? (
          <Box><Text variant="body">Billing updates are delayed. Automatic retries are running.</Text></Box>
        ) : null}
        {/* Plan / deployment status */}
        {billingLoading ? (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Icon icon={CircleNotch} size={14} className="animate-spin" />
            Loading…
          </div>
        ) : cloud && !billingStatus ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-1 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-fg-primary">Billing unavailable</p>
              <p className="text-2xs text-fg-muted">
                Could not load subscription. Usage below is still live.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void loadBilling()}>
              Retry
            </Button>
          </div>
        ) : cloud && billingStatus ? (
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
            <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-fg-primary">
                    {inactive && !trialExpired ? "No active plan" : isTrial ? "Cloud trial" : (plan?.name ?? billingStatus.plan_tier)}
                  </p>
                  <Badge
                    variant={inactive ? "regression" : isTrial ? "info" : subscriptionBadgeVariant(billingStatus.subscription_status)}
                    size="compact"
                  >
                    {inactive && !trialExpired ? "Inactive" : isTrial ? (trialExpired ? "Trial ended" : "Trial") : subscriptionLabel(billingStatus.subscription_status)}
                  </Badge>
                </div>
                {inactive ? (
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-fg-primary">
                      {entitlement?.reason === "trial_ended"
                        ? "Your trial has ended. New events are not accepted."
                        : entitlement?.reason === "paused"
                          ? "Subscription paused. New events are not accepted."
                          : entitlement?.reason === "canceled"
                            ? "Subscription ended. New events are not accepted."
                            : "Choose a plan to start sending events."}
                    </p>
                    <p className="text-2xs text-fg-muted">
                      Your issues and history stay readable. Pick a plan below to resume.
                    </p>
                  </div>
                ) : isTrial ? (
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-fg-primary tabular-nums">
                      {`${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} left in your trial`}
                    </p>
                    <p className="text-2xs text-fg-muted">
                      Pro limits during the trial. No card on file. Choose a plan any time to keep going.
                    </p>
                  </div>
                ) : (plan?.priceAnnual || plan?.priceMonthly) ? (
                  <p className="font-mono text-2xl font-semibold tabular-nums text-fg-primary">
                    {plan.priceAnnual ?? plan.priceMonthly}
                    <span className="ml-1 font-sans text-xs font-normal text-fg-muted">
                      / mo · billed monthly
                    </span>
                  </p>
                ) : null}
                <p className="text-2xs text-fg-muted">
                  {trialDeadline && isTrial ? (
                    <>
                      Trial{" "}
                      {new Date(trialDeadline).getTime() <= Date.now()
                        ? "ended"
                        : "ends"}{" "}
                      {formatDate(trialDeadline)}
                      {" · "}
                    </>
                  ) : null}
                  Projects{" "}
                  <span className="tabular-nums text-fg-secondary">
                    {billingStatus.project_count}
                    {billingStatus.max_projects > 0
                      ? ` / ${billingStatus.max_projects}`
                      : " · unlimited"}
                  </span>
                </p>
              </div>
              {plan ? (
                <ul className="grid gap-1.5 text-xs text-fg-secondary sm:max-w-xs">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <Icon icon={Check} size={12} className="mt-0.5 shrink-0 text-healthy" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {eventLimit ? (
              <div className="space-y-2 border-t border-border-subtle px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-fg-primary">
                    Billable events · {windowLabel.toLowerCase()}
                  </p>
                  <p className="font-mono text-xs tabular-nums text-fg-muted">
                    {billableEvents.toLocaleString()} / {eventLimit.toLocaleString()}
                    <span className="ml-2 text-fg-secondary">{meterPercent}%</span>
                  </p>
                </div>
                <Progress
                  value={meterPercent}
                  className="h-1.5"
                  indicatorClassName={
                    tone === "danger"
                      ? "bg-semantic-danger"
                      : tone === "warn"
                        ? "bg-semantic-warning"
                        : "bg-accent"
                  }
                />
                {monthlyUsage && monthlyUsage.included > 0 ? (
                  <p className="text-2xs text-fg-muted">
                    This month:{" "}
                    <span className="font-mono tabular-nums text-fg-secondary">
                      {monthlyUsage.events_this_month.toLocaleString()} / {monthlyUsage.included.toLocaleString()}
                    </span>{" "}
                    stored events across all projects.
                    {monthlyUsage.grace_exhausted
                      ? " Quota and new-issue grace used up: existing issues are still counted, new issues wait for next month or a larger plan."
                      : monthlyUsage.over_quota
                        ? " Quota reached: every occurrence is still counted and the first event of each new issue is kept. No automatic overage."
                        : " Past the quota, Epure keeps counting and keeps first events of new issues. No automatic overage."}
                  </p>
                ) : null}
                {demoEvents > 0 ? (
                  <p className="text-2xs text-fg-muted">
                    Demo projects excluded (
                    <span className="tabular-nums">{demoEvents.toLocaleString()}</span> events).
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="border-t border-border-subtle px-4 py-3 text-xs text-fg-muted">
                <span className="font-mono text-lg font-semibold tabular-nums text-fg-primary">
                  {formatCompactCount(billableEvents)}
                </span>{" "}
                billable events · no monthly cap on this plan
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-4 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-muted">
              <Icon icon={ChartBar} size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg-primary">Self-hosted · not metered</p>
              <p className="text-2xs text-fg-muted">
                Volume below is for capacity planning. No subscription, quota, or invoice.
              </p>
            </div>
          </div>
        )}

        {/* Snapshot metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {usageLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[4.5rem] animate-pulse rounded-lg border border-border-subtle bg-surface-2/60"
              />
            ))
          ) : (
            <>
              <Metric
                label={cloud ? "Billable events" : "Events"}
                value={formatCompactCount(displayEvents)}
                hint={windowLabel}
              />
              <Metric
                label="Projects"
                value={String(projectCount)}
                hint={
                  demoEvents > 0
                    ? `${usage.filter((r) => r.isDemo).length} demo`
                    : undefined
                }
              />
              <Metric label="Unresolved" value={formatCompactCount(unresolvedTotal)} />
              <Metric
                label={eventLimit ? "Quota used" : "Metering"}
                value={eventLimit ? `${meterPercent}%` : "Off"}
                hint={
                  eventLimit
                    ? `${formatCompactCount(eventLimit)} / mo`
                    : "Self-hosted"
                }
              />
            </>
          )}
        </div>

        {/* Per-project list */}
        <div className="w-full overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5">
            <p className="text-xs font-medium text-fg-primary">Projects</p>
            <p className="text-2xs text-fg-muted">
              {usageLoading
                ? "Loading…"
                : `${projectCount} project${projectCount === 1 ? "" : "s"} · ${windowLabel.toLowerCase()}`}
            </p>
          </div>

          {usageLoading ? (
            <div className="space-y-0 divide-y divide-border-subtle">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-36 animate-pulse rounded bg-surface-2" />
                    <div className="h-2.5 w-24 animate-pulse rounded bg-surface-2" />
                  </div>
                  <div className="h-6 w-20 animate-pulse rounded bg-surface-2" />
                </div>
              ))}
            </div>
          ) : usage.length === 0 ? (
            <EmptyState
              layout="inset"
              tone="first-run"
              title="No projects yet"
              description="Create a project to start collecting events. Usage will show up here as soon as they land."
              hint="Self-hosted or Cloud: volume always stays visible for planning."
              actionLabel="Go to projects"
              onAction={() => navigate("/")}
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {usage.map((row) => (
                <li
                  key={row.project.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-medium text-fg-primary">
                        {row.project.name}
                      </p>
                      {row.isDemo ? (
                        <Badge variant="neutral" size="compact">
                          Demo
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate font-mono text-2xs text-fg-muted">
                      {row.project.slug ?? row.project.id.slice(0, 8)}
                    </p>
                  </div>

                  <div className="hidden w-24 shrink-0 sm:block">
                    {row.buckets.some((bucket) => bucket.count > 0) ? (
                      <TelemetryChart
                        data={bucketsToTelemetry(row.buckets)}
                        height={22}
                        showAxes={false}
                        color={row.isDemo ? "info" : "primary"}
                        className="w-full"
                      />
                    ) : (
                      <span className="text-2xs text-fg-muted">-</span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-baseline gap-4 text-right">
                    <div>
                      <p className="font-mono text-xs font-medium tabular-nums text-fg-primary">
                        {row.stats ? formatCompactCount(row.events) : "-"}
                      </p>
                      <p className="text-2xs text-fg-muted">events</p>
                    </div>
                    <div className="w-12">
                      <p className="font-mono text-xs tabular-nums text-fg-secondary">
                        {row.stats ? formatCompactCount(row.stats.unresolved) : "-"}
                      </p>
                      <p className="text-2xs text-fg-muted">open</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!usageLoading && usage.length > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t border-border-subtle bg-surface-2/40 px-4 py-2.5">
              <p className="text-2xs text-fg-muted">
                {cloud ? "Billable total (demos excluded)" : "Total events"}
              </p>
              <p className="font-mono text-xs font-semibold tabular-nums text-fg-primary">
                {(cloud ? billableEvents : totalEvents).toLocaleString()}
              </p>
            </div>
          ) : null}
        </div>

        {/* Cloud plans. secondary */}
        {cloud ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-fg-primary">Cloud plans</p>
              <p className="text-2xs text-fg-muted">
                Flat monthly price. Zero automatic overages.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {CLOUD_PLANS.map((tier) => {
                const isCurrent = plan?.id === tier.id;
                const isPaidActive = isCurrent && !isTrial;
                const isTrialFeatureSet = isCurrent && isTrial;
                return (
                  <div
                    key={tier.id}
                    className={
                      isPaidActive
                        ? "flex flex-col rounded-lg border border-accent/40 bg-accent/5 p-4"
                        : isTrialFeatureSet
                          ? "flex flex-col rounded-lg border border-border-subtle bg-surface-1 p-4"
                          : "flex flex-col rounded-lg border border-border-subtle bg-surface-1 p-4"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-fg-primary">{tier.name}</p>
                      {isPaidActive ? (
                        <Badge variant="healthy" size="compact">
                          Active
                        </Badge>
                      ) : isTrialFeatureSet ? (
                        <Badge variant="info" size="compact">
                          Trial capability
                        </Badge>
                      ) : tier.comingSoon ? (
                        <Badge variant="neutral" size="compact">
                          Soon
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-fg-primary">
                      {tier.priceAnnual ?? tier.price}
                      <span className="ml-1 font-sans text-xs font-normal text-fg-muted">
                        / mo · monthly
                      </span>
                    </p>
                    <p className="mt-1 text-2xs leading-relaxed text-fg-muted">
                      {tier.description}
                    </p>
                    <ul className="mt-3 space-y-1.5 border-t border-border-subtle pt-3 text-xs text-fg-secondary">
                      {tier.features.slice(0, 4).map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5">
                          <Icon icon={Check} size={12} className="mt-0.5 shrink-0 text-healthy" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      {isPaidActive ? (
                        <Button type="button" variant="outline" size="sm" disabled>
                          Active
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={
                            upgradingPlanId !== null || !isOwner || Boolean(tier.comingSoon)
                          }
                          onClick={() => void handleSelectPlan(tier)}
                        >
                          {upgradingPlanId === tier.id ? (
                            <Icon icon={CircleNotch} size={14} className="animate-spin" />
                          ) : isTrialFeatureSet ? (
                            `Upgrade to ${tier.name.replace(/^Cloud /, "")}`
                          ) : (
                            `Switch to ${tier.name.replace(/^Cloud /, "")}`
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
      </Box>
    </PageShell>
  );
}
