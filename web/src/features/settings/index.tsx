import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { projectSettingsPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { NotFoundState } from "../../ui/error-state";
import { PageShell } from "@/components/kit/page-shell";
import { SettingsNav } from "../../ui/settings-nav";
import { DsnKeysSettings } from "./dsn-keys";
import { ProjectGeneralSettings } from "./project-general";
import { InboundFiltersSettings } from "./inbound-filters";
import { AlertRulesSettings } from "./alert-rules";
import { WebhooksSettings } from "./webhooks";

export function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects } = useAppContext();
  const project = projects.find((row) => row.id === projectId) ?? null;

  return (
    <PageShell
      title={project ? `${project.name} settings` : "Project settings"}
      description="SDK connection, notification endpoints, retention, and ingest limits."
      density="full-bleed"
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <SettingsNav />

        <div className="min-w-0 flex-1 overflow-auto bg-canvas p-4 md:p-6">
          <div className="mx-auto max-w-5xl space-y-4">
            <Routes>
              <Route index element={<ProjectGeneralSettings />} />
              <Route path="filters" element={<InboundFiltersSettings />} />
              <Route path="dsn" element={<DsnKeysSettings />} />
              <Route path="webhooks" element={<WebhooksSettings />} />
              <Route path="alerts" element={<AlertRulesSettings />} />
              <Route path="security" element={<Navigate to="/settings/security" replace />} />
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
          </div>
        </div>
      </div>
    </PageShell>
  );
}
