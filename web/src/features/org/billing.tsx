import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { PageShell } from "@/ui/block";
import { EmptyState } from "@/components/kit/empty-state";
import { PolarCard } from "@/components/kit/polar-card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  apiErrorStatus,
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

const BILLING_RETRY_DELAYS = [1_000, 2_000, 4_000, 8_000, 15_000, 25_000];

interface PlanSelection {
  target: PlanDefinition;
  currentTier: "pro" | "scale";
  subscriptionId: string;
  pendingProductId?: string;
}

export function BillingPage() {
  const { user } = useAppContext();
  return <WorkspaceBilling key={user?.org_id} />;
}

function WorkspaceBilling() {
  const navigate = useNavigate();
  const { currentOrg, organizations, projects, user, refreshUser, switchOrg } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [usage, setUsage] = useState<ProjectEventUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<UsageTimeWindow>("30d");
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [openingBillingWorkspace, setOpeningBillingWorkspace] = useState(false);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);

  const isOwner = user?.role === "owner";
  const orgId = user?.org_id;
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

  const [syncing, setSyncing] = useState(false);
  const [syncWarning, setSyncWarning] = useState(false);
  const [refreshRequest, setRefreshRequest] = useState(0);
  const [selection, setSelection] = useState<PlanSelection | null>(null);
  const [awaitingChange, setAwaitingChange] = useState<PlanSelection | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refreshBilling = () => setRefreshRequest((value) => value + 1);

  useEffect(() => {
    if (!cloud || !orgId) {
      setBillingLoading(false);
      return;
    }
    let disposed = false;
    let timer: number | undefined;
    const show = (status: BillingStatus | null) => {
      if (!disposed && status && (!status.org_id || status.org_id === orgId)) {
        setBillingStatus(status);
      }
    };
    const clearCheckout = () => setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("checkout_id");
      next.delete("checkout");
      return next;
    }, { replace: true });

    const load = async (attempt = 0) => {
      if (disposed) return;
      setSyncing(true);
      const cached = attempt === 0 ? await fetchBillingStatus() : null;
      if (attempt === 0) {
        show(cached);
        if (disposed) return;
        setBillingLoading(false);
      }
      if (!isOwner || cached?.billing_workspace_id) {
        setSyncing(false);
        return;
      }

      try {
        const status = checkoutId ? await syncCheckout(checkoutId, orgId) : await syncBilling();
        if (disposed) return;
        show(status);
        setSyncWarning(false);
        if (!checkoutId || status.checkout_sync === "complete" || status.checkout_sync === "closed") {
          if (checkoutId) clearCheckout();
          if (status.checkout_sync === "closed") toast.info("Checkout expired or failed. You can choose a plan again.");
          void refreshUser().catch(() => {});
          setSyncing(false);
          return;
        }
      } catch (error) {
        if (disposed) return;
        const code = apiErrorStatus(error);
        if (checkoutId && (code === 400 || code === 403 || code === 404)) {
          clearCheckout();
          toast.error("This checkout could not be verified for this workspace.");
          setSyncing(false);
          return;
        }
        setSyncWarning(true);
      }
      setSyncing(false);
      const delay = BILLING_RETRY_DELAYS[attempt];
      if (checkoutId && delay) timer = window.setTimeout(() => void load(attempt + 1), delay);
    };

    void load();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [checkoutId, cloud, isOwner, orgId, refreshRequest, refreshUser, setSearchParams]);

  useEffect(() => {
    if (!awaitingChange) return;
    let disposed = false;
    let timer: number | undefined;
    const poll = async (attempt: number) => {
      const status = await fetchBillingStatus();
      if (disposed) return;
      if (status && (!status.org_id || status.org_id === orgId)) {
        setBillingStatus(status);
        const pendingTier = status.subscription?.pending_update?.plan_tier;
        const applied = awaitingChange.pendingProductId
          ? status.plan_tier === awaitingChange.currentTier && !status.subscription?.pending_update
          : status.plan_tier === awaitingChange.target.tierCode || pendingTier === awaitingChange.target.tierCode;
        if (applied && status.subscription_id === awaitingChange.subscriptionId) {
          setAwaitingChange(null);
          void refreshUser().catch(() => {});
          return;
        }
      }
      const delay = BILLING_RETRY_DELAYS[attempt];
      if (delay) timer = window.setTimeout(() => void poll(attempt + 1), delay);
      else {
        setAwaitingChange(null);
        setSyncWarning(true);
      }
    };
    timer = window.setTimeout(() => void poll(1), BILLING_RETRY_DELAYS[0]);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [awaitingChange, orgId, refreshUser]);

  useEffect(() => {
    if (!cloud || !orgId || syncing || checkoutId || awaitingChange || upgradingPlanId) return;
    let disposed = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const status = await fetchBillingStatus();
      if (!disposed && status && (!status.org_id || status.org_id === orgId)) {
        setBillingStatus(status);
      }
    };
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [awaitingChange, checkoutId, cloud, orgId, syncing, upgradingPlanId]);

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
  const subscription = billingStatus?.subscription;
  const pendingUpdate = subscription?.pending_update;
  const subscriptionId = billingStatus?.subscription_id;
  const includedInScale = billingStatus?.plan_action === "included";
  const hasLinkedWorkspaces = (billingStatus?.linked_workspace_count ?? 0) > 0;
  const sharesQuota = includedInScale || hasLinkedWorkspaces;
  const billingWorkspace = organizations.find((workspace) => workspace.id === billingStatus?.billing_workspace_id);
  const currentTier = (subscriptionId || includedInScale) && !inactive ? plan?.tierCode : undefined;
  const localTrial = isTrial && !inactive && !subscriptionId;
  const reportedAction = billingStatus?.plan_action ?? (
    billingStatus?.subscription_status === "past_due" || subscription?.cancel_at_period_end
      ? "manage"
      : subscriptionId ? "change_plan" : "checkout"
  );
  const planAction = reportedAction === "change_plan" && !currentTier ? "manage" : reportedAction;
  const hasBillingCustomer = billingStatus?.has_billing_customer ?? Boolean(
    subscriptionId || ["past_due", "canceled", "unpaid"].includes(billingStatus?.subscription_status ?? ""),
  );
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
  const storedThisMonth = monthlyUsage?.events_this_month;
  const tone = eventLimit && storedThisMonth != null ? meterTone(storedThisMonth, eventLimit) : "ok";
  const meterPercent = eventLimit && storedThisMonth != null
    ? Math.min(100, Math.round((storedThisMonth / eventLimit) * 100))
    : null;

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
      if (eventLimit && storedThisMonth != null) {
        const quotaLabel = sharesQuota ? "Shared quota this month" : "Quota this month";
        lines.push(`${quotaLabel} · ${storedThisMonth.toLocaleString()} / ${eventLimit.toLocaleString()}`);
      }
    } else if (!cloud) {
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
    sharesQuota,
    storedThisMonth,
    totalEvents,
    unresolvedTotal,
    usage,
    windowLabel,
  ]);

  const openBillingWorkspace = async () => {
    if (!billingWorkspace || openingBillingWorkspace) return;
    setOpeningBillingWorkspace(true);
    try {
      await switchOrg(billingWorkspace.id);
    } catch {
      toast.error("Could not open the billing workspace. Try again.");
    } finally {
      setOpeningBillingWorkspace(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!orgId || !isOwner || loadingPortal) return;
    setLoadingPortal(true);
    try {
      const res = await createBillingPortalSession(window.location.origin + "/billing", orgId);
      if (mounted.current) window.location.assign(res.url);
    } catch {
      if (mounted.current) toast.error("Could not open the billing portal. Try again in a moment.");
    } finally {
      setLoadingPortal(false);
    }
  };

  const planActionsDisabled = !isOwner || syncing || Boolean(
    !orgId || !billingStatus || (isOwner && checkoutId) || awaitingChange || upgradingPlanId,
  );

  const handleSelectPlan = async (target: PlanDefinition) => {
    if (planActionsDisabled || !orgId || !target.tierCode) return;
    if (planAction === "change_plan" && currentTier && billingStatus?.subscription_id) {
      setSelection({ target, currentTier, subscriptionId: billingStatus.subscription_id });
      return;
    }
    if (planAction !== "checkout") return;

    setUpgradingPlanId(target.id);
    try {
      const res = await createCheckoutSession({
        plan_tier: target.tierCode,
        workspace_id: orgId,
        interval: "monthly",
        success_url: window.location.origin + "/billing",
        cancel_url: window.location.origin + "/billing",
      });
      if (mounted.current) window.location.assign(res.url);
    } catch (error) {
      if (!mounted.current) return;
      if (apiErrorStatus(error) === 409) {
        refreshBilling();
        toast.info("Billing is refreshing. If your subscription is missing, contact Epure to link it to this workspace.");
      } else {
        toast.error("Could not open checkout. Refresh billing and try again.");
      }
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const confirmPlanChange = async () => {
    if (!selection || planActionsDisabled || !orgId) return;
    const { target, subscriptionId, currentTier, pendingProductId } = selection;
    if (!target.tierCode) return;
    setUpgradingPlanId(target.id);
    try {
      const updated = await changeBillingPlan({
        plan_tier: target.tierCode,
        workspace_id: orgId,
        subscription_id: subscriptionId,
        current_plan_tier: currentTier,
        keep_current: pendingProductId ? true : undefined,
        pending_product_id: pendingProductId,
      });
      if (!mounted.current || (updated.org_id && updated.org_id !== orgId)) return;
      setBillingStatus(updated);
      if (updated.plan_change_pending) {
        setAwaitingChange(selection);
      } else {
        setSyncWarning(false);
        void refreshUser().catch(() => {});
        toast.success(pendingProductId
          ? "Scheduled plan change removed."
          : updated.subscription?.pending_update
            ? "Plan change scheduled for your next billing period."
            : "Your plan has been updated.");
      }
    } catch (error) {
      if (!mounted.current) return;
      const code = apiErrorStatus(error);
      if (code === 402) {
        toast.error("Polar could not collect payment for the upgrade. Update your payment method in Manage billing.");
      } else if (code === 409) {
        toast.info("The subscription changed. Review the refreshed billing details.");
        refreshBilling();
      } else {
        toast.error("Could not confirm the plan change. Refresh billing before trying again.");
        refreshBilling();
      }
    } finally {
      setSelection(null);
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
            {cloud && orgId ? (
              <Button type="button" variant="ghost" size="sm" disabled={syncing || Boolean(upgradingPlanId)}
                onClick={refreshBilling}>
                {syncing ? "Refreshing…" : "Refresh billing"}
              </Button>
            ) : null}
            {cloud && isOwner && hasBillingCustomer ? (
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

        {includedInScale ? (
          <Box flexDirection="column" gap="xs">
            <Text variant="body">This workspace shares its Scale subscription and event quota with the billing workspace.</Text>
            {inactive ? <Text variant="caption" color="muted">The billing workspace needs an active Scale plan to resume ingest here.</Text> : null}
            {billingWorkspace ? (
              <Box>
                <Button type="button" variant="outline" size="sm" disabled={openingBillingWorkspace}
                  onClick={() => void openBillingWorkspace()}>
                  {openingBillingWorkspace ? "Opening…" : "Open billing workspace"}
                </Button>
              </Box>
            ) : null}
          </Box>
        ) : null}
        {hasLinkedWorkspaces ? (
          <Box><Text variant="body">Linked workspaces share this subscription and its event quota. They need an active Scale plan to receive events.</Text></Box>
        ) : null}
        {pendingUpdate && !subscription?.cancel_at_period_end ? (
          <Box alignItems="center" gap="s" flexWrap="wrap">
            <Text variant="body">
              {CLOUD_PLANS.find((tier) => tier.tierCode === pendingUpdate.plan_tier)?.name ?? "Plan change"} scheduled for {formatDate(pendingUpdate.applies_at)}.
            </Text>
            {isOwner && currentTier && plan && subscriptionId && pendingUpdate.product_id && pendingUpdate.plan_tier && planAction === "change_plan" ? (
              <Button type="button" variant="outline" size="sm" disabled={planActionsDisabled}
                onClick={() => setSelection({
                  target: plan, currentTier, subscriptionId, pendingProductId: pendingUpdate.product_id ?? undefined,
                })}>
                Keep current plan
              </Button>
            ) : null}
          </Box>
        ) : null}
        {subscription?.cancel_at_period_end ? (
          <Box><Text variant="body">Your subscription ends on {formatDate(subscription.current_period_end)}. You can resume renewal in Manage billing.</Text></Box>
        ) : null}
        {subscription?.pause_at_period_end && !subscription.cancel_at_period_end ? (
          <Box><Text variant="body">Your subscription pauses on {formatDate(subscription.current_period_end)}.</Text></Box>
        ) : null}
        {isOwner && hasBillingCustomer && !subscription?.cancel_at_period_end ? (
          <Box><Text variant="caption" color="muted">View invoices, update your payment method, or cancel at the end of your billing period in Manage billing.</Text></Box>
        ) : null}
        {planAction === "manage" && billingStatus?.subscription_status === "past_due" ? (
          <Box><Text variant="body">A payment is overdue. A workspace owner can update the payment method in Manage billing.</Text></Box>
        ) : null}
        {(isOwner && checkoutId) || awaitingChange || syncWarning || billingStatus?.sync?.last_error ? (
          <Box role="status">
            <Text variant="body">
              {isOwner && checkoutId
                ? "Waiting for Polar to confirm your checkout. You can refresh billing here."
                : awaitingChange
                  ? "Waiting for Polar to confirm your plan change."
                  : "Billing updates are delayed. Refresh to check for the latest status."}
            </Text>
          </Box>
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
            <Button type="button" variant="ghost" size="sm" onClick={refreshBilling}>
              Retry
            </Button>
          </div>
        ) : cloud && billingStatus ? (
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
            <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-fg-primary">
                    {inactive ? "No active plan" : localTrial ? "Cloud trial" : (plan?.name ?? "Cloud billing")}
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
                            : billingStatus.subscription_status === "past_due"
                              ? "Payment is overdue. Update your payment method to resume ingest."
                              : includedInScale
                                ? "The shared Scale plan is inactive."
                                : "Choose a plan to start sending events."}
                    </p>
                    <p className="text-2xs text-fg-muted">
                      Your issues and history stay readable.
                    </p>
                  </div>
                ) : isTrial ? (
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-fg-primary tabular-nums">
                      {`${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} left in your trial`}
                    </p>
                    <p className="text-2xs text-fg-muted">
                      {localTrial
                        ? "Pro limits during the trial. Choose a plan any time to keep going."
                        : "View your renewal details in the billing portal."}
                    </p>
                  </div>
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
            {eventLimit && storedThisMonth != null && meterPercent != null ? (
              <div className="space-y-2 border-t border-border-subtle px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-fg-primary">
                    {sharesQuota ? "Shared event quota this month" : "Event quota this month"}
                  </p>
                  <p className="font-mono text-xs tabular-nums text-fg-muted">
                    {storedThisMonth.toLocaleString()} / {eventLimit.toLocaleString()}
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
                    {sharesQuota ? "Stored events across the billing workspace and its linked workspaces." : "Stored events across this workspace’s projects."}
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
            ) : null}
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
                value={meterPercent != null ? `${meterPercent}%` : cloud ? "—" : "Off"}
                hint={
                  eventLimit
                    ? `${formatCompactCount(eventLimit)} / mo`
                    : cloud ? undefined : "Self-hosted"
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
              onAction={() => navigate("/projects")}
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

        {cloud && !includedInScale ? (
          <Box flexDirection="column" gap="m" as="section" aria-label="Cloud plans">
            <Box flexDirection="column" gap="xs">
              <Text as="h3" variant="heading-xxs">Cloud plans</Text>
              <Text variant="caption" color="muted">Flat monthly prices. Zero automatic overages.</Text>
              {!isOwner && billingStatus ? (
                <Text variant="caption" color="muted">A workspace owner can change the plan.</Text>
              ) : null}
            </Box>
            <Box display="grid" gap="m" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}>
              {CLOUD_PLANS.map((tier) => {
                const isCurrent = currentTier === tier.tierCode;
                const isScheduled = Boolean(pendingUpdate && pendingUpdate.plan_tier === tier.tierCode);
                const trialAccess = localTrial && plan?.id === tier.id;
                const planName = tier.name.replace(/^Cloud /, "");
                let actionLabel = "Choose " + planName;
                if (planAction === "change_plan") {
                  actionLabel = (tier.tierCode === "scale" ? "Upgrade to " : "Downgrade to ") + planName;
                }
                return (
                  <PolarCard key={tier.id} variant={isCurrent ? "selected" : "default"} padding="l">
                    <Box flexDirection="column" gap="m" alignItems="stretch">
                      <Box justifyContent="between" alignItems="center" gap="s">
                        <Text as="h4" variant="heading-xxs">{tier.name}</Text>
                        {isCurrent ? (
                          <Badge variant="healthy" size="compact">Current plan</Badge>
                        ) : isScheduled ? (
                          <Badge variant="info" size="compact">Scheduled</Badge>
                        ) : trialAccess ? (
                          <Badge variant="info" size="compact">Trial access</Badge>
                        ) : null}
                      </Box>
                      <Text variant="heading-xs">{tier.priceMonthly ?? tier.price} / month</Text>
                      <Text variant="caption" color="muted">{tier.description}</Text>
                      <Box as="ul" flexDirection="column" gap="s">
                        {tier.features.slice(0, 4).map((feature) => (
                          <Box as="li" key={feature} gap="s" alignItems="center">
                            <Icon icon={Check} size={12} />
                            <Text variant="caption">{feature}</Text>
                          </Box>
                        ))}
                      </Box>
                      {!isCurrent && !isScheduled && !pendingUpdate && planAction !== "manage" ? (
                        <Box>
                          <Button type="button" variant="primary" size="sm"
                            disabled={planActionsDisabled || Boolean(tier.comingSoon)}
                            onClick={() => void handleSelectPlan(tier)}>
                            {upgradingPlanId === tier.id ? "Opening…" : actionLabel}
                          </Button>
                        </Box>
                      ) : null}
                    </Box>
                  </PolarCard>
                );
              })}
            </Box>
          </Box>
        ) : null}

        <Dialog open={selection !== null} onOpenChange={(open) => {
          if (!open && !upgradingPlanId) setSelection(null);
        }}>
          {selection ? (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {selection.pendingProductId
                    ? "Keep " + selection.target.name + "?"
                    : selection.target.tierCode === "scale"
                      ? "Upgrade to " + selection.target.name + "?"
                      : "Schedule a downgrade to " + selection.target.name + "?"}
                </DialogTitle>
                <DialogDescription>
                  {selection.pendingProductId
                    ? "Polar will remove the scheduled plan change. Your subscription will renew on your current plan."
                    : selection.target.tierCode === "scale"
                      ? "Polar will charge the prorated difference to your saved payment method now. Your upgrade takes effect once payment succeeds."
                      : "Your current plan stays active through the end of this billing period. Pro’s lower retention and event limits start at renewal. Any linked workspaces will stop receiving events until Scale is active again."}
                </DialogDescription>
              </DialogHeader>
              <Box justifyContent="end" gap="s">
                <Button type="button" variant="ghost" disabled={Boolean(upgradingPlanId)}
                  onClick={() => setSelection(null)}>Back</Button>
                <Button type="button" variant="primary" disabled={planActionsDisabled}
                  onClick={() => void confirmPlanChange()}>
                  {upgradingPlanId ? "Submitting…" : selection.pendingProductId
                    ? "Keep current plan"
                    : selection.target.tierCode === "scale" ? "Confirm upgrade" : "Schedule downgrade"}
                </Button>
              </Box>
            </DialogContent>
          ) : null}
        </Dialog>
      </Box>
    </PageShell>
  );
}
