import { useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AlertsPage } from "../features/alerts";
import { IssuesPage } from "../features/issues";
import { NotFoundPage } from "../features/not-found";
import { AccountSettingsPage } from "../features/org/account";
import { OrgHomePage } from "../features/org/home";
import { BillingPage } from "../features/org/billing";
import { OrgTeamPage } from "../features/org/team";
import { OrgChannelsPage } from "../features/org/channels";
import { UsagePage } from "../features/org/usage";
import { SetupPage } from "../features/setup";
import { ReleasesPage } from "../features/releases";
import { MonitorsPage } from "../features/monitors";
import { MonitoringPage } from "../features/monitoring";
import { SettingsPage } from "../features/settings";
import { OrganisationsPage } from "../features/organizations";
import { UserSettingsPage } from "../features/user/user-settings-page";
import { projectPath } from "../lib/paths";

import { RouteErrorBoundary } from "../ui/route-error-boundary";
import { useAppContext } from "./app-context";
import { EnvironmentUrlSync } from "./environment-url-sync";
import { CommandPalette } from "./command-palette";
import { ProjectScope } from "./project-scope";
import { TopStrip } from "./top-strip";
import { AppSidebar } from "./app-sidebar";
import { Skeleton } from "../ui/skeleton";

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

function LegacyProjectRedirect({
  segment,
}: {
  segment: "issues" | "monitoring" | "releases" | "alerts" | "setup" | "settings" | "monitors";
}) {
  const { projectId, projects, projectsLoading } = useAppContext();

  if (projectsLoading) {
    return (
      <div className="epure-shell-loading flex h-full flex-col items-center justify-center gap-3 p-6">
        <Skeleton className="h-4 w-36" />
        <p className="text-sm text-fg-muted">Loading…</p>
      </div>
    );
  }

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject =
    (projectId ? safeProjects.find((p) => p && (p.id === projectId || p.slug === projectId)) : null) ??
    safeProjects[0];
  const id = activeProject?.id;
  if (!id) {
    return <Navigate to="/" replace />;
  }
  if (segment === "settings") {
    return <Navigate to={`/p/${id}/settings`} replace />;
  }
  return <Navigate to={projectPath(id, segment)} replace />;
}

export function AppShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="epure-app-shell flex h-full min-h-0 flex-row bg-bg text-ink overflow-hidden">
      <AppSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopStrip onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
        <EnvironmentUrlSync />
        <main className="epure-app-shell-main flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
              <Routes>
                {/* Global scope */}
                <Route
                  path="/organizations"
                  element={
                    <BoundedRoute title="Organisations crashed" backHref="/">
                      <OrganisationsPage />
                    </BoundedRoute>
                  }
                />
                <Route path="/orgs" element={<Navigate to="/organizations" replace />} />
                <Route
                  path="/user/settings/*"
                  element={
                    <BoundedRoute title="User settings crashed" backHref="/organizations">
                      <UserSettingsPage />
                    </BoundedRoute>
                  }
                />
                <Route path="/user" element={<Navigate to="/user/settings" replace />} />

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
                <Route path="/org/team" element={<Navigate to="/team" replace />} />
                <Route
                  path="/settings/*"
                  element={
                    <BoundedRoute title="Settings crashed">
                      <AccountSettingsPage />
                    </BoundedRoute>
                  }
                />
                <Route
                  path="/org/settings/*"
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
                <Route path="/org/usage" element={<Navigate to="/usage" replace />} />
                <Route
                  path="/billing"
                  element={
                    <BoundedRoute title="Billing page crashed">
                      <BillingPage />
                    </BoundedRoute>
                  }
                />
                <Route path="/org/billing" element={<Navigate to="/billing" replace />} />
                <Route
                  path="/org/channels"
                  element={
                    <BoundedRoute title="Channels crashed">
                      <OrgChannelsPage />
                    </BoundedRoute>
                  }
                />
                <Route path="/channels" element={<Navigate to="/org/channels" replace />} />

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
                    path="issues/:issueId"
                    element={
                      <ProjectBoundedRoute title="Issues crashed">
                        <IssuesPage />
                      </ProjectBoundedRoute>
                    }
                  />
                  <Route
                    path="monitoring"
                    element={
                      <ProjectBoundedRoute title="Monitoring crashed">
                        <MonitoringPage />
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
                    path="monitors"
                    element={
                      <ProjectBoundedRoute title="Monitors crashed">
                        <MonitorsPage />
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

                <Route
                  path="/issues"
                  element={
                    <BoundedRoute title="Issues crashed">
                      <LegacyProjectRedirect segment="issues" />
                    </BoundedRoute>
                  }
                />
                <Route
                  path="/monitoring"
                  element={
                    <BoundedRoute title="Monitoring crashed">
                      <LegacyProjectRedirect segment="monitoring" />
                    </BoundedRoute>
                  }
                />
                <Route
                  path="/releases"
                  element={
                    <BoundedRoute title="Releases crashed">
                      <LegacyProjectRedirect segment="releases" />
                    </BoundedRoute>
                  }
                />
                <Route
                  path="/alerts"
                  element={
                    <BoundedRoute title="Alerts crashed">
                      <LegacyProjectRedirect segment="alerts" />
                    </BoundedRoute>
                  }
                />
                <Route
                  path="/monitors"
                  element={
                    <BoundedRoute title="Monitors crashed">
                      <LegacyProjectRedirect segment="monitors" />
                    </BoundedRoute>
                  }
                />
                <Route
                  path="/setup"
                  element={
                    <BoundedRoute title="Setup crashed">
                      <LegacyProjectRedirect segment="setup" />
                    </BoundedRoute>
                  }
                />
                <Route path="/projects" element={<Navigate to="/" replace />} />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
          </div>
          <CommandPalette />
        </div>
  );
}
