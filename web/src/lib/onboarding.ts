import {
  fetchProjects,
  fetchSetupProgress,
  setupNeedsWizard,
  setupOnboardingDone,
} from "./api";
import { projectPath } from "./paths";

/** Best landing path after login or registration. */
export async function resolvePostAuthPath(): Promise<string> {
  const projects = await fetchProjects();
  if (projects.length === 0) {
    return "/";
  }

  const project = projects[0];
  try {
    const progress = await fetchSetupProgress(project.id);
    if (setupOnboardingDone(progress)) {
      return projectPath(project.id, "issues");
    }
    if (setupNeedsWizard(progress)) {
      return projectPath(project.id, "setup");
    }
    return projectPath(project.id, "issues");
  } catch {
    return projectPath(project.id, "setup");
  }
}
