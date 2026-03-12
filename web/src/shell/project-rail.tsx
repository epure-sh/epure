import { ArrowLeft, Bell, CircleDot, Package, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { projectIdFromPath, projectPath, projectSettingsPath, workspacePath } from "../lib/paths";
import { useAppContext } from "./app-context";
import { RailNav, type RailNavItem } from "./rail-nav";
import { RAIL_RESOURCE_LINKS } from "./rail-resource-links";

export function ProjectRail() {
  const { pathname } = useLocation();
  const { projectId: contextProjectId, projects } = useAppContext();
  const projectId = projectIdFromPath(pathname) ?? contextProjectId;
  const project = projects.find((row) => row.id === projectId) ?? null;

  if (!projectId) {
    return null;
  }

  const navItems: RailNavItem[] = [
    { to: projectPath(projectId, "issues"), label: "Issues", end: true, icon: CircleDot },
    { to: projectPath(projectId, "releases"), label: "Releases", end: true, icon: Package },
    { to: projectPath(projectId, "alerts"), label: "Alerts", end: true, icon: Bell },
    { to: projectSettingsPath(projectId), label: "Settings", end: false, icon: Settings },
  ];

  return (
    <RailNav
      ariaLabel="Project"
      sectionLabel={project?.name ?? "Project"}
      items={navItems}
      externalLinks={RAIL_RESOURCE_LINKS}
      header={
        <Link to={workspacePath()} className="epure-nav-item epure-rail-back flex items-center gap-2 focus-ring">
          <ArrowLeft size={15} strokeWidth={1.75} className="shrink-0" />
          <span className="hidden min-w-0 truncate lg:inline">All projects</span>
        </Link>
      }
    />
  );
}
