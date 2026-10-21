import { isCloudDeployment } from "../../lib/deployment";
import { PageChrome } from "../../ui/page-chrome";
import { OrgBillingSettings } from "./settings/billing";

export function BillingPage() {
  const cloud = isCloudDeployment();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome
        title="Billing"
        description={
          cloud
            ? "Manage your Epure Cloud subscription, active tier, and included volume."
            : "Self-hosted OSS instance. Explore Epure Cloud plans for zero-maintenance hosting."
        }
      />
      <div className="min-w-0 flex-1 overflow-auto bg-bg p-4">
        <div className="mx-auto max-w-wide space-y-4">
          <OrgBillingSettings />
        </div>
      </div>
    </div>
  );
}
