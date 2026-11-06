import { Navigate, Route, Routes } from "react-router-dom";
import { userSettingsPath, workspaceSettingsPath } from "../../../lib/paths";
import { PageShell, RouteErrorBoundary } from "@/ui/block";

import { AgentTokensTab } from "./agent-tokens-tab";
import { useAppContext } from "@/shell/app-context";
import { WorkspaceSettings } from "../../organizations/workspace-directory";

export function AccountSettingsPage() {
  const { user } = useAppContext();
  return (
    <PageShell density="standard">
      <RouteErrorBoundary title="Workspace settings crashed" backHref="/settings">
        <Routes>
          <Route index element={<WorkspaceSettings />} />
          <Route path="security" element={<Navigate to={userSettingsPath("security")} replace />} />
          <Route path="agent" element={<AgentTokensTab key={user?.org_id} />} />
          <Route path="connected-apps" element={<Navigate to={userSettingsPath("connected-apps")} replace />} />
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
