import { BarChart3, CreditCard, LayoutGrid, Settings, Users } from "lucide-react";
import { isCloudDeployment } from "../lib/deployment";
import { billingPath, usagePath, workspacePath, workspaceSettingsPath } from "../lib/paths";
import { RailNav, type RailNavItem } from "./rail-nav";
import { RAIL_RESOURCE_LINKS } from "./rail-resource-links";

const navItems: RailNavItem[] = [
  { to: workspacePath(), label: "Projects", end: true, icon: LayoutGrid },
  { to: workspacePath("team"), label: "Team", end: true, icon: Users },
  { to: workspaceSettingsPath(), label: "Settings", end: false, icon: Settings },
  { to: usagePath(), label: "Usage", end: true, icon: BarChart3 },
  {
    to: billingPath(),
    label: "Billing",
    end: true,
    icon: CreditCard,
    badge: isCloudDeployment() ? undefined : "Cloud",
  },
];

export function OrgRail() {
  return (
    <RailNav
      ariaLabel="Workspace"
      sectionLabel="Workspace"
      items={navItems}
      externalLinks={RAIL_RESOURCE_LINKS}
    />
  );
}
