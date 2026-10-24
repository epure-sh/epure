import { NavLink, useParams } from "react-router-dom";
import {
  Bell,
  Key,
  ShieldCheck,
  SlidersHorizontal,
  Webhook,
} from "lucide-react";
import { projectSettingsPath } from "../lib/paths";
import { cn } from "../lib/cn";

interface SettingsNavSection {
  title: string;
  items: {
    id: string;
    label: string;
    description: string;
    icon: typeof SlidersHorizontal;
    path: (projectId: string) => string;
  }[];
}

const sections: SettingsNavSection[] = [
  {
    title: "Project Configuration",
    items: [
      {
        id: "general",
        label: "General",
        description: "Name, retention, environments",
        icon: SlidersHorizontal,
        path: (projectId: string) => projectSettingsPath(projectId),
      },
      {
        id: "filters",
        label: "Inbound Filters & Spike Valve",
        description: "Noise rules & rate protection",
        icon: ShieldCheck,
        path: (projectId: string) => projectSettingsPath(projectId, "filters"),
      },
    ],
  },
  {
    title: "SDK & Ingest",
    items: [
      {
        id: "dsn",
        label: "Client Keys (DSN)",
        description: "Public credentials & endpoints",
        icon: Key,
        path: (projectId: string) => projectSettingsPath(projectId, "dsn"),
      },
    ],
  },
  {
    title: "Alerts & Notifications",
    items: [
      {
        id: "alerts",
        label: "Alert Rules",
        description: "Custom triggers & thresholds",
        icon: Bell,
        path: (projectId: string) => projectSettingsPath(projectId, "alerts"),
      },
      {
        id: "webhooks",
        label: "Webhooks",
        description: "Outbound HTTP notifications",
        icon: Webhook,
        path: (projectId: string) => projectSettingsPath(projectId, "webhooks"),
      },
    ],
  },
];

export function SettingsNav() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return null;
  }

  return (
    <nav
      aria-label="Project settings"
      className="epure-settings-nav flex w-full md:w-60 shrink-0 flex-col border-b md:border-b-0 md:border-r border-border-subtle bg-surface-1/30 p-2.5 select-none"
    >
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((tab) => {
                const Icon = tab.icon;
                return (
                  <NavLink
                    key={tab.id}
                    to={tab.path(projectId)}
                    end={tab.id === "general"}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-start gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors focus-ring",
                        isActive
                          ? "bg-primary/10 text-fg-primary font-semibold border-l-2 border-primary"
                          : "text-fg-muted hover:bg-surface-2 hover:text-fg-primary border-l-2 border-transparent",
                      )
                    }
                  >
                    <Icon
                      size={15}
                      className="mt-0.5 shrink-0 stroke-[1.8] text-fg-muted group-hover:text-fg-primary"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-fg-primary leading-tight truncate">
                        {tab.label}
                      </span>
                      <span className="text-2xs text-fg-muted leading-tight mt-0.5 truncate">
                        {tab.description}
                      </span>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
