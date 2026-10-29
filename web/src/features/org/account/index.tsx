import { Navigate, Route, Routes } from "react-router-dom";
import { workspaceSettingsPath } from "../../../lib/paths";
import { WorkspaceSettingsNav } from "../../../ui/workspace-settings-nav";
import { RouteErrorBoundary } from "../../../ui/route-error-boundary";
import { AgentTokensTab } from "./agent-tokens-tab";
import { ConnectedAppsTab } from "./connected-apps-tab";
import { GeneralTab } from "./general-tab";
import { SecurityTab } from "./security-tab";
import { OperationsTab } from "./operations-tab";
import { useAccountSettings } from "./use-account-settings";

export function AccountSettingsPage() {
  const settings = useAccountSettings();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <WorkspaceSettingsNav />

        <div className="min-w-0 flex-1 overflow-auto epure-page-gutter-x py-6">
          <div className="mx-auto max-w-default space-y-4">
            <RouteErrorBoundary title="Account Settings error" backHref="/settings">
              <Routes>
                <Route index element={<GeneralTab settings={settings} />} />
                <Route path="security" element={<SecurityTab settings={settings} />} />
                <Route path="agent" element={<AgentTokensTab />} />
                <Route path="connected-apps" element={<ConnectedAppsTab />} />
                <Route path="operations" element={<OperationsTab />} />
                <Route path="team" element={<Navigate to="/team" replace />} />
                <Route path="billing" element={<Navigate to="/billing" replace />} />
                <Route path="usage" element={<Navigate to="/usage" replace />} />
                <Route path="releases" element={<Navigate to="/releases" replace />} />
                <Route path="*" element={<Navigate to={workspaceSettingsPath()} replace />} />
              </Routes>
            </RouteErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated use AccountSettingsPage */
export const OrgAccountPage = AccountSettingsPage;
