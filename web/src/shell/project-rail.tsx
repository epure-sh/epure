import { ArrowLeft, Bell, CircleDot, Package, Settings, Timer } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { buildProjectPathWithFeedQuery } from "../features/issues/project-feed-query-store";
import { projectIdFromPath, projectPath, projectSettingsPath, workspacePath } from "../lib/paths";
import { useAppContext } from "./app-context";
import { useProjectNavCounts } from "./use-project-nav-counts";
import { RailNav, type RailNavItem } from "./rail-nav";
import { RAIL_RESOURCE_LINKS } from "./rail-resource-links";

export function ProjectRail() {
  const { pathname, search } = useLocation();
  const { projectId: contextProjectId, projects, environment } = useAppContext();
  const projectId = projectIdFromPath(pathname) ?? contextProjectId;
  const project = projects.find((row) => row.id === projectId) ?? null;
  const navCounts = useProjectNavCounts(projectId, environment);

  if (!projectId) {
    return null;
  }

  const navItems: RailNavItem[] = [
    {
      to: buildProjectPathWithFeedQuery(projectId, "issues", { currentSearch: search }),
      label: "Issues",
      end: true,
      icon: CircleDot,
      badgeCount: navCounts.unresolved,
      badgeAriaLabel:
        navCounts.unresolved != null ? `${navCounts.unresolved} unresolved issues` : undefined,
    },
    { to: projectPath(projectId, "releases"), label: "Releases", end: true, icon: Package },
    { to: projectPath(projectId, "monitors"), label: "Monitors", end: true, icon: Timer },
    {
      to: buildProjectPathWithFeedQuery(projectId, "alerts", { currentSearch: search }),
      label: "Alerts",
      end: true,
      icon: Bell,
      badgeCount: navCounts.alertsUnread,
      badgeTone: "accent",
      badgeAriaLabel:
        navCounts.alertsUnread != null ? `${navCounts.alertsUnread} unread alerts` : undefined,
    },
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
