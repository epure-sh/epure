import { Navigate, useParams } from "react-router-dom";

/** Setup runs as a dialog on the projects dashboard. */
export function SetupPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/?setup=${encodeURIComponent(projectId)}`} replace />;
}

export { SetupWizardDialog } from "./setup-wizard-dialog";
