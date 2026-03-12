import { NavLink } from "react-router-dom";
import { workspaceSettingsPath } from "../lib/paths";
import { cn } from "../lib/cn";

const tabs = [
  { id: "general", label: "General", path: workspaceSettingsPath() },
  { id: "security", label: "Security", path: workspaceSettingsPath("security") },
] as const;

export function WorkspaceSettingsNav() {
  return (
    <nav
      aria-label="Account settings"
      className="epure-settings-nav flex w-44 shrink-0 flex-col gap-px border-r border-border bg-bg p-1.5"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path}
          end={tab.id === "general"}
          className={({ isActive }) =>
            cn(
              "epure-settings-nav-item rounded-sm px-3 py-1.5 text-sm transition-colors duration-fast focus-ring",
              isActive
                ? "epure-settings-nav-item--active text-ink"
                : "text-ink-muted hover:bg-bg-subtle/60 hover:text-ink",
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
