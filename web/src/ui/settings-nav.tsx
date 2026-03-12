import { NavLink, useParams } from "react-router-dom";
import { projectSettingsPath } from "../lib/paths";
import { cn } from "../lib/cn";

const tabs = [
  {
    id: "general",
    label: "General",
    description: "Name, retention, limits",
    path: (projectId: string) => projectSettingsPath(projectId),
  },
  {
    id: "dsn",
    label: "SDK connection",
    description: "Inbound DSN keys",
    path: (projectId: string) => projectSettingsPath(projectId, "dsn"),
  },
  {
    id: "webhooks",
    label: "Notifications",
    description: "Outbound webhooks",
    path: (projectId: string) => projectSettingsPath(projectId, "webhooks"),
  },
  {
    id: "alerts",
    label: "Alert rules",
    description: "Custom notify rules",
    path: (projectId: string) => projectSettingsPath(projectId, "alerts"),
  },
] as const;

export function SettingsNav() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return null;
  }

  return (
    <nav
      aria-label="Project settings"
      className="epure-settings-nav flex w-52 shrink-0 flex-col gap-px border-r border-border bg-bg p-1.5"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path(projectId)}
          end={tab.id === "general"}
          className={({ isActive }) =>
            cn(
              "epure-settings-nav-item rounded-sm px-3 py-2 text-sm transition-colors duration-fast focus-ring",
              isActive
                ? "epure-settings-nav-item--active text-ink"
                : "text-ink-muted hover:bg-bg-subtle/60 hover:text-ink",
            )
          }
        >
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{tab.label}</span>
            <span className="text-2xs leading-snug text-ink-muted">{tab.description}</span>
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
