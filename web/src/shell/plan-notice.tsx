import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Banner } from "@/ui/components";
import { Button } from "@/ui/primitives";
import { fetchBillingStatus, type BillingStatus } from "../lib/api";
import { isGlobalRoute } from "../lib/paths";
import { isCloudDeployment } from "../lib/deployment";
import { useAppContext } from "./app-context";

const REFRESH_MS = 10 * 60 * 1000;

/** Cloud-only strip: trial ending, trial ended, inactive plan, failed payment. */
export function PlanNotice() {
  const { user } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const cloud = isCloudDeployment();

  useEffect(() => {
    if (!cloud || !user) return;
    let cancelled = false;
    const load = async () => {
      const next = await fetchBillingStatus();
      if (!cancelled) setStatus(next);
    };
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cloud, user]);

  const entitlement = status?.entitlement;
  if (!cloud || !user || !entitlement || (status?.org_id && status.org_id !== user.org_id)
      || location.pathname.startsWith("/billing") || isGlobalRoute(location.pathname)) return null;

  const paymentOverdue = status?.subscription_status === "past_due";
  const shared = Boolean(status?.billing_workspace_id);

  const goToBilling = (
    <Button size="xs" variant="outline" onClick={() => navigate("/billing")}>
      {paymentOverdue || shared ? "Review billing" : "Choose a plan"}
    </Button>
  );

  if (entitlement.state === "inactive") {
    const title = shared ? "Shared Scale plan inactive" :
      entitlement.reason === "trial_ended"
        ? "Your trial has ended"
        : entitlement.reason === "paused"
          ? "Your subscription is paused"
          : entitlement.reason === "canceled"
            ? "Your subscription has ended"
            : paymentOverdue
              ? "Payment overdue"
              : "No active plan";
    return (
      <Banner
        tone="danger"
        title={title}
        description="New events are not accepted. Your issues and history stay readable."
        action={goToBilling}
      />
    );
  }

  if (entitlement.state === "past_due") {
    return (
      <Banner
        tone="warning"
        title="Payment failed"
        description="Update your payment method in Manage billing to keep your workspace active."
        action={
          <Button size="xs" variant="outline" onClick={() => navigate("/billing")}>
            Review billing
          </Button>
        }
      />
    );
  }

  const daysLeft = entitlement.trial_days_left;
  if (entitlement.state === "trial" && daysLeft != null && daysLeft <= 3) {
    return (
      <Banner
        tone="warning"
        title={
          <span className="tabular-nums">
            {daysLeft === 0 ? "Your trial ends today" : `Your trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
          </span>
        }
        description="After that, new events are not accepted until you choose a plan."
        action={goToBilling}
        dismissStorageKey={`epure.plan-notice.trial.${entitlement.trial_ends_at ?? "none"}.${daysLeft}`}
      />
    );
  }

  return null;
}
