import { type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AlertsPage } from "../features/alerts";
import { IssuesPage } from "../features/issues";
import { NotFoundPage } from "../features/not-found";
import { AccountSettingsPage } from "../features/org/account";
import { OrgHomePage } from "../features/org/home";
import { BillingPage } from "../features/org/billing";
import { OrgTeamPage } from "../features/org/team";
import { UsagePage } from "../features/org/usage";
import { SetupPage } from "../features/setup";
import { ReleasesPage } from "../features/releases";
import { SettingsPage } from "../features/settings";
import { projectPath } from "../lib/paths";
import { RouteErrorBoundary } from "../ui/route-error-boundary";
import { AppProvider, useAppContext } from "./app-context";
import { CommandPalette } from "./command-palette";
import { ProjectScope } from "./project-scope";
import { ShellRail } from "./shell-rail";
import { TopStrip } from "./top-strip";
import { ToastProvider } from "../ui/toast-provider";
import { TooltipProvider } from "../ui/tooltip";

function BoundedRoute({
  children,
  title,
  backHref,
}: {
  children: ReactNode;
  title: string;
  backHref?: string;
}) {
  return (
    <RouteErrorBoundary title={title} backHref={backHref}>
      {children}
    </RouteErrorBoundary>
  );
}

function ProjectBoundedRoute({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <BoundedRoute
      title={title}
      backHref={projectId ? projectPath(projectId, "issues") : "/"}
    >
      {children}
    </BoundedRoute>
  );
}

function LegacyProjectRedirect({ segment }: { segment: "issues" | "releases" | "alerts" | "setup" | "settings" }) {
  const { projectId, projects } = useAppContext();
  const id = projectId ?? projects[0]?.id;
  if (!id) {
    return <Navigate to="/" replace />;
  }
  if (segment === "settings") {
    return <Navigate to={`/p/${id}/settings`} replace />;
  }
  return <Navigate to={projectPath(id, segment)} replace />;
}

export function AppShell() {
  return (
    <AppProvider>
      <ToastProvider>
      <TooltipProvider delayDuration={300}>
        <div className="epure-app-shell flex h-full min-h-0 bg-bg text-ink">
          <ShellRail />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <TopStrip />
            <main className="epure-app-shell-main flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
              <Routes>
                {/* Workspace scope */}
                <Route
                  path="/"
                  element={
                    <BoundedRoute title="Workspace home crashed">
                      <OrgHomePage />
                    </BoundedRoute>
                  }
                />
                <Route
                  path="/team"
                  element={
                    <BoundedRoute title="Team page crashed">
                      <OrgTeamPage />
                    </BoundedRoute>
                  }
                />
                <Route
                  path="/settings/*"
                  element={
                    <BoundedRoute title="Settings crashed">
                      <AccountSettingsPage />
                    </BoundedRoute>
                  }
                />
                <Route path="/account" element={<Navigate to="/settings" replace />} />
                <Route
                  path="/usage"
                  element={
                    <BoundedRoute title="Usage page crashed">
                      <UsagePage />
                    </BoundedRoute>
                  }
                />
                <Route
                  path="/billing"
                  element={
                    <BoundedRoute title="Billing page crashed">
                      <BillingPage />
                    </BoundedRoute>
                  }
                />

                {/* Project scope */}
                <Route path="/p/:projectId" element={<ProjectScope />}>
                  <Route index element={<Navigate to="issues" replace />} />
                  <Route
                    path="issues"
                    element={
                      <ProjectBoundedRoute title="Issues crashed">
                        <IssuesPage />
                      </ProjectBoundedRoute>
                    }
                  />
                  <Route
                    path="setup"
                    element={
                      <ProjectBoundedRoute title="Setup crashed">
                        <SetupPage />
                      </ProjectBoundedRoute>
                    }
                  />
                  <Route
                    path="releases"
                    element={
                      <ProjectBoundedRoute title="Releases crashed">
                        <ReleasesPage />
                      </ProjectBoundedRoute>
                    }
                  />
                  <Route
                    path="alerts"
                    element={
                      <ProjectBoundedRoute title="Alerts crashed">
                        <AlertsPage />
                      </ProjectBoundedRoute>
                    }
                  />
                  <Route
                    path="settings/*"
                    element={
                      <ProjectBoundedRoute title="Project settings crashed">
                        <SettingsPage />
                      </ProjectBoundedRoute>
                    }
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                {/* Legacy paths → active project */}
                <Route path="/issues" element={<LegacyProjectRedirect segment="issues" />} />
                <Route path="/releases" element={<LegacyProjectRedirect segment="releases" />} />
                <Route path="/alerts" element={<LegacyProjectRedirect segment="alerts" />} />
                <Route path="/setup" element={<LegacyProjectRedirect segment="setup" />} />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
          </div>
          <CommandPalette />
        </div>
      </TooltipProvider>
      </ToastProvider>
    </AppProvider>
  );
}
