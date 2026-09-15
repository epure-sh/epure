import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { projectSettingsPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { NotFoundState } from "../../ui/error-state";
import { PageChrome } from "../../ui/page-chrome";
import { SettingsNav } from "../../ui/settings-nav";
import { DsnKeysSettings } from "./dsn-keys";
import { ProjectGeneralSettings } from "./project-general";
import { WebhooksSettings } from "./webhooks";

export function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects } = useAppContext();
  const project = projects.find((row) => row.id === projectId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome
        title={project ? `${project.name} settings` : "Project settings"}
        description="SDK connection, notification endpoints, retention, and ingest limits."
      />

      <div className="flex min-h-0 flex-1">
        <SettingsNav />

        <div className="min-w-0 flex-1 overflow-auto bg-bg p-4">
          <div className="mx-auto max-w-default space-y-4">
            <Routes>
              <Route index element={<ProjectGeneralSettings />} />
              <Route path="dsn" element={<DsnKeysSettings />} />
              <Route path="webhooks" element={<WebhooksSettings />} />
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
    </div>
  );
}
