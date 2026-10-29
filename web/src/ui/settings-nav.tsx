import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Settings } from "lucide-react";
import { projectSettingsPath, type ProjectSettingsTab } from "../lib/paths";
import { cn } from "../lib/cn";
import { sidebarNavIconClass, sidebarNavItemClass } from "../shell/sidebar-nav-link";

export interface ProjectSettingsNavItem {
  id: ProjectSettingsTab;
  label: string;
  path: (projectId: string) => string;
}

/** Flat project-settings leaves shown under the main-sidebar accordion. */
export const PROJECT_SETTINGS_ITEMS: ProjectSettingsNavItem[] = [
  {
    id: "general",
    label: "General",
    path: (projectId) => projectSettingsPath(projectId),
  },
  {
    id: "privacy",
    label: "Privacy",
    path: (projectId) => projectSettingsPath(projectId, "privacy"),
  },
  {
    id: "dsn",
    label: "Client Keys",
    path: (projectId) => projectSettingsPath(projectId, "dsn"),
  },
  {
    id: "filters",
    label: "Filters",
    path: (projectId) => projectSettingsPath(projectId, "filters"),
  },
];

/** @deprecated Use PROJECT_SETTINGS_ITEMS — kept for design-kit imports. */
export const PROJECT_SETTINGS_GROUPS = [
  { id: "settings", label: "Settings", items: PROJECT_SETTINGS_ITEMS },
];

function storageKey(projectId: string): string {
  return `epure.project-settings-expanded:${projectId}`;
}

function readExpanded(projectId: string): boolean | null {
  try {
    const raw = sessionStorage.getItem(storageKey(projectId));
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function writeExpanded(projectId: string, expanded: boolean): void {
  try {
    sessionStorage.setItem(storageKey(projectId), expanded ? "1" : "0");
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function isProjectSettingsPath(pathname: string): boolean {
  return /\/p\/[^/]+\/settings(?:\/|$)/.test(pathname);
}

export function activeProjectSettingsTab(pathname: string): ProjectSettingsTab {
  const match = pathname.match(/\/settings(?:\/([^/]+))?/);
  const segment = match?.[1];
  if (segment === "privacy" || segment === "dsn" || segment === "filters") {
    return segment;
  }
  return "general";
}

export interface ProjectSettingsSidebarItemProps {
  projectId: string;
  onNavigate?: () => void;
  dataTour?: string;
}

/** Expandable Project Settings entry for the main app sidebar. */
export function ProjectSettingsSidebarItem({
  projectId,
  onNavigate,
  dataTour = "nav-project-settings",
}: ProjectSettingsSidebarItemProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onSettings = isProjectSettingsPath(pathname);
  const activeTab = activeProjectSettingsTab(pathname);

  const [expanded, setExpanded] = useState(() => {
    if (onSettings) return true;
    return readExpanded(projectId) ?? false;
  });

  useEffect(() => {
    if (onSettings) {
      setExpanded(true);
      writeExpanded(projectId, true);
      return;
    }
    const stored = readExpanded(projectId);
    if (stored != null) {
      setExpanded(stored);
    }
  }, [onSettings, projectId]);

  function setOpen(next: boolean) {
    setExpanded(next);
    writeExpanded(projectId, next);
  }

  function handleHeaderClick() {
    if (!expanded) {
      setOpen(true);
      if (!onSettings) {
        navigate(projectSettingsPath(projectId));
        onNavigate?.();
      }
      return;
    }
    setOpen(false);
  }

  // When collapsed on a settings route, the parent keeps the accent row.
  // When expanded, the active child owns it (same as Issues / Alerts).
  const parentActive = onSettings && !expanded;
  const parentInSection = onSettings;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        data-tour={dataTour}
        aria-expanded={expanded}
        onClick={handleHeaderClick}
        className={sidebarNavItemClass(parentActive, "w-full justify-between")}
      >
        <span className="relative z-10 flex min-w-0 items-center gap-2">
          <Settings
            size={13}
            strokeWidth={parentInSection ? 2.1 : 1.8}
            className={sidebarNavIconClass(parentInSection)}
            aria-hidden
          />
          <span className="truncate">Project Settings</span>
        </span>
        <ChevronDown
          size={12}
          className={cn(
            "relative z-10 shrink-0 text-fg-muted transition-transform duration-150",
            expanded ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="ml-3 space-y-0.5 border-l border-border-subtle pl-1.5">
          {PROJECT_SETTINGS_ITEMS.map((item) => {
            const active = onSettings && activeTab === item.id;
            return (
              <NavLink
                key={item.id}
                to={item.path(projectId)}
                end={item.id === "general"}
                onClick={onNavigate}
                className={sidebarNavItemClass(active)}
              >
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Design-kit preview of the expandable Project Settings sidebar item. */
export function SettingsNav({ projectId = "preview-project" }: { projectId?: string }) {
  return (
    <div className="w-60 rounded-md border border-border-subtle bg-bg-subtle p-2">
      <ProjectSettingsSidebarItem projectId={projectId} />
    </div>
  );
}
