import { NavLink } from "react-router-dom";
import { Key, Laptop, Server, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { workspaceSettingsPath } from "../lib/paths";
import { cn } from "../lib/cn";
import { isCloudDeployment } from "../lib/deployment";

const tabs = [
  {
    id: "general",
    label: "General",
    description: "Workspace name & profile",
    icon: SlidersHorizontal,
    path: workspaceSettingsPath(),
  },
  {
    id: "security",
    label: "Security",
    description: "Authentication & access control",
    icon: ShieldCheck,
    path: workspaceSettingsPath("security"),
  },
  {
    id: "agent",
    label: "Agent tokens",
    description: "Personal access tokens",
    icon: Key,
    path: workspaceSettingsPath("agent"),
  },
  {
    id: "connected-apps",
    label: "Connected Apps & CLI",
    description: "OAuth CLI & MCP sessions",
    icon: Laptop,
    path: workspaceSettingsPath("connected-apps"),
  },
  {
    id: "operations",
    label: "Operations & Backups",
    description: "Postgres health, backups & storage",
    icon: Server,
    path: workspaceSettingsPath("operations"),
  },
] as const;

export function WorkspaceSettingsNav() {
  const cloud = isCloudDeployment();
  const visibleTabs = cloud ? tabs.filter((tab) => tab.id !== "operations") : tabs;

  return (
    <nav
      aria-label="Workspace settings"
      className="epure-settings-nav flex w-full md:w-60 shrink-0 flex-col border-b md:border-b-0 md:border-r border-border-subtle bg-surface-1/30 p-2.5 select-none"
    >
      <div className="space-y-1">
        <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          Workspace Settings
        </h3>
        <div className="space-y-0.5">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                end={tab.id === "general"}
                className={({ isActive }) =>
                  cn(
                    "group flex items-start gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors focus-ring",
                    isActive
                      ? "bg-state-selected text-fg-primary font-semibold border-l-2 border-primary"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg-primary border-l-2 border-transparent",
                  )
                }
              >
                <Icon
                  size={15}
                  className="mt-0.5 shrink-0 stroke-[1.8] text-fg-muted group-hover:text-fg-primary"
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-fg-primary leading-tight">
                    {tab.label}
                  </span>
                  <span className="text-2xs text-fg-muted leading-tight mt-0.5">
                    {tab.description}
                  </span>
                </div>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
