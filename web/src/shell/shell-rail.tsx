import { useLocation } from "react-router-dom";
import { isProjectRoute } from "../lib/paths";
import { OrgRail } from "./org-rail";
import { ProjectRail } from "./project-rail";

export function ShellRail() {
  const { pathname } = useLocation();

  if (isProjectRoute(pathname)) {
    return <ProjectRail />;
  }

  return <OrgRail />;
}
