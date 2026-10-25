import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { ErrorState, NotFoundState } from "../ui/error-state";
import { RouteErrorBoundary } from "../ui/route-error-boundary";
import { Skeleton } from "../ui/skeleton";
import { useAppContext } from "./app-context";

/** Syncs URL `:projectId` into app context; guards invalid project ids and resolves slugs. */
export function ProjectScope() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const {
    projects,
    projectsLoading,
    projectsError,
    refreshProjects,
    setProjectId,
    projectId,
  } = useAppContext();

  const safeProjects = Array.isArray(projects) ? projects : [];
  const matchingProject = paramId
    ? safeProjects.find((project) => project && (project.id === paramId || project.slug === paramId)) ?? null
    : null;

  useEffect(() => {
    if (matchingProject && matchingProject.id !== projectId) {
      setProjectId(matchingProject.id);
    }
  }, [matchingProject, projectId, setProjectId]);

  if (projectsLoading) {
    return (
      <div className="epure-shell-loading flex h-full flex-col items-center justify-center gap-3 p-6">
        <Skeleton className="h-4 w-36" />
        <p className="text-sm text-ink-muted">Loading projects…</p>
      </div>
    );
  }

  if (projectsError) {
    return (
      <ErrorState
        title="Could not load projects"
        description={projectsError}
        showReload
        onRetry={() => void refreshProjects()}
        backHref="/"
        backLabel="Back to workspace"
      />
    );
  }

  if (!matchingProject) {
    return (
      <NotFoundState
        title="Project not found"
        description="This project does not exist or you no longer have access to it."
        backHref="/"
        backLabel="Back to workspace"
      />
    );
  }

  // Canonicalize slug to UUID so child routes and API calls always receive a valid UUID
  if (paramId && paramId !== matchingProject.id) {
    const segments = location.pathname.split("/");
    if (segments[1] === "p" && segments[2]) {
      segments[2] = matchingProject.id;
      const canonicalPath = segments.join("/");
      if (canonicalPath !== location.pathname) {
        return <Navigate to={`${canonicalPath}${location.search}${location.hash}`} replace />;
      }
    }
  }

  return (
    <div className="h-full min-h-0">
      <RouteErrorBoundary title="Project page crashed" backHref="/">
        <Outlet />
      </RouteErrorBoundary>
    </div>
  );
}
