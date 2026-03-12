import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { ErrorState, NotFoundState } from "../ui/error-state";
import { Skeleton } from "../ui/skeleton";
import { useAppContext } from "./app-context";

/** Syncs URL `:projectId` into app context; guards invalid project ids. */
export function ProjectScope() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const {
    projects,
    projectsLoading,
    projectsError,
    refreshProjects,
    setProjectId,
    projectId,
  } = useAppContext();

  useEffect(() => {
    if (paramId) {
      setProjectId(paramId);
    }
  }, [paramId, setProjectId]);

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
        onRetry={() => void refreshProjects()}
        backHref="/"
        backLabel="Back to workspace"
      />
    );
  }

  const valid = paramId && projects.some((project) => project.id === paramId);

  if (!valid) {
    return (
      <NotFoundState
        title="Project not found"
        description="This project does not exist or you no longer have access to it."
        backHref="/"
        backLabel="Back to workspace"
      />
    );
  }

  if (paramId && paramId !== projectId) {
    return null;
  }

  return (
    <div className="h-full min-h-0">
      <Outlet />
    </div>
  );
}
