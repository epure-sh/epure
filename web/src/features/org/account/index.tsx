import { Navigate, Route, Routes } from "react-router-dom";
import { workspaceSettingsPath } from "../../../lib/paths";
import { PageChrome } from "../../../ui/page-chrome";
import { WorkspaceSettingsNav } from "../../../ui/workspace-settings-nav";
import { GeneralTab } from "./general-tab";
import { SecurityTab } from "./security-tab";
import { useAccountSettings } from "./use-account-settings";

export function AccountSettingsPage() {
  const settings = useAccountSettings();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome
        title="Settings"
        description="Manage your profile, security, and sessions."
      />

      <div className="flex min-h-0 flex-1">
        <WorkspaceSettingsNav />

        <div className="min-w-0 flex-1 overflow-auto bg-bg p-4">
          <div className="mx-auto max-w-default space-y-4">
            {settings.loading ? (
              <p className="text-sm text-ink-muted">Loading settings…</p>
            ) : (
              <Routes>
                <Route index element={<GeneralTab settings={settings} />} />
                <Route path="security" element={<SecurityTab settings={settings} />} />
                <Route path="*" element={<Navigate to={workspaceSettingsPath()} replace />} />
              </Routes>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated use AccountSettingsPage */
export const OrgAccountPage = AccountSettingsPage;
