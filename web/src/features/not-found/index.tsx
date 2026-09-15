import { useLocation } from "react-router-dom";
import { projectIdFromPath } from "../../lib/paths";
import { NotFoundState } from "../../ui/error-state";

export function NotFoundPage() {
  const { pathname } = useLocation();
  const projectId = projectIdFromPath(pathname);

  return (
    <NotFoundState
      title="Page not found"
      description="This URL does not match anything in your workspace. Check the address or use the navigation rail."
      backHref={projectId ? `/p/${projectId}/issues` : "/"}
      backLabel={projectId ? "Back to issues" : "Back to workspace"}
    />
  );
}
