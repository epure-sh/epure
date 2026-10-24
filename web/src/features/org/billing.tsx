import { isCloudDeployment } from "../../lib/deployment";
import { PageShell } from "@/components/kit/page-shell";
import { OrgBillingSettings } from "./settings/billing";

export function BillingPage() {
  const cloud = isCloudDeployment();

  return (
    <PageShell
      title="Billing"
      description={
        cloud
          ? "Manage your Epure Cloud subscription, active tier, and included volume."
          : "Self-hosted OSS instance. Explore Epure Cloud plans for zero-maintenance hosting."
      }
      density="standard"
    >
      <OrgBillingSettings />
    </PageShell>
  );
}
