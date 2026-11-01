import { Navigate, Route, Routes } from "react-router-dom";
import { workspaceSettingsPath } from "../../../lib/paths";
import { PageShell, RouteErrorBoundary } from "@/ui/block";
import { AgentTokensTab } from "./agent-tokens-tab";
import { ConnectedAppsTab } from "./connected-apps-tab";
import { GeneralTab } from "./general-tab";
import { SecurityTab } from "./security-tab";
import { useAccountSettings } from "./use-account-settings";

export function AccountSettingsPage() {
  const settings = useAccountSettings();

  return (
    <PageShell density="standard">
      <RouteErrorBoundary title="Workspace settings crashed" backHref="/settings">
        <Routes>
          <Route index element={<GeneralTab settings={settings} />} />
          <Route path="security" element={<SecurityTab settings={settings} />} />
          <Route path="agent" element={<AgentTokensTab />} />
          <Route path="connected-apps" element={<ConnectedAppsTab />} />
          {/* Operations has no backups API yet — do not toast fake S3/drill success. */}
          <Route path="operations" element={<Navigate to={workspaceSettingsPath()} replace />} />
          <Route path="team" element={<Navigate to="/team" replace />} />
          <Route path="billing" element={<Navigate to="/billing" replace />} />
          <Route path="usage" element={<Navigate to="/usage" replace />} />
          <Route path="releases" element={<Navigate to="/releases" replace />} />
          <Route path="*" element={<Navigate to={workspaceSettingsPath()} replace />} />
        </Routes>
      </RouteErrorBoundary>
    </PageShell>
  );
}

/** @deprecated use AccountSettingsPage */
export const OrgAccountPage = AccountSettingsPage;
