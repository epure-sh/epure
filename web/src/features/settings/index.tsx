import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { projectAlertRulesPath, projectPath, projectSettingsPath } from "../../lib/paths";
import { NotFoundState } from "../../ui/error-state";
import { PageShell } from "@/components/kit/page-shell";
import { RouteErrorBoundary } from "../../ui/route-error-boundary";
import { DsnKeysSettings } from "./dsn-keys";
import { ProjectGeneralSettings } from "./project-general";
import { ProjectPrivacySettings } from "./project-privacy";
import { InboundFiltersSettings } from "./inbound-filters";

export function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <PageShell density="full-bleed">
      <div className="min-h-0 flex-1 overflow-auto epure-page-gutter-x py-5">
        <RouteErrorBoundary title="Settings crashed" backHref={projectId ? projectPath(projectId, "issues") : "/"}>
          <Routes>
            <Route index element={<ProjectGeneralSettings />} />
            <Route path="privacy" element={<ProjectPrivacySettings />} />
            <Route path="filters" element={<InboundFiltersSettings />} />
            <Route path="dsn" element={<DsnKeysSettings />} />
            <Route
              path="email"
              element={
                <Navigate to={projectId ? projectSettingsPath(projectId) : "/"} replace />
              }
            />
            <Route path="webhooks" element={<Navigate to="/org/channels" replace />} />
            <Route
              path="alerts"
              element={
                <Navigate to={projectId ? projectAlertRulesPath(projectId) : "/"} replace />
              }
            />
            <Route path="security" element={<Navigate to="/settings/security" replace />} />
            <Route path="releases" element={<Navigate to={projectPath(projectId ?? "", "releases")} replace />} />
            <Route
              path="*"
              element={
                projectId ? (
                  <Navigate to={projectSettingsPath(projectId)} replace />
                ) : (
                  <NotFoundState
                    title="Settings page not found"
                    description="This settings tab does not exist."
                    backHref="/"
                  />
                )
              }
            />
          </Routes>
        </RouteErrorBoundary>
      </div>
    </PageShell>
  );
}
